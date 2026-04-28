// Unit tests for the telemetry log writer + reader.
// Redirects HOME so writes never touch the user's real ~/.claude/sustain/.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmp;
let ORIGINAL_HOME;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "sustain-telemetry-"));
  ORIGINAL_HOME = process.env.HOME;
  process.env.HOME = tmp;
});

after(() => {
  process.env.HOME = ORIGINAL_HOME;
  rmSync(tmp, { recursive: true, force: true });
});

test("append: writes a row to today's JSONL with hit rate computed", async () => {
  const t = await freshImport("../../lib/telemetry.js");
  const row = t.append({
    sessionId: "abc",
    transcriptPath: "/tmp/x.jsonl",
    tokens: { input: 1000, output: 500, cache_creation: 200, cache_read: 800 },
  });
  assert.equal(row.tokens.input, 1000);
  // hitRate = 800 / (200 + 800) = 0.8
  assert.equal(row.hitRate, 0.8);

  const day = new Date().toISOString().slice(0, 10);
  const file = join(tmp, ".claude", "sustain", "telemetry", `${day}.jsonl`);
  assert.equal(existsSync(file), true);
  const lines = readFileSync(file, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.sessionId, "abc");
});

test("append: returns null and writes nothing when tokens missing", async () => {
  const t = await freshImport("../../lib/telemetry.js");
  const result = t.append({ sessionId: "x", tokens: null });
  assert.equal(result, null);
});

test("movingAverage: averages input/output/cache and hitRate across rows", async () => {
  const t = await freshImport("../../lib/telemetry.js");
  // Already has 1 row from the first test (in the same tempdir).
  t.append({ sessionId: "s2", tokens: { input: 2000, output: 1000, cache_creation: 0, cache_read: 1000 } });
  t.append({ sessionId: "s3", tokens: { input: 3000, output: 1500, cache_creation: 100, cache_read: 900 } });

  const avg = t.movingAverage({ sinceDays: 30 });
  assert.ok(avg);
  assert.equal(avg.samples, 3);
  assert.equal(avg.avgInput, Math.round((1000 + 2000 + 3000) / 3));
  assert.equal(avg.avgOutput, Math.round((500 + 1000 + 1500) / 3));
  // hitRates: 0.8, 1.0, 0.9 → avg = 0.9
  assert.equal(avg.avgHitRate, 0.9);
});

test("movingAverage: returns null when no rows in window", async () => {
  // Different temp HOME → empty telemetry dir.
  const empty = mkdtempSync(join(tmpdir(), "sustain-telemetry-empty-"));
  const prev = process.env.HOME;
  process.env.HOME = empty;
  try {
    const t = await freshImport("../../lib/telemetry.js");
    assert.equal(t.movingAverage({ sinceDays: 7 }), null);
  } finally {
    process.env.HOME = prev;
    rmSync(empty, { recursive: true, force: true });
  }
});

async function freshImport(rel) {
  const url = new URL(rel + `?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url.href);
}
