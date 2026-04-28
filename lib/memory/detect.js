// Memory backend detection.
//
// We can't call MCP tools from plugin code, so detection is filesystem-based:
// - claude-mem: ~/.claude/plugins/cache/thedotmack/claude-mem/<version>/
// - mempalace: ~/.claude/plugins/cache/mempalace/<plugin>/<version>/
//   (mempalace also ships .claude-plugin/, .codex-plugin/, .agents/plugins/ —
//    cache layout follows the marketplace's owner directory)
//
// Env-var overrides (for users with non-standard installs):
//   CLAUDE_SUSTAIN_FORCE_BACKEND=mempalace|claude-mem|fs
//   CLAUDE_SUSTAIN_MEMPALACE_PATH=/abs/path
//   CLAUDE_SUSTAIN_CLAUDE_MEM_PATH=/abs/path

import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN_CACHE = join(homedir(), ".claude", "plugins", "cache");

function latestVersionDir(parent) {
  if (!existsSync(parent)) return null;
  let entries;
  try { entries = readdirSync(parent); } catch { return null; }
  const versions = entries
    .filter(name => /^\d+\.\d+\.\d+/.test(name))
    .map(name => ({ name, path: join(parent, name) }))
    .filter(e => { try { return statSync(e.path).isDirectory(); } catch { return false; } });
  if (versions.length === 0) return null;
  versions.sort((a, b) => compareSemver(b.name, a.name));
  return versions[0];
}

function compareSemver(a, b) {
  const pa = a.split(/[.\-+]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
  const pb = b.split(/[.\-+]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function probeClaudeMem() {
  const override = process.env.CLAUDE_SUSTAIN_CLAUDE_MEM_PATH;
  if (override) {
    return existsSync(override)
      ? { installed: true, path: override, version: "override" }
      : { installed: false };
  }
  const parent = join(PLUGIN_CACHE, "thedotmack", "claude-mem");
  const latest = latestVersionDir(parent);
  if (latest) return { installed: true, path: latest.path, version: latest.name };
  return { installed: false };
}

function probeMempalace() {
  const override = process.env.CLAUDE_SUSTAIN_MEMPALACE_PATH;
  if (override) {
    return existsSync(override)
      ? { installed: true, path: override, version: "override" }
      : { installed: false };
  }
  // mempalace marketplace owner is unknown until it ships an official one;
  // probe several candidates so users with different install paths are picked up.
  const candidates = [
    join(PLUGIN_CACHE, "mempalace", "mempalace"),
    join(PLUGIN_CACHE, "mempalace", "mempalace-plugin"),
    join(PLUGIN_CACHE, "mempalace"),
  ];
  for (const parent of candidates) {
    const latest = latestVersionDir(parent);
    if (latest) return { installed: true, path: latest.path, version: latest.name };
    if (existsSync(join(parent, ".claude-plugin"))) {
      return { installed: true, path: parent, version: "unknown" };
    }
  }
  return { installed: false };
}

export function detect() {
  const force = process.env.CLAUDE_SUSTAIN_FORCE_BACKEND;
  const claudeMem = probeClaudeMem();
  const mempalace = probeMempalace();

  // Preference order: forced > mempalace (MIT, primary) > claude-mem (AGPL, secondary) > fs (always).
  let preferred;
  if (force === "fs") preferred = "fs";
  else if (force === "mempalace" && mempalace.installed) preferred = "mempalace";
  else if (force === "claude-mem" && claudeMem.installed) preferred = "claude-mem";
  else if (mempalace.installed) preferred = "mempalace";
  else if (claudeMem.installed) preferred = "claude-mem";
  else preferred = "fs";

  return {
    detectedAt: new Date().toISOString(),
    backends: { mempalace, claudeMem },
    preferred,
    fallback: "fs",
    forced: Boolean(force),
  };
}
