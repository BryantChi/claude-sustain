# claude-sustain

> Token-efficiency rules, skill routing, enforcement hooks, and cross-platform `AGENTS.md` generation for sustainable long-term Claude Code use.

`claude-sustain` is a Claude Code plugin that turns the kind of "I should remember to do X" rules that usually live in a personal `CLAUDE.md` into an **enforced**, **measurable**, and **portable** layer:

- **Enforced** — `PreToolUse` / `UserPromptSubmit` / `Stop` hooks notice when you (or the agent) drift from the rules and surface a reminder before context is wasted.
- **Measurable** — the `Stop` hook reads the session JSONL transcript and prints a token tally, so "is this saving tokens?" is a question with an answer.
- **Portable** — a single `rules/spec.json` is the source of truth; generators emit `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` so the same rules work in Claude Code, Codex CLI, and Gemini CLI.

## What's in v0.1 (MVP)

- **Iron Rules (3+1)** — user intent first, subagent word caps + escape clause, repeated edits via `perl + git diff`, template-before-bulk habit.
- **R1–R5 detail rules** — file reading, searching, subagent hygiene, response style, general guidance.
- **Phase-end 6-question checklist** — surfaced automatically at every Stop event.
- **Skill routing table** — 16 scenarios mapped to the right skill (superpowers, claude-mem, mempalace, anthropic skills, etc.).
- **Cross-platform export** — `/sustain:export` writes `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` into any directory.
- **Warn-only enforcement** — hooks advise, never block. v0.2+ will offer a `strict` mode after we've collected real-world signal.

Coming in v1.0: memory backend abstraction (claude-mem **or** mempalace, both optional, with a structured filesystem fallback) and richer telemetry.

## Install

`claude-sustain` is distributed as a Claude Code plugin.

```text
/plugin marketplace add BryantChi/claude-sustain
/plugin install claude-sustain
```

After install, restart your Claude Code session. You should see a one-line primer in the SessionStart context and a phase-end checklist after Stop.

## Use

- `/sustain:status` — see the active rule set, skill routing coverage, and (when available) session token tally.
- `/sustain:export` — write `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` for the current project, generated from `rules/spec.json`.

## Configuration

Per-user overrides live in `~/.claude/sustain/overrides.json` (create it yourself; it never ships with the plugin). Anything in `overrides.json` wins over the plugin's bundled spec — the plugin **never silently overwrites** user configuration.

## Why "sustain"?

Most "rule" systems for AI coding fail one of two ways: they're too aggressive (the agent fights them, you lose more tokens than you save), or they're forgotten by mid-session because nothing notices. `sustain` aims for the durable middle: a small, hard core of rules (the Iron Rules), automatic noticers (hooks) that surface drift before it costs much, and a measurement loop that lets you tell whether it's working.

## Project status

Early — v0.1 is the MVP. Feedback on rule wording, hook ergonomics, and skill routing scenarios is welcome via GitHub issues.

## License

MIT. See `LICENSE`.

## Acknowledgements

- [superpowers](https://github.com/obra/superpowers) — plugin structure and hook conventions.
- [claude-mem](https://github.com/thedotmack/claude-mem) — memory backend (optional dependency in v1.0).
- [MemPalace](https://github.com/mempalace/mempalace) — alternative memory backend (optional, MIT-licensed).
- [AGENTS.md standard](https://agents.md/) — cross-platform rule file convention.
