# Validation Protocol — Does claude-sustain actually save tokens?

The MVP acceptance threshold is **avg tokens / session drops by ≥ 10%** after installing the plugin. This document is the playbook for measuring it honestly.

## Tools

- `scripts/measure-sessions.js` — walks `~/.claude/projects/*/*.jsonl`, tallies per-session tokens, writes a JSON snapshot.
- `scripts/compare-snapshots.js` — diffs two snapshots and tells you the delta on every metric, with a pass/fail line for the 10% goal.

## Step 1 — Baseline

Before installing claude-sustain, capture the recent past as the baseline.

```bash
node scripts/measure-sessions.js \
  --since=2026-04-01 --until=2026-04-27 \
  --label=baseline \
  --out=docs/validation/baseline-2026-04-27.json
```

The window should be wide enough that one or two outlier sessions don't dominate the average. Two to four weeks of typical use is a good default.

Save the JSON snapshot (committed in `docs/validation/`). It is your reference point.

## Step 2 — Install the plugin

```text
/plugin marketplace add /Users/<you>/Projects/claude-sustain   # local while iterating
/plugin install claude-sustain@claude-sustain
```

Then restart your Claude Code session. You should see a one-line primer in the SessionStart context and a `[claude-sustain] Phase-end checklist:` block after each Stop.

## Step 3 — Use Claude Code normally

Do not artificially curate the work to look good. Use Claude Code the way you usually do for **at least one calendar week, ideally two**.

A pure 5-session comparison is too noisy — claude-sustain's effect is on *behavior* (subagent caps, regex de-duplication, /compact discipline) and the variance across individual sessions is large (in the baseline above, the top session is 1.21M tokens while the median is 8.5K).

## Step 4 — Measure with-plugin

```bash
node scripts/measure-sessions.js \
  --since=2026-04-28 \
  --label=with-plugin \
  --out=docs/validation/with-plugin-$(date +%F).json
```

Use the day after install as `--since`. Leave `--until` open (defaults to today).

## Step 5 — Compare

```bash
node scripts/compare-snapshots.js \
  docs/validation/baseline-2026-04-27.json \
  docs/validation/with-plugin-YYYY-MM-DD.json
```

The script prints a metric-by-metric delta table and a verdict line:

- `✅ Avg tokens/session dropped X% — meets MVP threshold (≥10%).`
- `⚠ Avg tokens/session dropped only X% — below MVP threshold (10%).`
- `❌ Avg tokens/session increased X% — investigate.`

## Caveats

- **Selection effects.** If the kind of work you do shifts (more refactoring, fewer greenfield builds) the comparison gets muddier. When that happens, look at the *median* and the *cache hit rate* in addition to the average.
- **Cache hit rate is already high.** In real usage cache hit is often 90%+ already; the easy wins come from input_tokens (less re-exploration) and avoiding the multi-Read / multi-Write patterns Iron-3 targets.
- **Hooks fire warnings, not refusals (in v0.1).** Token savings depend on you (or the agent) actually noticing and acting on the advisories. If you see Iron-2 warnings flying past unaddressed for a whole week, that's the signal — not the absolute number.

## What to log when reporting

If you write up a result publicly (issue, blog post, etc.), include:

- Baseline window, with-plugin window, and the n of each
- Median and avg per session for both, plus the delta
- Cache hit rate before/after
- Two or three concrete examples of hooks firing usefully (or not)

The honest read is more useful than the absolute number.
