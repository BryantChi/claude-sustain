// Runtime routing filter.
//
// Splits spec.skillRouting into:
//   - available[]   — at least one referenced token resolves to something installed
//   - unavailable[] — none of the referenced tokens resolve
//
// Used by SessionStart to inject a routing menu that *only* lists actionable
// entries on this machine. Without this, a fresh Claude Code install with
// just claude-sustain would see 21 routing entries but only 8 would actually
// dispatch — silent degradation.
//
// "available" means at least one — many entries are written as
// "skill-a OR skill-b" precisely so a partial install still works.

import { listAllInstalledSkills } from "../audit/routing.js";
import { splitTokens, tokenMatchesInstalled } from "./match.js";

export function filterRouting(spec, options = {}) {
  const installed = options.installed || listAllInstalledSkills();
  const available = [];
  const unavailable = [];

  for (const entry of spec.skillRouting || []) {
    const tokens = splitTokens(entry.use);
    const reachable = tokens.length > 0 && tokens.some(t => tokenMatchesInstalled(t, installed));
    if (reachable) available.push(entry);
    else unavailable.push(entry);
  }

  return {
    available,
    unavailable,
    installedCount: installed.length,
    totalCount: (spec.skillRouting || []).length,
  };
}
