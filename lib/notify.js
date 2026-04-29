// Notification dispatcher for Stop events.
//
// Reads ~/.claude/sustain/notify.json. When the session crosses a configured
// threshold (token total or duration), POSTs a short summary to the user's
// webhook in the appropriate format. Never blocks Stop — exceptions are
// swallowed and the function resolves to null.
//
// State file: ~/.claude/sustain/notify-state.json — used to rate-limit so a
// burst of Stop events doesn't spam the webhook (default minIntervalMs=60000).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function sustainDir() {
  return process.env.CLAUDE_SUSTAIN_CONFIG_DIR || join(homedir(), ".claude", "sustain");
}

function stateFile() { return join(sustainDir(), "notify-state.json"); }

function readState() {
  const f = stateFile();
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, "utf8")); } catch { return {}; }
}

function writeState(state) {
  try {
    mkdirSync(sustainDir(), { recursive: true });
    writeFileSync(stateFile(), JSON.stringify(state));
  } catch { /* never block on state IO */ }
}

function shouldFire({ tokens, durationMs, threshold }) {
  if (!threshold) return false;
  const total = (tokens?.input || 0) + (tokens?.output || 0)
    + (tokens?.cache_creation || 0) + (tokens?.cache_read || 0);
  if (threshold.tokenTotal > 0 && total >= threshold.tokenTotal) return true;
  if (threshold.durationMs > 0 && durationMs >= threshold.durationMs) return true;
  return false;
}

function buildPayload({ format, sessionId, tokens, durationMs, tokenLine }) {
  const total = (tokens?.input || 0) + (tokens?.output || 0)
    + (tokens?.cache_creation || 0) + (tokens?.cache_read || 0);
  const minutes = Math.round(durationMs / 60000);
  const text = `claude-sustain · session ${sessionId || "?"} ended\n${tokenLine}\nduration: ${minutes}m · total tokens: ${total}`;

  switch (format) {
    case "slack":
    case "discord":
      return { text, content: text }; // both accept either field
    case "telegram":
      return { text, parse_mode: "Markdown" };
    case "raw":
    default:
      return { text, sessionId, tokens, durationMs };
  }
}

export async function maybeNotify({ config, sessionId, tokens, durationMs, tokenLine }) {
  if (!config) return null;
  if (!shouldFire({ tokens, durationMs, threshold: config.threshold })) return null;

  const state = readState();
  const last = state.lastNotifiedAt || 0;
  if (Date.now() - last < (config.minIntervalMs || 60_000)) return null;

  const payload = buildPayload({ format: config.format, sessionId, tokens, durationMs, tokenLine });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(config.webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    writeState({ ...state, lastNotifiedAt: Date.now(), lastStatus: res.status });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    writeState({ ...state, lastNotifiedAt: Date.now(), lastError: String(err?.message || err) });
    return { ok: false, error: String(err?.message || err) };
  }
}
