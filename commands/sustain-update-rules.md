---
description: Opt-in pull of latest claude-sustain rules from GitHub; user reviews diff and writes to overrides.json (plugin dir is never modified)
---

Pull the latest `rules/spec.json` from `BryantChi/claude-sustain` on GitHub and offer the user a review-then-merge flow. **Never write to the plugin's own directory** — that gets overwritten on `/plugin update`. All accepted changes land in `~/.claude/sustain/overrides.json`.

## Steps

1. Fetch the latest spec via `WebFetch`:
   - URL: `https://raw.githubusercontent.com/BryantChi/claude-sustain/main/rules/spec.json`
   - Parse the response as JSON.

2. Read the **bundled** spec from `${CLAUDE_PLUGIN_ROOT}/rules/spec.json`. This is what's currently active (modulo overrides).

3. Compute a structural diff:
   - Version: `bundled.version` vs `remote.version` — show prominently.
   - For each of `ironRules`, `phaseChecklist`, `skillRouting`, `details.R*.rules`:
     - **Added**: entries in remote but not in bundled (match by `id`, or by `when` for routing).
     - **Removed**: entries in bundled but not in remote.
     - **Changed**: same id, different body. Show field-level diff.
   - For `memoryBackends`: full-block compare.

4. Present the diff to the user as a compact summary first (counts), then ask:
   - "Apply all changes?"
   - "Review each change individually?"
   - "Cancel?"

5. For each accepted change, **append it to `~/.claude/sustain/overrides.json`**:
   - If the file doesn't exist, create it with `{}` and add the field.
   - Use `id` (or `when` for routing) matching so the override layer's
     `applyOverrides()` merge picks it up correctly.
   - Pretty-print JSON (2-space indent).
   - Show the user the resulting overrides.json before writing.

6. Confirm with the user before writing. Display the file path so they can inspect it later.

## Why this flow

- The plugin's `rules/spec.json` lives under `~/.claude/plugins/cache/.../claude-sustain/<version>/`. `/plugin update` would overwrite any edits — so this command never touches it.
- `~/.claude/sustain/overrides.json` is loaded on every hook run via `lib/overrides.js → applyOverrides(spec)` and **wins** over the bundled spec by `id`/`when` match.
- This makes upgrades safe: bundled rules update via the marketplace, your custom additions persist in `overrides.json`.

## Edge cases

- If the remote spec's `version` is *older* than bundled, ask the user to confirm — they may have downgraded intentionally, but it's worth a sanity check.
- If `WebFetch` fails (offline, rate-limited), surface the error and stop. Don't fall back to anything fuzzy.
- If the user already has overrides for a given `id`, mention that the new pull will be merged on top. Show the resulting effective entry so the user can verify intent.
