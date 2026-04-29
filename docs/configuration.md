# Configuration

`claude-sustain` reads configuration from three places, in priority order:

1. **Environment variables** — process-level overrides (highest).
2. **`~/.claude/sustain/overrides.json`** — user-level overrides for the rule spec.
3. **`rules/spec.json` inside the plugin** — bundled defaults (lowest).

## Environment variables

| Variable | Purpose |
| --- | --- |
| `CLAUDE_SUSTAIN_FORCE_BACKEND` | Force memory backend: `mempalace` / `claude-mem` / `fs`. Bypasses auto-detection. |
| `CLAUDE_SUSTAIN_MEMPALACE_PATH` | Absolute path to a non-standard MemPalace install directory. |
| `CLAUDE_SUSTAIN_CLAUDE_MEM_PATH` | Absolute path to a non-standard claude-mem install directory. |
| `CLAUDE_PLUGIN_ROOT` | Set automatically by Claude Code; identifies the plugin's install directory. |

Example:

```sh
export CLAUDE_SUSTAIN_FORCE_BACKEND=fs
```

Useful when you want to test the structured-filesystem fallback without uninstalling other backends, or when running tests against a controlled environment.

## `overrides.json` — user-level rule customization

**Location**: `~/.claude/sustain/overrides.json`

**Purpose**: tweak any part of the bundled `spec.json` without modifying the plugin directory. The plugin's spec lives in `~/.claude/plugins/cache/<owner>/claude-sustain/<version>/rules/spec.json` and is overwritten on `/plugin update`. `overrides.json` survives.

### Schema

A partial `spec.json`. Only put what you want to change.

```jsonc
{
  "ironRules": [
    {
      "id": "iron-1",
      "body": "My customized iron-1 wording. Keep the id; change anything else."
    }
  ],
  "phaseChecklist": [
    {
      "id": "p7",
      "question": "Does this phase touch billing? If yes, double-check the audit trail."
    }
  ],
  "skillRouting": [
    {
      "when": "Debugging / bug / failing test / unexpected behavior",
      "use": "my-team:bug-tracker → superpowers:systematic-debugging",
      "source": "team"
    },
    {
      "when": "New scenario unique to my project",
      "use": "my-skill:foo",
      "source": "team"
    }
  ],
  "details": {
    "R1": {
      "rules": [
        { "id": "R1.1", "text": "My team's customized R1.1 wording." }
      ]
    }
  }
}
```

### Merge semantics

| Field | Behavior |
| --- | --- |
| `ironRules`, `phaseChecklist` | Match by `id`. Override entry replaces matching bundled entry; new ids appended; unmatched bundled entries preserved. |
| `skillRouting` | Match by `when` (the scenario string). Same replace-or-append rule. |
| `details.R<n>.rules` | Match by `id` (e.g. `R1.1`). |
| `metadata.*`, `version` | User wins. |
| `memoryBackends` | User block replaces bundled wholesale (rare to override). |

Any merged spec carries an `_appliedOverrides: true` marker so downstream code (and `/sustain:status`) can show that customization is active.

### Example flows

**Add a rule without removing any bundled rule**:
```jsonc
{ "ironRules": [{ "id": "iron-99", "title": "...", "summary": "...", "body": "..." }] }
```

**Customize one R-rule's wording**:
```jsonc
{ "details": { "R1": { "rules": [{ "id": "R1.3", "text": "Files > 500 lines: ..." }] } } }
```

**Replace a routing entry**:
```jsonc
{ "skillRouting": [{ "when": "Debugging / bug / failing test / unexpected behavior", "use": "my-team:debug-skill" }] }
```

## File locations

| Path | Writer | Purpose |
| --- | --- | --- |
| `rules/spec.json` (in plugin dir) | plugin maintainer | Bundled defaults — never edit on user side. |
| `~/.claude/sustain/overrides.json` | user (manually or via `/sustain:update-rules`) | User-level rule overrides. |
| `~/.claude/sustain/state.json` | `hooks/session-start.js` | Cached memory backend detection. |
| `~/.claude/sustain/memory/` | `lib/memory/backends/fs.js` | Filesystem memory store. |
| `~/.claude/sustain/telemetry/<date>.jsonl` | `hooks/stop.js` via `lib/telemetry.js` | Per-Stop token snapshots. |
| `~/.claude/sustain/migration-plan.json` | `lib/audit/migrate.js` | fs → mempalace upload plan (only when audit builds it). |

## Hooks configuration

`hooks/hooks.json` is fixed by the plugin — don't edit. It registers five lifecycle handlers:

- `SessionStart` — `node hooks/session-start.js`
- `UserPromptSubmit` — `node hooks/user-prompt-submit.js`
- `PreToolUse` (matcher: `Task`) — `node hooks/pre-tool-use.js`
- `Stop` — `node hooks/stop.js`
- `SessionEnd` — `node hooks/session-end.js`

If you need to disable one, the recommended way is to use Claude Code's per-hook disable mechanism (in `~/.claude/settings.json` under `hooks.disabled`) rather than editing the plugin.

## Skill / command discovery

Claude Code automatically discovers skills (`skills/<name>/SKILL.md`) and commands (`commands/<name>.md`) from any installed plugin. No additional configuration needed.

## Memory backend selection

By default, claude-sustain auto-detects:

1. If `CLAUDE_SUSTAIN_FORCE_BACKEND` is set → use that (or fall back to `fs` if forced backend isn't installed).
2. Otherwise, prefer **MemPalace** if installed (MIT, primary).
3. Otherwise, prefer **claude-mem** if installed (AGPL-3.0, secondary, referenced via MCP only).
4. Otherwise, use the **filesystem fallback** at `~/.claude/sustain/memory/`.

The detected backend is cached in `~/.claude/sustain/state.json` and refreshed every `SessionStart`.

## Updating rules without losing customizations

```text
/sustain:update-rules
```

This command:
1. Fetches the latest `rules/spec.json` from `https://github.com/BryantChi/claude-sustain` via `WebFetch`.
2. Diffs it against your bundled spec.
3. For each user-accepted change, writes to `~/.claude/sustain/overrides.json` (never to the plugin directory).
4. Your manual `overrides.json` entries are preserved by the same id-aware merge.

## Disabling the plugin temporarily

```text
/plugin disable claude-sustain
```

Re-enable with `/plugin enable claude-sustain`. Overrides and memory data persist across disable/enable cycles.

## Uninstalling

```text
/plugin uninstall claude-sustain@claude-sustain
```

This removes the plugin install but **leaves `~/.claude/sustain/` intact** — your memory store, telemetry log, and overrides are preserved. Delete the directory manually if you want a clean slate.
