---
name: token-budget-coach
description: Interpret session token statistics and recommend the next move — /compact, delegate to a subagent, switch to a smaller model, or stop and persist learnings. Use after `/sustain:status`, when the session feels long, or when context-window pressure is showing up in degraded responses.
---

# Token Budget Coach

Use this skill when there's a token-usage signal worth acting on. Sources of signal:

- `/sustain:status` output (session token tally + cache hit rate).
- The Stop hook's per-phase `tokens:` line.
- Subjective drift: responses getting vaguer, references to earlier turns failing.

## Reading the numbers

The session JSONL records four token streams:

| Field | What it is | What to optimize |
| --- | --- | --- |
| `input_tokens` | Fresh prompt tokens (not cached). | Fewer is better. Driven by file reads and tool-result echoes. |
| `cache_creation_input_tokens` | New cache writes. | Spikes early; should plateau. |
| `cache_read_input_tokens` | Cached prompt reuse. | **Higher is better** — the prompt cache is paying off. |
| `output_tokens` | Generated tokens. | Bound by R4 (concise responses); large output usually means a long search/summary should have been a subagent. |

**Cache hit rate** = `cache_read / (cache_read + cache_creation + input)`. Healthy long sessions: > 70%.

## Decision tree

```
Is cache hit rate < 50% AND session is long?
├─ Probably context churn (lots of new file reads / re-searches).
│  → Fix R5.1: re-read what's already in context instead of re-searching.
│  → Apply R1.1/R1.3: offset+limit reads, not full files.

Is output_tokens of any single turn > ~5K?
├─ You echoed a file or wrote a long explanation.
│  → R4.1/R4.3 — be concise. If it was a search summary, delegate to a subagent next time.

Is input_tokens climbing turn over turn (no plateau)?
├─ Context is filling with raw tool output.
│  → Time to /compact at the next phase boundary.
│  → Or dispatch the remaining work to a subagent (R3.1) so the bulk lives in *its* context.

Is the user's task long-running and we've just finished a phase?
├─ → Apply phase-self-check (the 6 questions).
│  → Especially Q5 (compact?) and Q6 (anything worth saving as memory?).
```

## Concrete moves, in order of cost

1. **Free** — switch to `subagent_type: "Explore"` for the next codebase question. Bulk discovery happens in their context, not yours.
2. **Free** — use `model: "haiku"` for a simple lookup (R3.3).
3. **Cheap** — `/compact` at the next natural phase boundary (don't compact mid-task — Iron-1 friction).
4. **Cheap** — persist current learnings via `memory-write-router` then `/clear` and resume in a fresh session with the search-bridge.
5. **Last resort** — stop and write a plan, then start a new session against the plan.

## Anti-patterns

- Calling `/compact` reflexively every N turns. Compaction has a cost (it summarises, dropping detail). Use it when the data shows pressure, not on a clock.
- Switching to haiku mid-debugging. R3.3 is for lookups, not reasoning.
- Persisting "what I just did" as memory. That's git-history's job. Persist only durable rules / project facts / external pointers (see `memory-write-router`).
