---
description: Show claude-sustain's active rules, skill routing, memory backend, and (when available) session token tally
---

Show the current claude-sustain status. Keep the response under 30 lines — this is a quick health check, not a configuration dump.

1. **Rules** — read `${CLAUDE_PLUGIN_ROOT}/rules/spec.json` and list:
   - Plugin version
   - Iron Rules count + titles
   - Phase-checklist length
   - Skill routing entries grouped by `source` (superpowers / claude-mem / mempalace / anthropic / claude-sustain / external-rescue)

2. **v0.6 enforcement & notification config** — surface what's actually active so the user can tell at a glance which switches are on:
   - **Iron-2 hard-gate**: read `~/.claude/sustain/strict.json`. Report `ironGate` (on/off) and the count of `bypassPatterns`. If the file doesn't exist, say "default warn-only — no strict.json".
   - **Notification webhook**: read `~/.claude/sustain/notify.json`. If present, report `format`, `threshold.tokenTotal`, `threshold.durationMs`. Mask the webhook URL — show only the host. If absent, say "no notify.json — Stop hook does not POST anywhere."
   - **Last fire**: if `~/.claude/sustain/notify-state.json` exists, show the timestamp and last status (helps diagnose silent webhook failures).
   - **modelHint config in effect**: read the merged spec (with overrides) and report `modelHint.wordLimit`, `len(lookupVerbs)`, `len(heavyKeywords)`. Mention if `_appliedOverrides` is true (user has customizations active).

3. **Memory backend** — read `~/.claude/sustain/state.json` and report:
   - `detection.preferred` (the active backend: `mempalace`, `claude-mem`, or `fs`)
   - Which backends are detected as installed (`detection.backends.mempalace.installed`, `detection.backends.claudeMem.installed`)
   - Whether the user has forced a backend (`detection.forced`)
   - If the file is missing, say so — SessionStart should have written it; offer to re-run detection by reloading the session.

4. **Session tokens** (best-effort) — try to tally tokens for the *current* session by reading the transcript JSONL (if accessible). Show:
   - Total input / output / cache_read / cache_creation
   - Cache hit rate (cache_read / total prompt tokens)
   - Top 3 most-token-spending tool uses (if computable)
   If the transcript path isn't available, say so and skip this section.

   Then read `~/.claude/sustain/telemetry/*.jsonl` and show **7-day moving averages** (`samples`, `avgInput`, `avgOutput`, `avgHitRate`) using `lib/telemetry.js → movingAverage({ sinceDays: 7 })`. Compare current-session numbers against the moving average and call out any > 50% deviation.

5. **Suggested next move** — based on the numbers above, give one concrete recommendation in one line. Reference the `token-budget-coach` skill if the user wants the reasoning unpacked.
