# Changelog

All notable changes to claude-sustain will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
