# Extending claude-sustain

Three common extension points: new skills, new hooks, new memory backends. Each has a fixed contract; follow the recipe and the rest of the plugin picks it up automatically.

## Adding a new skill

A skill is a markdown file at `skills/<skill-name>/SKILL.md` with YAML frontmatter.

### Recipe

1. Create the directory and SKILL.md:

   ```sh
   mkdir -p skills/my-skill
   ```

   `skills/my-skill/SKILL.md`:

   ```markdown
   ---
   name: my-skill
   description: One sentence describing when to use this skill. Be specific about the trigger conditions — Claude reads this to decide whether to invoke.
   ---

   # My Skill

   The body is what Claude reads after invoking. Keep it focused on:
   - Step-by-step instructions
   - Decision tables for branching cases
   - Anti-patterns to avoid

   Skills should be ≤ 200 lines. If yours is longer, consider splitting.
   ```

2. **Register a routing entry** in `rules/spec.json` so the SessionStart primer mentions it:

   ```jsonc
   { "when": "Concrete scenario when this fires", "use": "claude-sustain:my-skill", "source": "claude-sustain" }
   ```

3. Regenerate the cross-platform docs:

   ```sh
   npm run regen-claude-md
   ```

4. Reinstall the plugin to pick up the new skill (Claude Code caches skills at install time):

   ```text
   /plugin uninstall claude-sustain@claude-sustain
   /plugin install claude-sustain@claude-sustain
   ```

### Conventions

- **Description writing**: lead with the trigger ("Use when…"), not the outcome. The description is the only signal Claude has when deciding whether to invoke.
- **No imports**: skills can't import code; they're prompts. If you need logic, put it in `lib/` and have the skill instruct Claude to invoke it via `Bash`.
- **Reference the spec**: a skill that reads `rules/spec.json` is fine — instruct Claude to do so via `Read`.
- **Audit-ready**: any skill listed in `spec.skillRouting` should be runnable; otherwise `/sustain:audit` flags it as missing.

## Adding a new hook

Hooks are Node scripts in `hooks/` that read a JSON event from stdin and write JSON to stdout.

### Recipe

1. Create the script:

   `hooks/my-hook.js`:

   ```js
   #!/usr/bin/env node
   // Comment describing what this hook does and why.

   import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";

   const event = readStdinJson();
   const spec = loadSpec(); // includes overrides.json automatically

   // ... your logic ...

   writeJson({
     systemMessage: "[claude-sustain] visible message",
     hookSpecificOutput: { hookEventName: "MyHook", additionalContext: "context for Claude" }
   });
   process.exit(0);
   ```

2. Register in `hooks/hooks.json`:

   ```jsonc
   {
     "hooks": {
       "MyEventName": [{
         "matcher": "...",
         "hooks": [{
           "type": "command",
           "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/my-hook.js\"",
           "timeout": 5
         }]
       }]
     }
   }
   ```

3. Add an integration test in `tests/integration/hooks.test.js`.

4. Document the hook in `docs/architecture.md` under the data flow section.

### Hook output fields

- `systemMessage` — string visible to the user in the transcript.
- `hookSpecificOutput.additionalContext` — string injected into Claude's working context (not user-visible).
- `decision` — `"approve"` / `"block"` (only for hooks that gate). Default: no gating.
- `reason` — explanation when `decision: "block"`.
- `continue` — `false` to stop Claude from continuing.
- `stopReason` — explanation when `continue: false`.

claude-sustain's own hooks are warn-only (`exit 0`, no `decision: "block"`). A future strict mode would flip this for Iron-2 violations only.

### Hook contract

- **Idempotency**: hooks may fire repeatedly within a session; never produce side-effects on every fire that aren't safe to repeat.
- **Speed**: keep hook execution ≤ 5s. Longer hooks block the user. Push expensive work to `SessionEnd` (offline) or use a background spawn.
- **Failure tolerance**: never let a hook crash the session. Wrap risky operations in try/catch and exit 0 even on partial failure.

## Adding a new memory backend

Backends live in `lib/memory/backends/<name>.js` and expose two functions: `writeHint()` and `queryHint()`.

### Recipe

1. Add the detection probe in `lib/memory/detect.js`:

   ```js
   function probeMyBackend() {
     const override = process.env.CLAUDE_SUSTAIN_MY_BACKEND_PATH;
     if (override) return existsSync(override) ? { installed: true, path: override } : { installed: false };
     // ... filesystem probe under ~/.claude/plugins/cache/<owner>/<plugin>/ ...
     return { installed: false };
   }
   ```

2. Update `detect()` to include the new backend in the priority order:

   ```js
   const myBackend = probeMyBackend();
   // ... add to backends object and preferred selection logic
   ```

3. Create the backend module:

   `lib/memory/backends/my-backend.js`:

   ```js
   // Comment: license, why this backend is interesting, MCP namespace if any.

   const NS = "mcp__my_backend__";

   export function writeHint({ wing, slug, body }) {
     return {
       instructionFor: "model",
       backend: "my-backend",
       summary: `My-backend is active. Use ${NS}store with wing="${wing}", drawer="${slug}".`,
       body,
     };
   }

   export function queryHint({ text, wing }) {
     return {
       instructionFor: "model",
       backend: "my-backend",
       summary: `Use ${NS}search with query="${text}".`,
       suggestedTools: [`${NS}search`],
     };
   }
   ```

4. Wire it into the adapter:

   `lib/memory/adapter.js`:

   ```js
   import * as myBackend from "./backends/my-backend.js";
   // ... add a branch in write() and query() for preferred === "my-backend"
   ```

5. Add unit tests for the new backend's hints + detection.

6. Document in `docs/configuration.md` (env vars + auto-detection paths) and `README.md` (acknowledgements).

### Backend contract

- **Never statically import** the backend's implementation code if it has a viral license (AGPL, etc.). Reference its MCP tools via guidance text and let the model dispatch.
- **Always mirror to fs**: `lib/memory/adapter.js → write()` writes to fs first, then produces a hint for the richer backend. This keeps a license-clean durable record even if the backend goes away.
- **Detection must be fast**: `detect()` runs every SessionStart. Avoid network probes; filesystem stats only.

## Adding a new audit check

Audits live in `lib/audit/<name>.js` and expose an `audit()` function returning a structured report.

### Recipe

1. Create `lib/audit/my-check.js`:

   ```js
   export function audit(spec) {
     // ... scan filesystem / parse spec ...
     return {
       auditedAt: new Date().toISOString(),
       findings: [...],
       notes: ["Important caveats..."],
     };
   }
   ```

2. Wire it into `commands/sustain-audit.md` so `/sustain:audit` runs it.

3. (Optional) Surface findings via the `audit-memory` skill so the user can act on them with the same UX as memory + routing audits.

4. Add unit tests.

## Modifying rules

Don't edit `rules/spec.json` directly if you want your changes to survive `/plugin update`. Use one of:

- **For your own machine**: write to `~/.claude/sustain/overrides.json` (see `docs/configuration.md`).
- **For everyone**: open a PR against `rules/spec.json` in the upstream repo. The CI lint runs `npm test` (50 tests) + `npm run lint:personal` (no `/Users/...` paths or lowercase usernames) + an idempotency check that `regen-claude-md` produces zero diff.

## Test conventions

- Unit tests: `tests/unit/<module>.test.js` — pure logic, fast (< 50ms each).
- Integration tests: `tests/integration/<topic>.test.js` — spawn hook scripts with stdin payloads, assert on stdout JSON shape.
- All tests redirect `process.env.HOME` to a tempdir before any filesystem write so they never touch the real `~/.claude/sustain/`.

Run with `npm test`. CI runs lint + test + idempotency on every push.

## Anti-patterns

- **Don't add a hook for a transient debug check.** Hooks fire on every relevant event for every session forever — the cost compounds. If you need to debug once, use a `Bash` step in a slash command instead.
- **Don't put logic in skills.** Skills are prompts. If the same prompt re-states a 50-line algorithm, factor the algorithm into `lib/` and have the skill instruct Claude to invoke it via `Bash`.
- **Don't bypass `loadSpec()`.** Always go through it so user overrides apply consistently.
- **Don't skip the audit.** New skills routed in `spec.json` but not installed will surface in `/sustain:audit`'s `listedButMissing` and confuse users.
