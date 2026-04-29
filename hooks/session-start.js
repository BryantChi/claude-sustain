// SessionStart hook — inject a brief rules primer, refresh memory backend
// detection, and surface a routing menu filtered to what's actually installed
// on this machine. Without runtime filtering, a clean install would see all
// 21 routing entries but only 8 would dispatch.

import { writeJson, loadSpec } from "./lib/io.js";
import { detect } from "../lib/memory/detect.js";
import { writeState } from "../lib/memory/state.js";
import { filterRouting } from "../lib/routing/filter.js";

let spec;
try { spec = loadSpec(); } catch { process.exit(0); }

let detection;
try {
  detection = detect();
  writeState(detection);
} catch {
  detection = { preferred: "fs", backends: { mempalace: { installed: false }, claudeMem: { installed: false } } };
}

let routing;
try { routing = filterRouting(spec); }
catch { routing = { available: spec.skillRouting || [], unavailable: [], totalCount: (spec.skillRouting || []).length, installedCount: 0 }; }

const ironLines = spec.ironRules.map(r => `  - ${r.id.toUpperCase()} ${r.title}: ${r.summary}`);
const backendLine = describeBackend(detection);
const routingTable = routing.available.length
  ? routing.available.map(e => `    - ${e.when} → ${e.use}`).join("\n")
  : "    (no routing entries are currently reachable; install superpowers / claude-mem / etc. to enable)";

const primer = [
  `[claude-sustain v${spec.version}] Token-efficiency rules active:`,
  ...ironLines,
  `  Phase-end: ${spec.phaseChecklist.length}-question self-check on Stop.`,
  `  Skill routing — ${routing.available.length}/${routing.totalCount} entries available on this machine:`,
  routingTable,
  routing.unavailable.length
    ? `    (${routing.unavailable.length} entries hidden because their plugin isn't installed; run /sustain:audit for details.)`
    : "    (full routing table is reachable on this install.)",
  `  Memory backend: ${backendLine}`
].join("\n");

writeJson({
  systemMessage:
    `[claude-sustain v${spec.version}] active — ${spec.ironRules.length} Iron Rules + ` +
    `${spec.phaseChecklist.length}-question phase check + ` +
    `${routing.available.length}/${routing.totalCount} skill routes · memory: ${detection.preferred}`,
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
