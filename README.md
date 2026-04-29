# claude-sustain

> Token-efficiency rules, skill routing, enforcement hooks, memory subsystem, audit, and cross-platform `AGENTS.md` generation for sustainable long-term Claude Code use.

`claude-sustain` is a Claude Code plugin that turns the "I should remember to do X" rules that usually live in a personal `CLAUDE.md` into an **enforced**, **measurable**, **portable**, and **healthy-over-time** layer:

- **Enforced** — `PreToolUse` / `UserPromptSubmit` / `Stop` / `SessionStart` hooks surface a reminder when you (or the agent) drift from the rules, before context is wasted.
- **Measurable** — the `Stop` hook tallies session tokens and writes a daily JSONL telemetry log; `/sustain:status` shows a 7-day moving average so "is this saving tokens?" has an answer.
- **Portable** — a single `rules/spec.json` is the source of truth; generators emit `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` so the same rules work in Claude Code, Codex CLI, and Gemini CLI.
- **Self-healing** — `/sustain:audit` flags stale memory entries, near-duplicate slugs, and skill-routing drift. Routing is **runtime-filtered**: entries pointing at uninstalled plugins are silently skipped instead of degrading to no-ops.

## Features

### Rules (always on)

- **Iron Rules (3+1)** — user intent first, subagent word caps + escape clause, repeated edits via `perl + git diff`, template-before-bulk habit. Override the detailed rules below when in conflict.
- **R1–R5 detail rules** — file reading, searching, subagent hygiene, response style, general guidance. ~25 specific guidelines across the five families.
- **6-question phase-end checklist** — surfaced automatically on every `Stop` event so phase boundaries don't slip past.

### Skill routing (runtime-filtered)

A curated table mapping scenarios to skills/agents (`spec.skillRouting`). On every `SessionStart` the table is filtered against what's actually installed on the current machine — entries whose target plugin is missing are hidden, so a clean Claude Code install with only `claude-sustain` doesn't see broken references. Run `/sustain:audit` to inspect drift between the table and your install.

### Memory subsystem

- **Multi-backend abstraction** — auto-detects [MemPalace](https://github.com/mempalace/mempalace) (MIT, primary) and [claude-mem](https://github.com/thedotmack/claude-mem) (AGPL-3.0, secondary, referenced via MCP only — never statically linked) at every `SessionStart`; falls back to a durable structured filesystem store at `~/.claude/sustain/memory/` modeled after MemPalace's wings/rooms/drawers.
- **Skills**: `memory-write-router` (where to persist), `memory-search-bridge` ("how did we solve X before?"), `audit-memory` (stale/duplicate hygiene).
- **Migration helper**: `lib/audit/migrate.js → buildPlan()` produces an upload plan when MemPalace becomes installed.

### Telemetry

- `Stop` hook appends per-phase tokens to `~/.claude/sustain/telemetry/<YYYY-MM-DD>.jsonl`.
- `lib/telemetry.js → movingAverage({ sinceDays })` — used by `/sustain:status` for trend analysis.
- `token-budget-coach` skill — interprets the numbers and recommends `/compact` / subagent / model switch.

### Audit

- `/sustain:audit` runs two scanners and reports without ever auto-deleting:
  - **Memory audit** — drawers stale > 90 days, near-duplicate slugs (bigram Jaccard ≥ 0.7), URLs to verify.
  - **Routing audit** — referenced skills/agents not installed, installed skills not routed.
- The `audit-memory` skill walks the user through actionable items.

### Cross-platform

- `/sustain:export` writes `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` into any directory.
- `AGENTS.md` symlinks to `CLAUDE.md` in this repo so other AGENTS.md-aware tools (Codex CLI, Gemini CLI, etc.) read the same rules.

## Install

```text
/plugin marketplace add BryantChi/claude-sustain
/plugin install claude-sustain@claude-sustain
```

Then restart Claude Code (full CLI exit + relaunch — `/clear` is not enough). New sessions show:

- A one-line `systemMessage`: `[claude-sustain v0.4.0] active — 4 Iron Rules + 6-question phase check + N/M skill routes · memory: <backend>`
- A primer with the Iron Rules, the active routing entries, and the detected memory backend in `additionalContext`.
- A phase-end checklist + token tally on every `Stop`.

You can also install from a local clone:

```text
/plugin marketplace add /path/to/claude-sustain
/plugin install claude-sustain@claude-sustain
```

## Commands

| Command | Purpose |
| --- | --- |
| `/sustain:status` | Active rules, routing coverage, memory backend, session tokens, 7-day telemetry averages, recommended next move. |
| `/sustain:audit` | Memory + routing health scan. Reports only; never auto-deletes. |
| `/sustain:export` | Write `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` into any directory. |

## Skills

| Skill | When |
| --- | --- |
| `token-rules-primer` | Re-ground the Iron Rules + R1–R5 mid-session. |
| `phase-self-check` | Walk the 6-question checklist explicitly. |
| `memory-write-router` | Decide whether and where to persist a learning. |
| `memory-search-bridge` | "How did we solve X before?" — routes to mempalace MCP / claude-mem MCP / fs grep. |
| `token-budget-coach` | Interpret token stats; recommend `/compact` / subagent / model switch. |
| `audit-memory` | Process `/sustain:audit` results with the user. |

## Configuration

Per-user overrides live in `~/.claude/sustain/overrides.json` (create yourself; never ships with the plugin). Anything there wins over the bundled spec — the plugin **never silently overwrites** user configuration.

Environment variable overrides for memory backend detection:

| Variable | Purpose |
| --- | --- |
| `CLAUDE_SUSTAIN_FORCE_BACKEND` | `mempalace` / `claude-mem` / `fs` — bypass auto-detection. |
| `CLAUDE_SUSTAIN_MEMPALACE_PATH` | Absolute path to a non-standard mempalace install. |
| `CLAUDE_SUSTAIN_CLAUDE_MEM_PATH` | Absolute path to a non-standard claude-mem install. |

## License & dependencies

`claude-sustain` is **MIT**.

It optionally cooperates with two memory backends but never imports either:

- **MemPalace (MIT)** — primary; referenced through MCP tools.
- **claude-mem (AGPL-3.0)** — secondary; referenced through MCP tools only. Plugin code does not statically link any claude-mem source, which keeps this plugin free of AGPL infection.

## Why "sustain"?

Most rule systems for AI coding fail one of two ways: they're too aggressive (the agent fights them, you lose more tokens than you save), or they're forgotten by mid-session because nothing notices. `sustain` aims for the durable middle: a small hard core of rules (the Iron Rules), hooks that notice drift before it costs much, a memory layer that survives across sessions, and a measurement loop that tells you whether it's working.

## Project status

v0.4.0 — past MVP. Memory + telemetry + audit + runtime routing filter are all live. v2.0 will add OTLP-based telemetry, an A/B framework for rules-on vs rules-off comparison, and a dashboard. See [`CHANGELOG.md`](CHANGELOG.md) for the full version history.

Feedback on rule wording, hook ergonomics, and skill routing scenarios is welcome via [GitHub issues](https://github.com/BryantChi/claude-sustain/issues).

## License

MIT. See [`LICENSE`](LICENSE).

## Acknowledgements

- [superpowers](https://github.com/obra/superpowers) — plugin structure and hook conventions.
- [claude-mem](https://github.com/thedotmack/claude-mem) — memory backend (optional, AGPL-3.0; referenced via MCP only).
- [MemPalace](https://github.com/mempalace/mempalace) — alternative memory backend (optional, MIT).
- [AGENTS.md standard](https://agents.md/) — cross-platform rule file convention.
