# Changelog

All notable changes to claude-sustain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — 2026-04-29

### Added
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
