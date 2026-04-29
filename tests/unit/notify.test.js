import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { maybeNotify } from "../../lib/notify.js";

let TMP;
before(() => {
  TMP = mkdtempSync(join(tmpdir(), "sustain-notify-"));
  process.env.CLAUDE_SUSTAIN_CONFIG_DIR = TMP;
});
after(() => {
  delete process.env.CLAUDE_SUSTAIN_CONFIG_DIR;
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
});

test("returns null when no config provided", async () => {
  const r = await maybeNotify({ config: null, sessionId: "x", tokens: { input: 100 }, durationMs: 0, tokenLine: "tokens: 100 in" });
  assert.equal(r, null);
});

test("does not fire below threshold", async () => {
  const r = await maybeNotify({
    config: { webhook: "http://127.0.0.1:1/never", format: "raw", threshold: { tokenTotal: 1_000_000, durationMs: 0 }, minIntervalMs: 0 },
    sessionId: "x",
    tokens: { input: 100, output: 100, cache_creation: 0, cache_read: 0 },
    durationMs: 1000,
    tokenLine: "tokens: 100 in / 100 out",
  });
  assert.equal(r, null);
});

test("dispatches when token total threshold met (catches network error gracefully)", async () => {
  const r = await maybeNotify({
    config: { webhook: "http://127.0.0.1:1/unreachable", format: "raw", threshold: { tokenTotal: 100, durationMs: 0 }, minIntervalMs: 0 },
    sessionId: "x",
    tokens: { input: 200, output: 0, cache_creation: 0, cache_read: 0 },
    durationMs: 0,
    tokenLine: "tokens: 200 in",
  });
  assert.equal(typeof r, "object");
  assert.equal(r.ok, false);
  assert.ok(r.error, "expected an error string from unreachable host");
});
