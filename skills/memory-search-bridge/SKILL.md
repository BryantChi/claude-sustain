---
name: memory-search-bridge
description: Search persistent memory across mempalace MCP, claude-mem MCP, and the structured filesystem fallback. Use when the user asks "how did we solve X before?", "what did we decide about Y?", or anything that implies recalling prior-conversation context.
---

# Memory Search Bridge

Use this skill when the user references prior decisions, prior fixes, or anything that should already be persisted.

## Step 1 — Determine the active backend

Read `~/.claude/sustain/state.json` and check `detection.preferred`. The plugin's SessionStart hook refreshes this every session.

## Step 2 — Route the search

### `mempalace` preferred
Use mempalace's MCP search tools. Common entry points:

- `mcp__mempalace__search` — query across all wings.
- `mcp__mempalace__list_wings` — get a wing inventory if the user asked about a category rather than a fact.
- `mcp__mempalace__get_drawer` — fetch a specific entry by id when you know it.

Mempalace stores **verbatim** entries — show the matching content directly; no need to summarise unless the user asks.

### `claude-mem` preferred
Use claude-mem's MCP search tools (namespace `mcp__plugin_claude-mem_mcp-search__`):

- `smart_search` — best general-purpose entry point.
- `search` — keyword search.
- `smart_outline` / `smart_unfold` — when the user wants structure or to drill down.
- `timeline` — when the user is asking "when did we…".
- `get_observations` — fetch raw observations by id.

claude-mem returns **compressed observations**; if a result feels paraphrased and the user needs verbatim, fall back to fs (which mirrors recent writes) before grepping the codebase.

### `fs` preferred (or as fallback after either of the above)
Search `~/.claude/sustain/memory/`:

```
grep -rli "<keyword>" ~/.claude/sustain/memory/wings/ | head -20
```

or use the plugin's adapter:

```js
import { query } from "<plugin-root>/lib/memory/adapter.js";
query({ text: "your query", wing: "feedback" /* optional */ });
```

The adapter returns hits with excerpts and (when a richer backend is preferred but the call landed here) a routing suggestion you should also try.

## Step 3 — If nothing found

Before searching the codebase from scratch, consider:

- Was the original question answered in the **current** conversation? If the user says "earlier" they may mean earlier in this session — re-read recent turns first (R5.1).
- Could it be in `~/.claude/projects/<project>/memory/MEMORY.md`? That's the user's auto-memory, separate from the plugin's store.
- Could it be in the user's `~/Documents/AI/` notes? Sometimes durable knowledge lives in long-form markdown rather than memory entries.

Only after these turn up empty, search the codebase or ask the user to refresh your memory.

## Step 4 — Trust but verify

Memory backends can return stale entries. If a recalled fact contradicts current code or git state, **trust what you observe now** and update or delete the stale memory rather than acting on it (R3.5 logic applied to memory).
