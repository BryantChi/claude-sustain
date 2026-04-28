// SessionStart hook — inject a brief rules primer + refresh memory backend detection.
// Keep it short to avoid bloating context; users can run /sustain:status for full rules.

import { writeJson, loadSpec } from "./lib/io.js";
import { detect } from "../lib/memory/detect.js";
import { writeState } from "../lib/memory/state.js";

let spec;
try { spec = loadSpec(); } catch { process.exit(0); }

let detection;
try {
  detection = detect();
  writeState(detection);
} catch {
  detection = { preferred: "fs", backends: { mempalace: { installed: false }, claudeMem: { installed: false } } };
}

const ironLines = spec.ironRules.map(r => `  - ${r.id.toUpperCase()} ${r.title}: ${r.summary}`);
const backendLine = describeBackend(detection);

const primer = [
  `[claude-sustain v${spec.version}] Token-efficiency rules active:`,
  ...ironLines,
  `  Phase-end: ${spec.phaseChecklist.length}-question self-check on Stop.`,
  `  Skill routing: ${spec.skillRouting.length} scenarios mapped — see /sustain:status.`,
  `  Memory backend: ${backendLine}`
].join("\n");

writeJson({
  systemMessage: `[claude-sustain v${spec.version}] active — ${spec.ironRules.length} Iron Rules + ${spec.phaseChecklist.length}-question phase check + ${spec.skillRouting.length} skill routes · memory: ${detection.preferred}`,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: primer
  }
});
process.exit(0);

function describeBackend(d) {
  const m = d.backends.mempalace?.installed ? `mempalace@${d.backends.mempalace.version}` : null;
  const c = d.backends.claudeMem?.installed ? `claude-mem@${d.backends.claudeMem.version}` : null;
  const installed = [m, c].filter(Boolean).join(", ") || "none installed";
  return `preferred=${d.preferred} (${installed}; fs fallback always available)`;
}
