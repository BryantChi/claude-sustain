// Stop hook — print phase-end 6-question checklist and best-effort token summary.
// Never blocks; advisory only.

import { readStdinJson, loadSpec } from "./lib/io.js";
import { tallyTokens, formatTokens } from "./lib/jsonl.js";

const event = readStdinJson();
const transcriptPath = event.transcript_path || event.transcriptPath;

let spec;
try { spec = loadSpec(); } catch { spec = null; }

const checklist = spec?.phaseChecklist?.map((q, i) => `  ${i + 1}. ${q.question}`).join("\n");

const tokens = tallyTokens(transcriptPath);
const tokenLine = `[claude-sustain] ${formatTokens(tokens)}`;

if (checklist) {
  process.stderr.write("[claude-sustain] Phase-end checklist:\n" + checklist + "\n");
}
process.stderr.write(tokenLine + "\n");
process.exit(0);
