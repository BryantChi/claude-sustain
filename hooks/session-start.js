// SessionStart hook — inject a brief rules primer.
// Keep it short to avoid bloating context; users can run /sustain:status for full rules.

import { writeJson, loadSpec } from "./lib/io.js";

let spec;
try { spec = loadSpec(); } catch { process.exit(0); }

const ironLines = spec.ironRules.map(r => `  - ${r.id.toUpperCase()} ${r.title}: ${r.summary}`);

const primer = [
  `[claude-sustain v${spec.version}] Token-efficiency rules active:`,
  ...ironLines,
  `  Phase-end: ${spec.phaseChecklist.length}-question self-check on Stop.`,
  `  Skill routing: ${spec.skillRouting.length} scenarios mapped — see /sustain:status.`
].join("\n");

writeJson({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: primer
  }
});
process.exit(0);
