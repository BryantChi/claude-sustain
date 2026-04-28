---
name: memory-write-router
description: Decide whether and where to persist a learning. Use at phase boundaries when something seems worth long-term memory — a rule, a non-obvious decision, an external resource, or a project-state change. Picks the right wing (feedback / project / reference / user) and routes through the user's active memory backend.
---

# Memory Write Router

Use this skill when you've just finished a phase and noticed something worth keeping across conversations.

## Step 1 — Decide if it's worth saving

Skip if any of these hold:
- It's already in `~/.claude/CLAUDE.md` or another project-level config.
- It's derivable from `git log`, `git blame`, or current code.
- It's ephemeral (in-progress task state, debug breadcrumb, current-conversation context).

Save if any of these hold:
- The user corrected your approach — and the correction would still apply in a future conversation.
- The user accepted a non-obvious approach without pushback (silent confirmation).
- You learned a fact about the user's role, preferences, or how they want to collaborate.
- You learned a project fact (timeline, ownership, motivation) that won't be in the code.
- You discovered an external system pointer (Linear project, Slack channel, dashboard URL).

## Step 2 — Pick the wing

| Wing | When to use |
| --- | --- |
| `user` | Facts about who the user is — role, expertise, what they're optimizing for. |
| `feedback` | "Don't do X" / "Always do Y" — corrections AND validated approaches. Include `**Why:**` and `**How to apply:**`. |
| `project` | Time-bound facts about ongoing work — deadlines, decisions, motivations. Convert relative dates to absolute. |
| `reference` | Pointers to external systems and what they're for. |

## Step 3 — Route through the active backend

Read `~/.claude/sustain/state.json` (`detection.preferred`) to see which backend is active:

- `mempalace` — primary backend. Use the mempalace MCP write tool (e.g. `mcp__mempalace__store` or its equivalent) and pass the body verbatim. **Then also** mirror to fs (mempalace-shaped wings/rooms/drawers makes a future migration trivial).
- `claude-mem` — observations are captured automatically; you typically don't need to write explicitly. If the learning is high-signal, surface it as a clear sentence in your reply so claude-mem will capture it.
- `fs` — write directly. Suggested layout:

```
~/.claude/sustain/memory/wings/<wing>/drawers/<YYYY-MM-DD>-<slug>.md
```

with frontmatter:

```yaml
---
wing: feedback
slug: dont-mock-database
created: <ISO timestamp>
---
```

The plugin's `lib/memory/adapter.js` `write({ wing, slug, body })` does this for you and produces a guidance hint when a richer backend is preferred. You can run it via `node -e "import('./lib/memory/adapter.js').then(m => m.write({...}))"` from the plugin root, or use the analogous pattern in your environment.

## Step 4 — Write a tight body

- Lead with the rule/fact in one sentence.
- Add a `**Why:**` line — the reason the user gave (often a past incident or strong preference).
- Add a `**How to apply:**` line — when this guidance kicks in.
- Knowing **why** lets a future you judge edge cases instead of blindly following the rule.

If the memory is just a pointer to an external system, skip Why/How and write what it's for.

## Step 5 — Don't duplicate

Before writing, check whether a similar entry already exists (use `memory-search-bridge`). If yes, update it instead of creating a duplicate.
