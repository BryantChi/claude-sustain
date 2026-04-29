// Model-routing heuristic for Task subagent dispatches.
//
// Inspects a Task prompt and decides whether to suggest passing
// `model: "haiku"`. We never mutate the actual tool_input — hooks can't safely
// rewrite tool calls — but we surface the recommendation through systemMessage
// so the agent can pick it up on the next call.
//
// Heuristic (all must hold to advise haiku):
//   1. Word count below LOOKUP_WORD_LIMIT
//   2. Contains at least one lookup verb (find / list / locate / read / grep …)
//   3. Contains zero "heavy" keywords (design, refactor, implement, debug,
//      review, security, migration, refactoring, …)
//   4. The user has not already specified a model
//
// Returns one of:
//   { advise: false }
//   { advise: true, reason: string, suggestion: "haiku" }

const LOOKUP_WORD_LIMIT = 200;

const LOOKUP_VERBS = [
  /\bfind\b/i, /\blist\b/i, /\blocate\b/i, /\bgrep\b/i, /\bsearch\b/i,
  /\bread\b/i, /\bcheck\b/i, /\bcount\b/i, /\benumerate\b/i, /\binventory\b/i,
  /\bsurvey\b/i, /\bidentify\b/i, /\blookup\b/i,
  /查找/, /找出/, /列出/, /盤點/, /搜尋/, /檢查/, /讀取/, /統計/,
];

const HEAVY_KEYWORDS = [
  /\bdesign\b/i, /\brefactor/i, /\bimplement/i, /\brewrite\b/i,
  /\bdebug/i, /\breview\b/i, /\bsecurity\b/i, /\bcompliance\b/i,
  /\bmigrat/i, /\barchitect/i, /\bplan\b/i, /\bspec\b/i, /\bdesign doc\b/i,
  /設計/, /重構/, /實作/, /實做/, /除錯/, /審查/, /審核/, /安全/, /合規/,
  /架構/, /規劃/,
];

export function modelHint({ prompt = "", explicitModel = null } = {}) {
  if (explicitModel) return { advise: false };
  if (!prompt || typeof prompt !== "string") return { advise: false };

  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount === 0 || wordCount > LOOKUP_WORD_LIMIT) return { advise: false };

  const hasLookupVerb = LOOKUP_VERBS.some(re => re.test(prompt));
  if (!hasLookupVerb) return { advise: false };

  const hasHeavy = HEAVY_KEYWORDS.some(re => re.test(prompt));
  if (hasHeavy) return { advise: false };

  return {
    advise: true,
    suggestion: "haiku",
    reason: `prompt looks like a lookup (${wordCount} words, lookup verb present, no heavy keywords)`,
  };
}
