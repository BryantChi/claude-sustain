---
description: Show claude-sustain's active rules, skill routing coverage, and (when available) session token tally
---

Show the current claude-sustain status:

1. Read `${CLAUDE_PLUGIN_ROOT}/rules/spec.json` and list:
   - Plugin version
   - Iron Rules count and titles
   - Phase-checklist length
   - Skill routing entries — group by `source` (superpowers / claude-mem / mempalace / anthropic / claude-sustain / external-rescue)
2. Try to tally tokens for the current session by reading the transcript JSONL (if accessible). If not, say so.
3. List the configured memory backends from `spec.json.memoryBackends`. Note which are detected as installed (best-effort) and which is the active fallback.

Keep the response under 30 lines. The goal is a quick health check, not a full configuration dump.
