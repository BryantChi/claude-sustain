# Architecture

`claude-sustain` is a Claude Code plugin organized as **three layers** stacked on a single source of truth.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER-FACING SURFACE                             │
│  /sustain:status     /sustain:audit     /sustain:export                  │
│  /sustain:update-rules                                                   │
│  Skills: token-rules-primer, phase-self-check, memory-write-router,      │
│          memory-search-bridge, token-budget-coach, audit-memory          │
└──────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
┌──────────────────────────────────────────────────────────────────────────┐
│                       ENFORCEMENT + OBSERVATION                          │
│  hooks/                                                                  │
│   ├── session-start.js    primer + memory-backend detect + routing filter│
│   ├── user-prompt-submit  Iron-1 keyword detection                       │
│   ├── pre-tool-use.js     Iron-2 word-cap check on Task subagents        │
│   ├── stop.js             phase checklist + token tally + telemetry log  │
│   └── session-end.js      flush + audit trigger (planned)                │
└──────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
┌──────────────────────────────────────────────────────────────────────────┐
│                            CORE LIBRARIES                                │
│  lib/                                                                    │
│   ├── overrides.js              user overrides merge                     │
│   ├── routing/{match,filter}.js token resolution + runtime filter        │
│   ├── memory/                                                            │
│   │   ├── adapter.js            unified write/query                      │
│   │   ├── detect.js             probe mempalace / claude-mem             │
│   │   ├── state.js              state.json cache                         │
│   │   └── backends/{fs,mempalace,claude-mem}.js                          │
│   ├── audit/{memory,routing,migrate}.js                                  │
│   ├── telemetry.js              jsonl log writer + reader                │
│   ├── generators/{render,claude,agents,gemini}.js                        │
│   └── cli/export.js             /sustain:export entry                    │
└──────────────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
┌──────────────────────────────────────────────────────────────────────────┐
│                     SINGLE SOURCE OF TRUTH                               │
│  rules/spec.json     ironRules + phaseChecklist + details + skillRouting │
│  ~/.claude/sustain/overrides.json   user-level overrides (id-merged)     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data flow

### 1. Session start

```
Claude Code → SessionStart event → hooks/session-start.js
  ├── loadSpec()                        ← rules/spec.json + overrides.json
  ├── memory.detect()                    ← probe ~/.claude/plugins/cache
  ├── memory.writeState(detection)       ← ~/.claude/sustain/state.json
  ├── routing.filterRouting(spec)        ← scan installed skills + agents
  └── writeJson({
        systemMessage: "X/Y skill routes · memory: <backend>",
        hookSpecificOutput.additionalContext: <primer + filtered routing>
      })
```

The user sees the systemMessage line in the transcript. Claude reads the additionalContext into its working context.

### 2. User prompt submit

```
User types → UserPromptSubmit event → hooks/user-prompt-submit.js
  ├── readStdinJson()                    ← {prompt: "..."}
  ├── match against ironRules[0].triggers.keywords
  └── if hit:
        writeJson({
          systemMessage: 'Iron-1 active — keyword "逐個" detected',
          hookSpecificOutput.additionalContext: <reminder>
        })
```

### 3. Subagent dispatch

```
Claude calls Task tool → PreToolUse(matcher: "Task") → hooks/pre-tool-use.js
  ├── inspect tool_input.prompt
  ├── check for word cap regex (≤ 200 / ≤ 800 / ≤ 2000 / 字)
  ├── check for escape clause regex
  └── if missing either:
        writeJson({ systemMessage: "Iron-2 advisory: ..." })
        exit 0   # warn-only
```

### 4. Stop (phase end)

```
Claude finishes turn → Stop event → hooks/stop.js
  ├── tallyTokens(transcriptPath)        ← parse session JSONL
  ├── telemetry.append({ tokens })       ← ~/.claude/sustain/telemetry/<date>.jsonl
  └── writeJson({
        systemMessage: "phase-end checklist:\n1. ...\n[claude-sustain] tokens: ..."
      })
```

## Module dependency graph

```
hooks/* ─────────► hooks/lib/io.js ─► lib/overrides.js
                                  └─► rules/spec.json

hooks/session-start.js ─► lib/memory/detect.js
                       ─► lib/memory/state.js
                       ─► lib/routing/filter.js ─► lib/routing/match.js
                                                ─► lib/audit/routing.js

hooks/stop.js          ─► hooks/lib/jsonl.js (token tally)
                       ─► lib/telemetry.js

lib/audit/routing.js   ─► lib/routing/match.js   (shared)
lib/audit/memory.js    ─► (filesystem only, no deps)
lib/audit/migrate.js   ─► (filesystem only, no deps)

lib/memory/adapter.js  ─► lib/memory/state.js
                       ─► lib/memory/backends/{fs,mempalace,claude-mem}.js

lib/generators/*       ─► rules/spec.json (read only)
lib/cli/export.js      ─► lib/generators/*
```

## Single source of truth: `rules/spec.json`

Everything user-visible derives from this file:

- **CLAUDE.md / AGENTS.md / GEMINI.md** — generated by `lib/generators/`. Regenerated via `npm run regen-claude-md` and committed.
- **SessionStart primer** — assembled in `hooks/session-start.js` from `spec.ironRules` + `spec.phaseChecklist` + filtered `spec.skillRouting`.
- **PreToolUse word-cap check** — uses `spec.ironRules[1].wordCaps` and `escapeClause`.
- **UserPromptSubmit keyword detection** — uses `spec.ironRules[0].triggers.keywords`.
- **Stop checklist** — from `spec.phaseChecklist`.
- **Skill routing audit/filter** — from `spec.skillRouting`.

User overrides at `~/.claude/sustain/overrides.json` are merged into spec via `lib/overrides.js → applyOverrides()` on every `loadSpec()` call. The merge is id-aware (`ironRules[].id`, `details.R<n>.rules[].id`, `skillRouting[].when`) so users can change one rule without re-stating the whole table.

## Hook contract

All hooks follow the Claude Code hook convention:

- **Input**: JSON on stdin (`{ tool_name, tool_input, transcript_path, session_id, ... }`).
- **Output (optional)**: JSON on stdout. Recognised fields:
  - `systemMessage` — user-visible line in the transcript.
  - `hookSpecificOutput.additionalContext` — appended to Claude's context (not user-visible).
  - `decision` / `reason` — when blocking is intended.
- **Exit code**: 0 = OK; non-zero = error (Claude Code surfaces hook failures).

claude-sustain hooks are **warn-only** today — they exit 0 even when noticing drift, just emitting a `systemMessage`. A future `strict` mode (planned) would use `decision: "block"` for Iron-2 violations.

## File locations

| Path | Purpose |
| --- | --- |
| `~/.claude/plugins/cache/<owner>/claude-sustain/<version>/` | Plugin install (read-only — overwritten on `/plugin update`) |
| `~/.claude/sustain/state.json` | Memory backend detection cache |
| `~/.claude/sustain/overrides.json` | User overrides for spec.json (never written by plugin code) |
| `~/.claude/sustain/memory/wings/<wing>/drawers/<date>-<slug>.md` | fs-backend memory store |
| `~/.claude/sustain/telemetry/<YYYY-MM-DD>.jsonl` | Per-Stop token snapshots |
| `~/.claude/sustain/migration-plan.json` | fs → mempalace migration plan (when `/sustain:audit` builds one) |

## Cross-platform story

The same `rules/spec.json` produces three target files via three pure functions:

- `lib/generators/claude.js` → `CLAUDE.md` (second-person, full markdown).
- `lib/generators/agents.js` → `AGENTS.md` (neutral framing — "the agent").
- `lib/generators/gemini.js` → `GEMINI.md` (one-liner pointing to AGENTS.md, plus `gemini-extension.json` registration).

In this repo, `AGENTS.md` is a symlink to `CLAUDE.md` so other AGENTS.md-aware tools (Codex CLI, Gemini CLI, etc.) load the same rules without a separate file. The standalone `lib/generators/agents.js` is used by `/sustain:export` when emitting the trio into a different project's directory.

## Why this layering?

- **Spec at the bottom** so rules can be edited in one place and propagate everywhere.
- **Libraries in the middle**, free of Claude-Code-specific imports, so the same logic is reusable from CLI scripts, tests, and (future) other agent platforms.
- **Hooks as a thin shell** that only knows how to read stdin / write stdout JSON and call into the libraries.
- **Skills + commands at the top** as user-facing entry points, with no logic of their own — they invoke the libraries via documented bridges.

This means: any new feature gets added at the lowest layer that can host it, and surfaces upward only when there's a real user-visible reason.
