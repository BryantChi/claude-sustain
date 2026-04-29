# Changelog

All notable changes to claude-sustain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] — 2026-04-29

### Changed
- **Skill routing is now runtime-filtered.** Previously the full
  `spec.skillRouting` table (21 entries referencing superpowers / claude-mem
  / codex / gemini / Anthropic built-ins) was emitted into CLAUDE.md verbatim.
  On a clean Claude Code install with only claude-sustain present, ~13 of
  those entries pointed at plugins that weren't installed — Claude saw the
  routing instructions but couldn't execute them, resulting in silent
  degradation.
- SessionStart now invokes `lib/routing/filter.js → filterRouting(spec)`
  and injects only the *available* entries into `additionalContext`. The
  systemMessage shows `X/Y skill routes` so the user knows immediately what
  fraction of the routing menu is reachable.
- Generators (`render.js`) add a note to the static routing table in
  CLAUDE.md/AGENTS.md explaining that the SessionStart hook re-evaluates the
  table per session and skips unavailable entries silently.

### Added
- `lib/routing/match.js` — shared matcher used by both the audit (drift
  report) and the filter (runtime gating), so what the audit accepts is
  exactly what the filter shows.
- `lib/routing/filter.js` — partitions `spec.skillRouting` into
  `available[]` / `unavailable[]` against the installed skills + agents.
- 6 unit tests covering OR-clauses, arrow chains, Anthropic built-ins, and
  the `ns:name` ↔ `ns-name.md` agent convention.

## [0.3.1] — 2026-04-29

### Fixed
- Routing audit no longer flags Anthropic built-in skills (`claude-api`,
  `update-config`, `frontend-design`) as missing — they ship inside Claude
  Code itself and aren't on disk.
- Routing audit now scans plugin & user `agents/<name>.md` files alongside
  `skills/`, and resolves the `ns:name` → `ns-name.md` convention so
  routing tokens like `codex:rescue` and `gemini:rescue` correctly match
  `codex-rescue.md` / `gemini-rescue.md`.

### Added
- Four new skill routing entries:
  - `superpowers:receiving-code-review` — applying review feedback.
  - `superpowers:executing-plans` — running an existing plan with checkpoints.
  - `superpowers:using-git-worktrees` — isolated workspace for risky work.
  - `superpowers:finishing-a-development-branch` — merge / PR / cleanup.

## [0.3.0] — 2026-04-29

### Added
- M6 audit subsystem (never auto-deletes — produces a report the user reviews):
  - `lib/audit/memory.js` — flags drawers stale > 90 days, near-duplicate
    slugs (bigram Jaccard ≥ 0.7) within the same wing, and extracts URLs
    for manual verification.
  - `lib/audit/routing.js` — scans `~/.claude/skills` and every plugin's
    `skills/` dir, diffs against `spec.skillRouting`, reports missing
    references and unrouted installations.
  - `lib/audit/migrate.js` — fs → mempalace migration plan builder; writes
    `~/.claude/sustain/migration-plan.json` with one suggested
    `mcp__mempalace__store` call per drawer for the model to execute.
- `audit-memory` skill — walks the user through audit results, never
  deletes without explicit consent, batches stale items.
- `/sustain:audit` command — runs both scanners and routes to the skill.

## [0.2.0] — 2026-04-29

### Added
- M3 user-facing skills:
  - `memory-write-router` — decide whether and where to persist a learning;
    routes through the active backend (mempalace MCP / claude-mem MCP / fs).
  - `memory-search-bridge` — "how did we solve X before?" lookups across
    mempalace MCP, claude-mem MCP, and the fs grep fallback.
  - `token-budget-coach` — reads token stats and recommends `/compact`,
    subagent delegation, model switch, or session reset.
- M5 telemetry:
  - `lib/telemetry.js` — Stop hook now appends per-phase token snapshot to
    `~/.claude/sustain/telemetry/<YYYY-MM-DD>.jsonl`; reader exposes
    `movingAverage({ sinceDays })` for trend analysis.
  - `/sustain:status` upgraded to read telemetry and surface 7-day averages
    against the current session.
- M2/M7 memory subsystem foundation:
  - `lib/memory/detect.js` — filesystem-based probe for mempalace and
    claude-mem in `~/.claude/plugins/cache/`, with env-var overrides
    (`CLAUDE_SUSTAIN_FORCE_BACKEND`, `CLAUDE_SUSTAIN_MEMPALACE_PATH`,
    `CLAUDE_SUSTAIN_CLAUDE_MEM_PATH`).
  - `lib/memory/backends/fs.js` — durable, license-clean fallback. Stores
    drawers under `~/.claude/sustain/memory/wings/<wing>/drawers/<date>-<slug>.md`
    using mempalace-compatible structure (wings/rooms/drawers) so a future
    upgrade can import these files without restructuring.
  - `lib/memory/backends/{claude-mem,mempalace}.js` — guidance-only adapters
    that route the model to the appropriate MCP search tools when a richer
    backend is detected. **Plugin code never imports either project**, which
    keeps us clear of claude-mem's AGPL-3.0.
  - `lib/memory/adapter.js` — unified `write` / `query` interface. Always
    persists to fs; mirrors via guidance hint when a richer backend is
    preferred.
  - `lib/memory/state.js` — `~/.claude/sustain/state.json` cache of the
    last detection result.
- SessionStart hook now refreshes detection every startup and surfaces the
  active backend in both the user-visible `systemMessage` and the Claude
  context primer.

## [0.1.1] — 2026-04-28

### Changed
- Hooks now emit a user-visible `systemMessage` so the SessionStart primer,
  Iron-1 keyword detection, Iron-2 advisory, and Stop phase-end checklist
  all appear directly in the chat transcript instead of only landing in
  Claude's hidden context. Stop hook moved off `stderr` (which was
  invisible) onto `systemMessage` for the same reason.

## [0.1.0] — 2026-04-28

Initial MVP release.

### Added
- M1 Token Rules Core: `rules/spec.json` as single source of truth for Iron Rules (3+1) and R1–R5
- M3 Skill Routing: scenario → skill table embedded in spec
- M4 Enforcement Hooks (warn-only):
  - `PreToolUse` (Task matcher) — warns when subagent prompt lacks word cap
  - `UserPromptSubmit` — detects Iron-1 keywords (逐個/仔細/全部/thoroughly/each/all) and injects reminder
  - `Stop` — prints 6-question phase-end checklist
  - `SessionStart` — injects rules primer
- M8 Cross-platform: generators for `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` from `spec.json`
- `/sustain:export` command to write the three markdowns into a target directory
- Skills: `token-rules-primer`, `phase-self-check`
- CI lint to prevent personal-path leakage
