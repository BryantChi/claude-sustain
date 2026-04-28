# Token Efficiency & Sustainable AI Use

> AGENTS.md generated from `claude-sustain/rules/spec.json` v0.1.0.
> This file follows the AGENTS.md cross-platform standard (agents.md).

## Language
- Detect the user's language from their message and respond in the same language.
- Default: English.
- Code comments, identifiers, and git commits remain in English.

---

## Token Efficiency

All rules below are mandatory for the agent in every session. Goal: minimize token waste while preserving user intent.

### Iron Rules (3+1) — top priority

These override the detailed rules below when in conflict.

- **IRON-1 — User intent first**: When the user message contains keywords that signal exhaustive work — "逐個 / 仔細 / 全部 / 不要省略 / 都要確認 / thoroughly / each / all / every" — or the task is security-related, take the original path. Do not apply any shortcut: no templating, no batching, no parallelization, no sampling.
- **IRON-2 — Subagent prompts must include word cap and escape clause**: When dispatching a subagent, include both: (a) a word cap appropriate to the task — pure check ≤ 200 / structural inventory ≤ 800 / deep analysis or code review ≤ 2000 — and (b) an escape clause: "But if you find anomalies or significant issues, report them in full regardless of the cap."
- **IRON-3 — Repeated regex edits use perl + git diff**: When the same string replacement is needed twice or more, switch from per-file edits to `perl -i -pe 's|old|new|g' file1 file2 ...` (cross-platform consistent; avoid `sed` whose flags differ between macOS and GNU). Immediately run `git diff` for human review.
- **HABIT-1 — Template before bulk**: Before executing N similar tasks, ask: "What is the largest common factor? Can this be templated?" If yes, write a template, validate it on one sample, then bulk-produce the rest (parallel sub-agents are fine). If no, do them one by one as originally planned. This is a habit, not a hard rule — when in doubt, fall back to per-task work.

**Phase-end self-check**:
1. Does the user's intent contain "逐個 / 仔細 / 全部 / thoroughly / each / all"? If yes, Iron-1 is active — skip all shortcuts for the rest of this phase.
2. About to call (or just called) a subagent? Apply Iron-2 — write the word cap and escape clause into the prompt.
3. About to repeat the same edit? From the second occurrence onward, switch to perl + git diff (Iron-3).
4. Planning N similar tasks? Look for the common factor; if templatable, validate on one sample first.
5. Phase boundary or context growing large? Consider /compact to clear early raw output.
6. Anything from this phase worth long-term memory (rule, decision, external resource, project-state change)? Persist it as feedback / project / reference.

### Skill / Tool Routing

| Scenario | Use |
| --- | --- |
| Debugging / bug / failing test / unexpected behavior | `superpowers:systematic-debugging` |
| New feature, new component, behavior change (any creative work) | `superpowers:brainstorming → superpowers:writing-plans` |
| Have a spec, need a multi-step plan | `superpowers:writing-plans` |
| Writing tests / TDD | `superpowers:test-driven-development` |
| 2+ independent tasks runnable in parallel | `superpowers:dispatching-parallel-agents` |
| Before claiming done / fixed / passing | `superpowers:verification-before-completion` |
| Major phase complete, want review | `superpowers:requesting-code-review` |
| Cross-session lookup ("how did we solve X before?") | `claude-mem:mem-search OR mempalace MCP search` |
| Structural code navigation (avoid reading whole files) | `claude-mem:smart-explore` |
| Stuck, want second opinion | `codex:rescue OR gemini:rescue` |
| Frontend UI / component design | `frontend-design` |
| Anthropic SDK / Claude API | `claude-api` |
| Configure hooks / permissions | `update-config` |
| Token budget interpretation, compact decisions | `claude-sustain:token-budget-coach` |
| End-of-phase 6-question check | `claude-sustain:phase-self-check` |
| Decide whether and where to persist a learning | `claude-sustain:memory-write-router` |

### R1: File Reading

| Rule | Detail |
| --- | --- |
| R1.1 | NEVER read a full file blindly. Use `offset` + `limit` to target the needed section. |
| R1.2 | Before reading, check if the content is already in context. |
| R1.3 | Files > 200 lines: read only the relevant function/block, not the whole file. |
| R1.4 | Use AST-level structural navigation tools (e.g., claude-mem:smart-explore) to avoid reading entire files when only structure is needed. |
| R1.5 | For cross-session memory queries ("how did we solve X before?"), use a memory backend (claude-mem, mempalace, or the file-based fallback) instead of re-searching the codebase. |

### R2: Searching

| Rule | Detail |
| --- | --- |
| R2.1 | First pass: Grep with `output_mode: "files_with_matches"` to locate files. |
| R2.2 | Second pass: Read only the matched files/sections. |
| R2.3 | Set `head_limit` to actual need (10–20 for targeted, not the default 250). |
| R2.4 | Always use `glob` or `type` filters to narrow scope. |
| R2.5 | Use specific patterns. Avoid broad regex that floods results. |

### R3: Subagents

| Rule | Detail |
| --- | --- |
| R3.1 | Delegate exploration / research to subagents to protect main context. |
| R3.2 | Use the Explore agent for codebase navigation. |
| R3.3 | Use a smaller model (e.g. haiku) for simple lookups that do not need deep reasoning. |
| R3.4 | Never duplicate work a subagent is already doing. |
| R3.5 | Trust but verify — subagent reports can hallucinate (guessing from filenames). Read the source file once before relying on a critical conclusion. |

### R4: Responses

| Rule | Detail |
| --- | --- |
| R4.1 | Be concise. Don't echo file contents back unless asked. |
| R4.2 | No preambles ("Let me...", "Sure...", "I'll now..."). |
| R4.3 | No lengthy explanations unless requested. Short, actionable answers. |

### R5: General

| Rule | Detail |
| --- | --- |
| R5.1 | Don't re-search for things already in context. |
| R5.2 | Batch independent tool calls in parallel. |
| R5.3 | Prefer Edit over Write for existing files (diff only). |
| R5.4 | Prefer Glob/Grep over a shell command for file search and content search. |
