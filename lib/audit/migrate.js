// fs → mempalace migration helper.
//
// We never call the mempalace MCP from plugin code (plugin code can't), so
// this module only *prepares* a migration plan: it lists each fs drawer with
// the wing/slug/body/timestamp and the suggested mempalace MCP call, and
// optionally writes the plan to a JSON file for the model to consume.
//
// The actual upload is performed by the model in the user's session, calling
// mempalace's MCP tools per the plan.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export const MEMORY_ROOT = join(homedir(), ".claude", "sustain", "memory");
export const PLAN_FILE = join(homedir(), ".claude", "sustain", "migration-plan.json");

function listWings() {
  const dir = join(MEMORY_ROOT, "wings");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
  });
}

function listDrawers(wing) {
  const dir = join(MEMORY_ROOT, "wings", wing, "drawers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => n.endsWith(".md"));
}

function parseDrawer(path) {
  let content;
  try { content = readFileSync(path, "utf8"); } catch { return null; }
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  let frontmatter = {};
  let body = content;
  if (fmMatch) {
    body = content.slice(fmMatch[0].length);
    for (const line of fmMatch[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) frontmatter[m[1]] = m[2].trim();
    }
  }
  return { frontmatter, body: body.trim() };
}

export function buildPlan() {
  const items = [];
  for (const wing of listWings()) {
    for (const name of listDrawers(wing)) {
      const path = join(MEMORY_ROOT, "wings", wing, "drawers", name);
      const parsed = parseDrawer(path);
      if (!parsed) continue;
      items.push({
        path,
        wing,
        slug: parsed.frontmatter.slug || name.replace(/\.md$/, ""),
        created: parsed.frontmatter.created || null,
        body: parsed.body,
        suggestedCall: {
          tool: "mcp__mempalace__store",
          input: {
            wing,
            drawer: parsed.frontmatter.slug || name.replace(/\.md$/, ""),
            content: parsed.body,
          },
        },
      });
    }
  }
  return {
    builtAt: new Date().toISOString(),
    source: "claude-sustain fs backend",
    target: "mempalace MCP",
    itemCount: items.length,
    items,
    notes: [
      "Run mempalace's MCP write tool for each item (see suggestedCall).",
      "After successful upload, you can archive the fs drawers — claude-sustain still mirrors writes to fs by default, so don't bulk-delete unless you also flip the adapter to mempalace-only.",
    ],
  };
}

export function writePlanFile(plan) {
  const dir = dirname(PLAN_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2));
  return PLAN_FILE;
}
