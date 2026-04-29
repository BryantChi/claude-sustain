// Shared logic: does a routing token resolve to something installed?
//
// Used by both lib/audit/routing.js (drift report) and lib/routing/filter.js
// (runtime gating). Keeping the matcher in one place keeps the two outputs
// consistent — anything the audit accepts, the filter shows; anything the
// audit flags missing, the filter hides.

// Skills shipped with Claude Code itself — not on disk, but valid routing targets.
// Update this allowlist as Anthropic adds/removes built-ins.
export const ANTHROPIC_BUILTINS = new Set([
  "claude-api",
  "update-config",
  "frontend-design",
]);

export function splitTokens(useField) {
  // routing.use can be "a OR b" or "a → b" (a chain of skills). Both forms
  // mean "any of these counts as available".
  return String(useField || "")
    .split(/\s+(?:OR|→)\s+/i)
    .map(t => t.trim())
    .filter(Boolean);
}

export function tokenMatchesInstalled(token, installed) {
  // Anthropic built-ins are always available.
  if (ANTHROPIC_BUILTINS.has(token)) return true;

  const colonIdx = token.indexOf(":");
  if (colonIdx >= 0) {
    const ns = token.slice(0, colonIdx);
    const item = token.slice(colonIdx + 1);
    // Naming conventions:
    //   "codex:rescue"               → file "codex-rescue.md" in plugin "codex"
    //   "claude-mem:smart-explore"   → "smart-explore.md" in plugin "claude-mem"
    //   "superpowers:writing-plans"  → "writing-plans/SKILL.md" in plugin "superpowers"
    const candidates = [item, `${ns}-${item}`];
    return installed.some(s =>
      s.name === `${ns}:${item}` ||
      s.name === `${ns}:${ns}:${item}` ||
      (candidates.includes(s.shortName) && (
        s.source === "user" ||
        s.source.toLowerCase().includes(ns.toLowerCase())
      ))
    );
  }
  return installed.some(s => s.shortName === token);
}
