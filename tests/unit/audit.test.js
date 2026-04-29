// Unit tests for memory + routing + migrate audits.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmp, ORIGINAL_HOME;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "sustain-audit-"));
  ORIGINAL_HOME = process.env.HOME;
  process.env.HOME = tmp;
});

after(() => {
  process.env.HOME = ORIGINAL_HOME;
  rmSync(tmp, { recursive: true, force: true });
});

function writeDrawer(wing, name, body, mtime = null) {
  const dir = join(tmp, ".claude", "sustain", "memory", "wings", wing, "drawers");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, body);
  if (mtime) utimesSync(path, mtime, mtime);
  return path;
}

test("memory audit: flags drawers older than staleDays", async () => {
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
  writeDrawer("feedback", "2025-12-01-stale-rule.md", "---\nwing: feedback\nslug: stale-rule\n---\nold body", old);
  writeDrawer("feedback", "2026-04-29-fresh-rule.md", "---\nwing: feedback\nslug: fresh-rule\n---\nnew body");

  const m = await freshImport("../../lib/audit/memory.js");
  const report = m.audit({ staleDays: 90 });
  assert.equal(report.stale.length, 1);
  assert.match(report.stale[0].name, /stale-rule/);
  assert.ok(report.stale[0].ageDays >= 90);
});

test("memory audit: detects similar-slug duplicates within same wing", async () => {
  writeDrawer("project", "2026-04-29-mobile-release-cut.md", "---\nwing: project\n---\nbody");
  writeDrawer("project", "2026-04-29-mobile-release-cuts.md", "---\nwing: project\n---\nbody");

  const m = await freshImport("../../lib/audit/memory.js");
  const report = m.audit();
  const dup = report.duplicates.find(d =>
    d.a.includes("mobile-release-cut") && d.b.includes("mobile-release-cuts")
  );
  assert.ok(dup, "expected mobile-release-cut[s] pair");
  assert.ok(dup.similarity >= 0.7);
});

test("memory audit: extracts URLs from drawer bodies", async () => {
  writeDrawer("reference", "2026-04-29-grafana-board.md",
    "---\nwing: reference\n---\nThe oncall dashboard is https://grafana.internal/d/api-latency, see also http://localhost:9090.");

  const m = await freshImport("../../lib/audit/memory.js");
  const report = m.audit();
  const urls = report.urls.map(u => u.url);
  assert.ok(urls.some(u => u.includes("grafana.internal")));
  assert.ok(urls.some(u => u.includes("localhost:9090")));
});

test("routing audit: flags routing tokens not installed", async () => {
  const r = await freshImport("../../lib/audit/routing.js");
  const report = r.audit({
    skillRouting: [
      { when: "thing", use: "claude-sustain:nonexistent-skill", source: "claude-sustain" },
    ],
  });
  assert.equal(report.listedButMissing.length, 1);
  assert.equal(report.listedButMissing[0].token, "claude-sustain:nonexistent-skill");
});

test("routing audit: empty spec returns clean report", async () => {
  const r = await freshImport("../../lib/audit/routing.js");
  const report = r.audit({ skillRouting: [] });
  assert.equal(report.routingCount, 0);
  assert.equal(report.listedButMissing.length, 0);
});

test("migrate.buildPlan: produces one item per drawer with mempalace MCP suggestion", async () => {
  // Reuses drawers from earlier tests.
  const m = await freshImport("../../lib/audit/migrate.js");
  const plan = m.buildPlan();
  assert.ok(plan.itemCount >= 1);
  for (const item of plan.items) {
    assert.equal(item.suggestedCall.tool, "mcp__mempalace__store");
    assert.ok(item.suggestedCall.input.wing);
    assert.ok(item.suggestedCall.input.drawer);
    assert.ok(typeof item.suggestedCall.input.content === "string");
  }
});

test("migrate.writePlanFile: writes JSON to ~/.claude/sustain/migration-plan.json", async () => {
  const m = await freshImport("../../lib/audit/migrate.js");
  const plan = m.buildPlan();
  const path = m.writePlanFile(plan);
  assert.equal(existsSync(path), true);
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(parsed.itemCount, plan.itemCount);
});

async function freshImport(rel) {
  const url = new URL(rel + `?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url.href);
}
