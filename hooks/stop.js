// Stop hook — show phase-end 6-question checklist and best-effort token summary.
// Uses `systemMessage` so the user sees the checklist directly in the transcript;
// stderr was invisible in the previous version.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";
import { tallyTokens, formatTokens } from "./lib/jsonl.js";
import { append as appendTelemetry } from "../lib/telemetry.js";

const event = readStdinJson();
const transcriptPath = event.transcript_path || event.transcriptPath;
const sessionId = event.session_id || event.sessionId;

let spec;
try { spec = loadSpec(); } catch { spec = null; }

const checklist = spec?.phaseChecklist?.map((q, i) => `  ${i + 1}. ${q.question}`).join("\n") || "";
const tokens = tallyTokens(transcriptPath);
const tokenLine = formatTokens(tokens);

try { appendTelemetry({ sessionId, transcriptPath, tokens }); } catch { /* never block Stop on telemetry */ }

const message = checklist
  ? `[claude-sustain] phase-end checklist:\n${checklist}\n[claude-sustain] ${tokenLine}`
  : `[claude-sustain] ${tokenLine}`;

writeJson({ systemMessage: message });
process.exit(0);
