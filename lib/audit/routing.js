// Skill routing audit — diff installed skills/agents against spec.json's skillRouting.
//
// Sources we scan (best-effort; missing dirs are fine):
//   ~/.claude/skills/<skill-name>/SKILL.md
//   ~/.claude/agents/<agent-name>.md
//   ~/.claude/plugins/cache/<owner>/<plugin>/<version>/skills/<skill-name>/SKILL.md
//   ~/.claude/plugins/cache/<owner>/<plugin>/<version>/agents/<agent-name>.md
//
// Plus an allowlist of Anthropic-built-in skills that aren't on disk
// (claude-api / update-config / frontend-design) — these can be referenced
// in routing without being filesystem-installed.
//
// Output:
//   - listed-but-missing: routing entry references something not installed
//   - installed-but-unrouted: installed skill / agent that no routing entry mentions
//
// We never auto-edit spec.json. We just report; the user decides.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = () => homedir();

// Skills shipped with Claude Code itself — not on disk, but valid routing targets.
// Update this allowlist as Anthropic adds/removes built-ins.
const ANTHROPIC_BUILTINS = new Set([
  "claude-api",
  "update-config",
  "frontend-design",
]);

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function listSkillsIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => isDir(join(dir, name)))
    .filter(name => existsSync(join(dir, name, "SKILL.md")))
    .map(name => ({ name, path: join(dir, name) }));
}

function listAgentsIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith(".md"))
    .map(name => ({ name: name.replace(/\.md$/, ""), path: join(dir, name) }));
}

function listPluginItems() {
  const cache = join(HOME(), ".claude", "plugins", "cache");
  if (!existsSync(cache)) return { skills: [], agents: [] };
  const skills = [];
  const agents = [];
  for (const owner of readdirSync(cache)) {
    const ownerDir = join(cache, owner);
    if (!isDir(ownerDir)) continue;
    for (const plugin of readdirSync(ownerDir)) {
      const pluginDir = join(ownerDir, plugin);
      if (!isDir(pluginDir)) continue;
      const candidates = [pluginDir, ...readdirSync(pluginDir).map(v => join(pluginDir, v)).filter(isDir)];
      for (const root of candidates) {
        const skillsDir = join(root, "skills");
        if (existsSync(skillsDir) && isDir(skillsDir)) {
          for (const s of listSkillsIn(skillsDir)) {
            skills.push({
              name: `${owner}:${plugin}:${s.name}`,
              shortName: s.name,
              source: `${owner}/${plugin}`,
              path: s.path,
              kind: "skill",
            });
          }
        }
        const agentsDir = join(root, "agents");
        if (existsSync(agentsDir) && isDir(agentsDir)) {
          for (const a of listAgentsIn(agentsDir)) {
            agents.push({
              name: `${owner}:${plugin}:${a.name}`,
              shortName: a.name,
              source: `${owner}/${plugin}`,
              path: a.path,
              kind: "agent",
            });
          }
        }
      }
    }
  }
  return { skills, agents };
}

export function listAllInstalledSkills() {
  const userSkills = listSkillsIn(join(HOME(), ".claude", "skills"))
    .map(s => ({ name: s.name, shortName: s.name, source: "user", path: s.path, kind: "skill" }));
  const userAgents = listAgentsIn(join(HOME(), ".claude", "agents"))
    .map(a => ({ name: a.name, shortName: a.name, source: "user", path: a.path, kind: "agent" }));
  const plugin = listPluginItems();
  return [...userSkills, ...userAgents, ...plugin.skills, ...plugin.agents];
}

function extractReferencedSkills(spec) {
  // Routing entries' `use` field contains tokens like "superpowers:writing-plans"
  // or "claude-mem:smart-explore". We split on " OR " and "→" and pull each token.
  const tokens = [];
  for (const entry of spec.skillRouting || []) {
    const parts = String(entry.use || "")
      .split(/\s+(?:OR|→)\s+/i)
      .map(p => p.trim())
      .filter(Boolean);
    for (const p of parts) tokens.push({ token: p, source: entry.source, when: entry.when });
  }
  return tokens;
}

function tokenMatchesInstalled(token, installed) {
  // Anthropic built-ins (claude-api, update-config, frontend-design) live in
  // Claude Code itself — accept them without a filesystem hit.
  if (ANTHROPIC_BUILTINS.has(token)) return true;

  const colonIdx = token.indexOf(":");
  if (colonIdx >= 0) {
    const ns = token.slice(0, colonIdx);
    const item = token.slice(colonIdx + 1);
    // Common naming conventions:
    //   "codex:rescue"        → file "codex-rescue.md" in plugin "codex"
    //   "claude-mem:smart-explore" → "smart-explore.md" in plugin "claude-mem"
    //   "superpowers:writing-plans" → "writing-plans/SKILL.md" in plugin "superpowers"
    const candidates = [item, `${ns}-${item}`];
    return installed.some(s =>
      s.name === `${ns}:${item}` ||
      s.name === `${ns}:${ns}:${item}` ||
      candidates.includes(s.shortName) && (
        s.source === "user" ||
        s.source.toLowerCase().includes(ns.toLowerCase())
      )
    );
  }
  return installed.some(s => s.shortName === token);
}

export function audit(spec) {
  const installed = listAllInstalledSkills();
  const referenced = extractReferencedSkills(spec);

  const missing = referenced.filter(r => !tokenMatchesInstalled(r.token, installed));

  const referencedShortNames = new Set();
  for (const r of referenced) {
    const colonIdx = r.token.indexOf(":");
    referencedShortNames.add(colonIdx >= 0 ? r.token.slice(colonIdx + 1) : r.token);
  }
  const unrouted = installed.filter(s => !referencedShortNames.has(s.shortName));

  return {
    auditedAt: new Date().toISOString(),
    installedCount: installed.length,
    routingCount: referenced.length,
    listedButMissing: missing.map(m => ({ token: m.token, scenario: m.when })),
    installedButUnrouted: unrouted.map(s => ({ name: s.name, source: s.source })),
    notes: [
      "Some routing tokens (e.g. claude-mem MCP search) aren't filesystem skills — they're MCP tools and won't appear in `installed`. Sanity-check the missing list before acting.",
      "Unrouted skills aren't bugs — they may be intentionally excluded. Add to spec.json only if useful.",
    ],
  };
}
