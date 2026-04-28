// Stop hook — show phase-end 6-question checklist and best-effort token summary.
// Uses `systemMessage` so the user sees the checklist directly in the transcript;
// stderr was invisible in the previous version.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";
import { tallyTokens, formatTokens } from "./lib/jsonl.js";

const event = readStdinJson();
const transcriptPath = event.transcript_path || event.transcriptPath;

let spec;
try { spec = loadSpec(); } catch { spec = null; }

const checklist = spec?.phaseChecklist?.map((q, i) => `  ${i + 1}. ${q.question}`).join("\n") || "";
const tokens = tallyTokens(transcriptPath);
const tokenLine = formatTokens(tokens);

const message = checklist
  ? `[claude-sustain] phase-end checklist:\n${checklist}\n[claude-sustain] ${tokenLine}`
  : `[claude-sustain] ${tokenLine}`;

writeJson({ systemMessage: message });
process.exit(0);
