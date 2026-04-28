---
description: Generate CLAUDE.md / AGENTS.md / GEMINI.md from claude-sustain rules into the current project
---

Generate the cross-platform rule files from claude-sustain's `rules/spec.json` into the user's current working directory.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/export.js" --target="$PWD"
```

Then summarize for the user which files were written and remind them that the spec is the source of truth — re-run this command after the plugin updates.

Arguments (optional):
- `$ARGUMENTS` — pass through to the CLI. Example: `--only=AGENTS.md` to only emit AGENTS.md, or `--target=path/to/dir` to write elsewhere.
