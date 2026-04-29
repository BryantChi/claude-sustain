// User-facing JSON config loaders.
//
// All files live under ~/.claude/sustain/ and are owned by the user; the plugin
// never writes them. Missing or malformed files yield safe defaults so that a
// fresh install behaves identically to v0.5.0.
//
//   strict.json — Iron-2 hard-gate switch + bypass allowlist (PreToolUse)
//   notify.json — Stop-hook webhook config

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// CLAUDE_SUSTAIN_CONFIG_DIR overrides the config directory. Tests rely on
// this; users should not normally need it.
function sustainDir() {
  return process.env.CLAUDE_SUSTAIN_CONFIG_DIR || join(homedir(), ".claude", "sustain");
}

function readJson(name) {
  const path = join(sustainDir(), name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function loadStrict() {
  const cfg = readJson("strict.json") || {};
  return {
    ironGate: cfg.ironGate === true,
    bypassPatterns: Array.isArray(cfg.bypassPatterns) ? cfg.bypassPatterns : [],
  };
}

export function loadNotify() {
  const cfg = readJson("notify.json");
  if (!cfg || typeof cfg.webhook !== "string" || !cfg.webhook) return null;
  const t = cfg.threshold || {};
  return {
    webhook: cfg.webhook,
    format: ["slack", "discord", "telegram", "raw"].includes(cfg.format) ? cfg.format : "raw",
    threshold: {
      tokenTotal: Number.isFinite(t.tokenTotal) ? t.tokenTotal : 0,
      durationMs: Number.isFinite(t.durationMs) ? t.durationMs : 0,
    },
    minIntervalMs: Number.isFinite(cfg.minIntervalMs) ? cfg.minIntervalMs : 60_000,
  };
}
