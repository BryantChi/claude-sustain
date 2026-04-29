---
name: audit-memory
description: Walk through stale or conflicting memory entries and routing-table drift. Use when the user runs /sustain:audit, asks "is my memory store healthy?", or before a major release of personal rules.
---

# Memory & Routing Audit

This skill processes the report produced by `/sustain:audit` and helps the user act on it. **Never auto-deletes anything** — the user reviews every change.

## Inputs

`/sustain:audit` runs two scans and prints a JSON-ish report:

1. **Memory audit** (`lib/audit/memory.js → audit()`):
   - `stale[]` — drawers not modified in > 90 days
   - `duplicates[]` — pairs of drawers with similar slugs in the same wing
   - `urls[]` — URLs extracted from drawers (not fetched — verify yourself if suspect)

2. **Routing audit** (`lib/audit/routing.js → audit(spec)`):
   - `listedButMissing[]` — `spec.skillRouting` references a skill that isn't installed
   - `installedButUnrouted[]` — installed skill that no routing entry mentions

## Walk the user through each section

### Stale entries

For each item in `stale`:
1. Read the drawer (`Read` tool, the `path` field).
2. Decide one of:
   - **Keep** — the rule/fact still applies; touch the file (`utime`) to reset the clock, or just acknowledge.
   - **Update** — the rule still applies but needs editing (e.g. a deadline shifted).
   - **Delete** — outdated; remove the file.
3. Ask the user before deleting. Show what's being deleted.

Don't ask one question per drawer for sessions with many stale entries — batch into a list and let the user mark them in one message.

### Duplicates

For each pair in `duplicates`:
1. Read both drawers.
2. If they're truly the same idea — merge into one (keep the better-written one, delete the other).
3. If they're different despite similar slugs — rename one for clarity.

### URLs

Extract dead-URL candidates from `urls`. Suspect signals:
- `localhost`, `127.0.0.1`, internal hosts that may have moved.
- Old service domains the user has migrated away from.

Ask the user before fetching — `WebFetch` has a cost and the user may already know which ones are dead.

### Routing drift

For `listedButMissing`:
- Some entries are *intentionally* MCP-tool references (e.g. `claude-mem:smart-explore` is an MCP search tool, not a filesystem skill). Check the `notes` field of the audit report.
- For real misses, either install the missing skill or remove the routing entry from `spec.json`.

For `installedButUnrouted`:
- Skip skills that are intentionally not routed (e.g. `using-superpowers` itself).
- For genuinely useful skills, propose adding a routing entry to `spec.json` and ask the user whether the scenario fits their workflow.

## Closing

After processing, suggest the user re-run `/sustain:audit` to confirm the report is empty (or has only known-acceptable noise). If the user has mempalace newly installed, mention `lib/audit/migrate.js → buildPlan()` for one-shot fs → mempalace import.
