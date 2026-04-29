// Model-routing heuristic for Task subagent dispatches.
//
// Inspects a Task prompt and decides whether to suggest passing
// `model: "haiku"`. We never mutate the actual tool_input — hooks can't safely
// rewrite tool calls — but we surface the recommendation through systemMessage
// so the agent can pick it up on the next call.
//
// Heuristic (all must hold to advise haiku):
//   1. Word count below the configured wordLimit
//   2. Contains at least one lookup verb (find / list / locate / read / grep …)
//   3. Contains zero "heavy" keywords (design, refactor, implement, debug …)
//   4. The user has not already specified a model
//
// Patterns are sourced from spec.modelHint (with overrides applied) so users
// can extend the verb/keyword lists for their domain via overrides.json
// without touching the plugin code.

const DEFAULT_CONFIG = {
  wordLimit: 200,
  lookupVerbs: [
    "\\bfind\\b", "\\blist\\b", "\\blocate\\b", "\\bgrep\\b", "\\bsearch\\b",
    "\\bread\\b", "\\bcheck\\b", "\\bcount\\b", "\\benumerate\\b", "\\binventory\\b",
    "\\bsurvey\\b", "\\bidentify\\b", "\\blookup\\b",
    "查找", "找出", "列出", "盤點", "搜尋", "檢查", "讀取", "統計",
  ],
  heavyKeywords: [
    "\\bdesign\\b", "\\brefactor", "\\bimplement", "\\brewrite\\b",
    "\\bdebug", "\\breview\\b", "\\bsecurity\\b", "\\bcompliance\\b",
    "\\bmigrat", "\\barchitect", "\\bplan\\b", "\\bspec\\b", "\\bdesign doc\\b",
    "設計", "重構", "實作", "實做", "除錯", "審查", "審核", "安全", "合規",
    "架構", "規劃",
  ],
};

function compile(sources) {
  const out = [];
  for (const src of sources || []) {
    if (typeof src !== "string" || !src) continue;
    try { out.push(new RegExp(src, "i")); } catch { /* skip malformed */ }
  }
  return out;
}

export function modelHint({ prompt = "", explicitModel = null, config = null } = {}) {
  if (explicitModel) return { advise: false };
  if (!prompt || typeof prompt !== "string") return { advise: false };

  const cfg = config || DEFAULT_CONFIG;
  const wordLimit = Number.isFinite(cfg.wordLimit) ? cfg.wordLimit : DEFAULT_CONFIG.wordLimit;
  const lookupVerbs = compile(cfg.lookupVerbs?.length ? cfg.lookupVerbs : DEFAULT_CONFIG.lookupVerbs);
  const heavyKeywords = compile(cfg.heavyKeywords?.length ? cfg.heavyKeywords : DEFAULT_CONFIG.heavyKeywords);

  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount === 0 || wordCount > wordLimit) return { advise: false };

  const hasLookupVerb = lookupVerbs.some(re => re.test(prompt));
  if (!hasLookupVerb) return { advise: false };

  const hasHeavy = heavyKeywords.some(re => re.test(prompt));
  if (hasHeavy) return { advise: false };

  return {
    advise: true,
    suggestion: "haiku",
    reason: `prompt looks like a lookup (${wordCount} words, lookup verb present, no heavy keywords)`,
  };
}

export { DEFAULT_CONFIG };
