// Stop hook — show phase-end 6-question checklist, best-effort token summary,
// write a telemetry row, and (when configured) fire a notification webhook.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";
import { tallyTokens, formatTokens, sessionDurationMs } from "./lib/jsonl.js";
import { append as appendTelemetry } from "../lib/telemetry.js";
import { loadNotify } from "../lib/config.js";
import { maybeNotify } from "../lib/notify.js";

const event = readStdinJson();
const transcriptPath = event.transcript_path || event.transcriptPath;
const sessionId = event.session_id || event.sessionId;

let spec;
try { spec = loadSpec(); } catch { spec = null; }

const checklist = spec?.phaseChecklist?.map((q, i) => `  ${i + 1}. ${q.question}`).join("\n") || "";
const tokens = tallyTokens(transcriptPath);
const tokenLine = formatTokens(tokens);
const durationMs = sessionDurationMs(transcriptPath);

try { appendTelemetry({ sessionId, transcriptPath, tokens }); } catch { /* never block Stop on telemetry */ }

const notifyConfig = loadNotify();
if (notifyConfig) {
  // Fire-and-forget: we still want to return promptly. await is fine here
  // because the timeout inside maybeNotify caps the wait at ~5s.
  try { await maybeNotify({ config: notifyConfig, sessionId, tokens, durationMs, tokenLine }); }
  catch { /* never block Stop on notify */ }
}

const message = checklist
  ? `[claude-sustain] phase-end checklist:\n${checklist}\n[claude-sustain] ${tokenLine}`
  : `[claude-sustain] ${tokenLine}`;

writeJson({ systemMessage: message });
process.exit(0);
