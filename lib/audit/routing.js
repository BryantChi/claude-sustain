// Skill routing audit — diff installed skills against spec.json's skillRouting.
//
// Sources we scan (best-effort; missing dirs are fine):
//   ~/.claude/skills/<skill-name>/SKILL.md
//   ~/.claude/plugins/cache/<owner>/<plugin>/<version>/skills/<skill-name>/SKILL.md
//
// Output:
//   - listed-but-missing: routing entry references a skill that isn't installed
//   - installed-but-unrouted: skill is installed but no routing entry mentions it
//
// We never auto-edit spec.json. We just report; the user decides.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = () => homedir();

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

function listPluginSkills() {
  const cache = join(HOME(), ".claude", "plugins", "cache");
  if (!existsSync(cache)) return [];
  const out = [];
  for (const owner of readdirSync(cache)) {
    const ownerDir = join(cache, owner);
    if (!isDir(ownerDir)) continue;
    for (const plugin of readdirSync(ownerDir)) {
      const pluginDir = join(ownerDir, plugin);
      if (!isDir(pluginDir)) continue;
      // Plugins may pin a version dir or live directly in the plugin dir.
      const candidates = [pluginDir, ...readdirSync(pluginDir).map(v => join(pluginDir, v)).filter(isDir)];
      for (const root of candidates) {
        const skillsDir = join(root, "skills");
        if (existsSync(skillsDir) && isDir(skillsDir)) {
          for (const s of listSkillsIn(skillsDir)) {
            out.push({
              name: `${owner}:${plugin}:${s.name}`,
              shortName: s.name,
              source: `${owner}/${plugin}`,
              path: s.path,
            });
          }
        }
      }
    }
  }
  return out;
}

export function listAllInstalledSkills() {
  const userSkills = listSkillsIn(join(HOME(), ".claude", "skills"))
    .map(s => ({ name: s.name, shortName: s.name, source: "user", path: s.path }));
  return [...userSkills, ...listPluginSkills()];
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
  // token might be "superpowers:writing-plans" or just "frontend-design".
  const colonIdx = token.indexOf(":");
  if (colonIdx >= 0) {
    const namespace = token.slice(0, colonIdx);
    const skill = token.slice(colonIdx + 1);
    return installed.some(s =>
      (s.name === `${namespace}:${skill}` ||
       s.name === `${namespace}:${namespace}:${skill}` ||
       (s.shortName === skill && s.source.toLowerCase().includes(namespace.toLowerCase())))
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
