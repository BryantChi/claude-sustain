---
name: token-rules-primer
description: Establish Iron Rules (3+1) and R1–R5 token-saving rules at session start or whenever the rules feel forgotten. Use when user asks about token efficiency, when rules need re-grounding, or proactively at the start of complex multi-turn work.
---

# Token Rules Primer

The full rule set is generated from `claude-sustain/rules/spec.json`. Apply these in priority order:

## Iron Rules (override detailed rules when in conflict)

1. **Iron-1 — User intent first.** If the user says 「逐個 / 仔細 / 全部 / 不要省略 / 都要確認 / thoroughly / each / all / every」, or the task is security-related, take the original path. No templating, batching, parallelization, or sampling.
2. **Iron-2 — Subagent prompts must include a word cap and an escape clause.** Caps: pure-check ≤ 200 / structural inventory ≤ 800 / deep analysis or code review ≤ 2000. Escape clause: "But if you find anomalies or significant issues, report them in full regardless of the cap."
3. **Iron-3 — Repeated regex edits use perl + git diff.** From the second identical edit onward, switch to `perl -i -pe 's|old|new|g' files...` and verify with `git diff`.
4. **Habit — Template before bulk.** When planning N similar tasks, ask "what's the largest common factor?" If templatable, validate one sample first.

## Detailed rules

- **R1 (File reading)**: never read full files blindly; use offset/limit; check if content is already in context; >200 lines → read only the relevant block; use AST-level navigation for structure.
- **R2 (Searching)**: Grep `files_with_matches` first → read matched sections only; tight `head_limit`; always use glob/type filters.
- **R3 (Subagents)**: delegate exploration; use Explore agent; haiku for simple lookups; trust but verify (subagent reports may hallucinate from filenames).
- **R4 (Responses)**: concise, no preambles, no lengthy explanations unless asked.
- **R5 (General)**: don't re-search what's in context; batch parallel tool calls; prefer Edit over Write; prefer Glob/Grep over shell.

## Phase-end self-check

At every phase boundary, ask:

1. Does the user's intent contain "逐個 / 仔細 / 全部 / thoroughly"? → Iron-1 active, skip shortcuts.
2. About to / just called a subagent? → Iron-2: write cap + escape clause.
3. Repeating the same edit? → 2nd time onward, switch to perl + git diff.
4. Planning N similar tasks? → Look for common factor; if templatable, sample-validate first.
5. Phase boundary, context growing? → Consider /compact.
6. Anything worth long-term memory? → Persist (feedback / project / reference).
