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
| `CLAUDE_SUSTAIN_CONFIG_DIR` | Override the location of `strict.json` / `notify.json` / `notify-state.json`. Default `~/.claude/sustain/`. Mainly for tests. |

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

## `strict.json` — Iron-2 hard-gate (v0.6+)

**Location**: `~/.claude/sustain/strict.json`

**Purpose**: opt in to a hard gate on Iron-2. When enabled, the `PreToolUse` hook denies any `Task` invocation whose prompt is missing the word cap or escape clause, unless the prompt contains a string listed in `bypassPatterns`.

```jsonc
{
  "ironGate": false,
  "bypassPatterns": ["#bypass-iron2", "Explore agent — discovery only"]
}
```

| Field | Behavior |
| --- | --- |
| `ironGate` | When `true`, missing cap/escape returns `permissionDecision=deny`. When `false` (default), v0.5 warn-only behavior is preserved. |
| `bypassPatterns` | Array of substrings. If any appears in the Task prompt, the gate is skipped (warning is still emitted). Useful for trusted internal Task templates. |

The gate runs before the model-routing hint, so a denied Task never produces a haiku suggestion.

## `notify.json` — Stop-hook notification webhook (v0.6+)

**Location**: `~/.claude/sustain/notify.json`

**Purpose**: post a short summary to a Slack / Discord / Telegram / generic webhook when a session crosses a token or duration threshold. Best-effort: errors and timeouts never block `Stop`.

```jsonc
{
  "webhook": "https://hooks.slack.com/services/XXX/YYY/ZZZ",
  "format": "slack",
  "threshold": {
    "tokenTotal": 100000,
    "durationMs": 600000
  },
  "minIntervalMs": 60000
}
```

| Field | Behavior |
| --- | --- |
| `webhook` | HTTPS endpoint. Required; if missing the dispatcher is a no-op. |
| `format` | One of `slack` / `discord` / `telegram` / `raw`. Determines the payload shape. |
| `threshold.tokenTotal` | Fire when (input + output + cache_creation + cache_read) ≥ this. `0` disables this trigger. |
| `threshold.durationMs` | Fire when session wall-clock ≥ this (parsed from the transcript JSONL). `0` disables. |
| `minIntervalMs` | Rate-limit between consecutive notifications. Default `60000` (1 minute). |

State (last-fire timestamp, last status code, last error) is written to `~/.claude/sustain/notify-state.json` and used to enforce `minIntervalMs`.

## File locations

| Path | Writer | Purpose |
| --- | --- | --- |
| `rules/spec.json` (in plugin dir) | plugin maintainer | Bundled defaults — never edit on user side. |
| `~/.claude/sustain/overrides.json` | user (manually or via `/sustain:update-rules`) | User-level rule overrides. |
| `~/.claude/sustain/state.json` | `hooks/session-start.js` | Cached memory backend detection. |
| `~/.claude/sustain/memory/` | `lib/memory/backends/fs.js` | Filesystem memory store. |
| `~/.claude/sustain/telemetry/<date>.jsonl` | `hooks/stop.js` via `lib/telemetry.js` | Per-Stop token snapshots. |
| `~/.claude/sustain/migration-plan.json` | `lib/audit/migrate.js` | fs → mempalace upload plan (only when audit builds it). |
| `~/.claude/sustain/strict.json` | user | Iron-2 hard-gate switch + bypass list (v0.6+). |
| `~/.claude/sustain/notify.json` | user | Stop-hook notification webhook config (v0.6+). |
| `~/.claude/sustain/notify-state.json` | `lib/notify.js` | Last-notification timestamp for rate limiting (v0.6+). |

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
