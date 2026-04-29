// User overrides for spec.json.
//
// Location: ~/.claude/sustain/overrides.json
// Schema: a partial spec.json — anything you put here wins over the bundled
// spec at runtime. The plugin never silently overwrites this file.
//
// Merge semantics:
//   - For top-level scalar fields (version, metadata.*) → user wins.
//   - For arrays (ironRules, phaseChecklist, skillRouting):
//       * If user provides an `id` matching a bundled entry → user replaces it.
//       * If user provides an entry with no matching id → appended.
//       * Bundled entries the user didn't touch → preserved.
//   - For `details.R<n>` (objects with rules[]):
//       * Same id-matching merge inside `rules`.
//   - For `memoryBackends` → user replaces wholesale (rare to override, all-or-nothing).
//
// Why id-matching: lets users tweak one rule without re-stating the whole table.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const OVERRIDES_FILE = join(homedir(), ".claude", "sustain", "overrides.json");

export function readOverrides() {
  if (!existsSync(OVERRIDES_FILE)) return null;
  try {
    return JSON.parse(readFileSync(OVERRIDES_FILE, "utf8"));
  } catch {
    return null;
  }
}

function mergeArrayById(base, override, idKey = "id") {
  if (!Array.isArray(override)) return base;
  if (!Array.isArray(base)) return override;
  const result = [...base];
  for (const entry of override) {
    const id = entry?.[idKey];
    if (id === undefined) {
      result.push(entry);
      continue;
    }
    const idx = result.findIndex(e => e?.[idKey] === id);
    if (idx >= 0) result[idx] = { ...result[idx], ...entry };
    else result.push(entry);
  }
  return result;
}

function mergeRouting(base, override) {
  // Routing entries don't have ids; match by `when` (the scenario string).
  if (!Array.isArray(override)) return base;
  if (!Array.isArray(base)) return override;
  const result = [...base];
  for (const entry of override) {
    const idx = entry?.when ? result.findIndex(e => e?.when === entry.when) : -1;
    if (idx >= 0) result[idx] = { ...result[idx], ...entry };
    else result.push(entry);
  }
  return result;
}

// modelHint merge: arrays default to APPEND to keep the bundled defaults useful;
// pass `replaceLookupVerbs: true` (or `replaceHeavyKeywords: true`) to wipe the
// base list and use only the user's entries. wordLimit replaces if provided.
function mergeModelHint(base, override) {
  const out = { ...(base || {}) };
  if (Number.isFinite(override.wordLimit)) out.wordLimit = override.wordLimit;
  if (Array.isArray(override.lookupVerbs)) {
    out.lookupVerbs = override.replaceLookupVerbs
      ? override.lookupVerbs
      : [...(out.lookupVerbs || []), ...override.lookupVerbs];
  }
  if (Array.isArray(override.heavyKeywords)) {
    out.heavyKeywords = override.replaceHeavyKeywords
      ? override.heavyKeywords
      : [...(out.heavyKeywords || []), ...override.heavyKeywords];
  }
  return out;
}

function mergeDetails(base, override) {
  if (!override || typeof override !== "object") return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const baseBlock = out[key] || { title: "", rules: [] };
    const overrideBlock = override[key];
    out[key] = {
      ...baseBlock,
      ...overrideBlock,
      rules: mergeArrayById(baseBlock.rules || [], overrideBlock.rules || []),
    };
  }
  return out;
}

export function applyOverrides(spec, overrides = readOverrides()) {
  if (!overrides) return spec;
  const merged = { ...spec, ...overrides };
  // Re-merge structured arrays so we don't lose bundled entries.
  if (overrides.ironRules) merged.ironRules = mergeArrayById(spec.ironRules, overrides.ironRules);
  if (overrides.phaseChecklist) merged.phaseChecklist = mergeArrayById(spec.phaseChecklist, overrides.phaseChecklist);
  if (overrides.skillRouting) merged.skillRouting = mergeRouting(spec.skillRouting, overrides.skillRouting);
  if (overrides.details) merged.details = mergeDetails(spec.details, overrides.details);
  if (overrides.metadata) merged.metadata = { ...spec.metadata, ...overrides.metadata };
  if (overrides.modelHint) merged.modelHint = mergeModelHint(spec.modelHint, overrides.modelHint);
  // Mark merge for downstream visibility.
  merged._appliedOverrides = true;
  return merged;
}
