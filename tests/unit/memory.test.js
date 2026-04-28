// Unit tests for the memory subsystem (detect, fs backend, adapter).
// Each test redirects HOME so writes land in a tempdir and never touch the
// user's real ~/.claude/sustain/.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmp;
let ORIGINAL_HOME;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "sustain-memory-"));
  ORIGINAL_HOME = process.env.HOME;
  process.env.HOME = tmp;
});

after(() => {
  process.env.HOME = ORIGINAL_HOME;
  rmSync(tmp, { recursive: true, force: true });
});

test("detect: no plugins installed → preferred=fs", async () => {
  delete process.env.CLAUDE_SUSTAIN_FORCE_BACKEND;
  delete process.env.CLAUDE_SUSTAIN_MEMPALACE_PATH;
  delete process.env.CLAUDE_SUSTAIN_CLAUDE_MEM_PATH;
  const { detect } = await freshImport("../../lib/memory/detect.js");
  const d = detect();
  assert.equal(d.preferred, "fs");
  assert.equal(d.backends.mempalace.installed, false);
  assert.equal(d.backends.claudeMem.installed, false);
  assert.equal(d.fallback, "fs");
});

test("detect: claude-mem cache dir present → preferred=claude-mem", async () => {
  const fakeCache = join(tmp, ".claude", "plugins", "cache", "thedotmack", "claude-mem", "10.6.3");
  mkdirSync(fakeCache, { recursive: true });
  delete process.env.CLAUDE_SUSTAIN_FORCE_BACKEND;
  delete process.env.CLAUDE_SUSTAIN_MEMPALACE_PATH;
  delete process.env.CLAUDE_SUSTAIN_CLAUDE_MEM_PATH;
  const { detect } = await freshImport("../../lib/memory/detect.js");
  const d = detect();
  assert.equal(d.backends.claudeMem.installed, true);
  assert.equal(d.backends.claudeMem.version, "10.6.3");
  assert.equal(d.preferred, "claude-mem");
});

test("detect: mempalace path override beats claude-mem", async () => {
  const fakeMemp = join(tmp, "mempalace-fake");
  mkdirSync(fakeMemp, { recursive: true });
  process.env.CLAUDE_SUSTAIN_MEMPALACE_PATH = fakeMemp;
  delete process.env.CLAUDE_SUSTAIN_FORCE_BACKEND;
  const { detect } = await freshImport("../../lib/memory/detect.js");
  const d = detect();
  assert.equal(d.backends.mempalace.installed, true);
  assert.equal(d.preferred, "mempalace");
  delete process.env.CLAUDE_SUSTAIN_MEMPALACE_PATH;
});

test("detect: CLAUDE_SUSTAIN_FORCE_BACKEND=fs always wins", async () => {
  process.env.CLAUDE_SUSTAIN_FORCE_BACKEND = "fs";
  const { detect } = await freshImport("../../lib/memory/detect.js");
  const d = detect();
  assert.equal(d.preferred, "fs");
  assert.equal(d.forced, true);
  delete process.env.CLAUDE_SUSTAIN_FORCE_BACKEND;
});

test("fs backend: write creates wings/<wing>/drawers/<date>-<slug>.md and updates index", async () => {
  const fs = await freshImport("../../lib/memory/backends/fs.js");
  const result = fs.write({
    wing: "feedback",
    slug: "Don't mock the database",
    body: "We got burned by mocked DB tests last quarter.",
    date: "2026-04-29",
  });
  assert.equal(result.wing, "feedback");
  assert.equal(result.slug, "don-t-mock-the-database");
  assert.match(result.path, /wings\/feedback\/drawers\/2026-04-29-don-t-mock-the-database\.md$/);
  assert.equal(existsSync(result.path), true);
  const content = readFileSync(result.path, "utf8");
  assert.match(content, /^---/);
  assert.match(content, /wing: feedback/);
  assert.match(content, /We got burned/);

  const indexPath = join(tmp, ".claude", "sustain", "memory", "MEMORY.md");
  assert.equal(existsSync(indexPath), true);
  const idx = readFileSync(indexPath, "utf8");
  assert.match(idx, /## feedback/);
  assert.match(idx, /2026-04-29-don-t-mock-the-database/);
});

test("fs backend: query finds entries by case-insensitive substring", async () => {
  const fs = await freshImport("../../lib/memory/backends/fs.js");
  fs.write({ wing: "project", slug: "ship-deadline", body: "Mobile release cuts on 2026-03-05.", date: "2026-04-29" });
  const hits = fs.query({ text: "MOBILE RELEASE" });
  assert.ok(hits.length >= 1);
  const hit = hits.find(h => h.wing === "project");
  assert.ok(hit);
  assert.match(hit.excerpt, /mobile release/i);
});

test("fs backend: write rejects invalid wing", async () => {
  const fs = await freshImport("../../lib/memory/backends/fs.js");
  assert.throws(() => fs.write({ wing: "Bad Wing!", slug: "x", body: "y" }), /Invalid wing/);
});

test("adapter.write: with claude-mem preferred, mirrors to fs and returns guidance hint", async () => {
  // Pre-populate state.json to simulate detection result.
  const stateDir = join(tmp, ".claude", "sustain");
  mkdirSync(stateDir, { recursive: true });
  const { writeState } = await freshImport("../../lib/memory/state.js");
  writeState({
    detectedAt: new Date().toISOString(),
    backends: { mempalace: { installed: false }, claudeMem: { installed: true, version: "10.6.3", path: "/x" } },
    preferred: "claude-mem",
    fallback: "fs",
    forced: false,
  });

  const adapter = await freshImport("../../lib/memory/adapter.js");
  const r = adapter.write({ wing: "reference", slug: "linear-ingest", body: "Pipeline bugs in INGEST." });
  assert.equal(r.preferred, "claude-mem");
  assert.equal(existsSync(r.path), true);
  assert.ok(r.hint);
  assert.equal(r.hint.backend, "claude-mem");
  assert.match(r.hint.summary, /claude-mem/);
});

test("adapter.query: with mempalace preferred, returns hits + suggestion", async () => {
  const { writeState } = await freshImport("../../lib/memory/state.js");
  writeState({
    detectedAt: new Date().toISOString(),
    backends: { mempalace: { installed: true, version: "1.0.0", path: "/y" }, claudeMem: { installed: false } },
    preferred: "mempalace",
    fallback: "fs",
    forced: false,
  });
  const adapter = await freshImport("../../lib/memory/adapter.js");
  adapter.write({ wing: "feedback", slug: "tone-check", body: "User wants terse responses." });
  const out = adapter.query({ text: "terse" });
  assert.equal(out.preferred, "mempalace");
  assert.ok(out.hits.length >= 1);
  assert.ok(out.suggestion);
  assert.match(out.suggestion.summary, /mempalace/i);
});

// Helper: cache-bust ESM imports so HOME-based module-level constants get
// re-evaluated for each test. node:test doesn't provide jest.resetModules.
async function freshImport(rel) {
  const url = new URL(rel + `?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url.href);
}
