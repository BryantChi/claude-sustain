---
description: Run the memory + routing health audit; report stale entries, duplicate slugs, missing/unrouted skills
---

Run the claude-sustain audit and present the findings. Then invoke the `audit-memory` skill to walk the user through any actionable items.

## Steps

1. Run the memory audit (no shell needed; use Node inline or a small script):
   ```sh
   node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/audit/memory.js').then(m => console.log(JSON.stringify(m.audit({ staleDays: 90 }), null, 2)))"
   ```

2. Run the routing audit against the current spec:
   ```sh
   node -e "Promise.all([import('${CLAUDE_PLUGIN_ROOT}/lib/audit/routing.js'), import('node:fs').then(fs => JSON.parse(fs.readFileSync('${CLAUDE_PLUGIN_ROOT}/rules/spec.json', 'utf8')))]).then(([m, spec]) => console.log(JSON.stringify(m.audit(spec), null, 2)))"
   ```

3. Summarise both reports in a compact table. Show counts first (`stale: N`, `duplicates: N`, `listedButMissing: N`, `installedButUnrouted: N`); only expand when the user asks or counts are > 0.

4. If anything is non-zero, hand off to the `audit-memory` skill to walk through the actionable items. Otherwise just confirm "all clean" and stop.

5. **Never** auto-delete. The audit produces a report; the user decides every change.

## fs → mempalace migration (optional, separate flow)

If `~/.claude/sustain/state.json` shows mempalace newly installed and the user wants to migrate fs drawers, additionally run:

```sh
node -e "import('${CLAUDE_PLUGIN_ROOT}/lib/audit/migrate.js').then(m => { const p = m.buildPlan(); m.writePlanFile(p); console.log('Plan written to ~/.claude/sustain/migration-plan.json — '+ p.itemCount + ' items'); })"
```

Then read the plan and execute each `suggestedCall` via the mempalace MCP tool. Don't delete the fs drawers — they remain the durable backup.
