// Unit tests for the overrides loader.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmp, ORIGINAL_HOME;

before(() => {
  tmp = mkdtempSync(join(tmpdir(), "sustain-overrides-"));
  ORIGINAL_HOME = process.env.HOME;
  process.env.HOME = tmp;
});

after(() => {
  process.env.HOME = ORIGINAL_HOME;
  rmSync(tmp, { recursive: true, force: true });
});

const BASE_SPEC = {
  version: "0.4.0",
  ironRules: [
    { id: "iron-1", title: "User intent first", body: "original" },
    { id: "iron-2", title: "Subagent caps", body: "original" },
  ],
  phaseChecklist: [
    { id: "p1", question: "original" },
  ],
  skillRouting: [
    { when: "Debugging", use: "superpowers:systematic-debugging", source: "superpowers" },
  ],
  details: {
    R1: { title: "File Reading", rules: [{ id: "R1.1", text: "original" }] },
  },
  metadata: { name: "claude-sustain" },
};

function writeOverrides(obj) {
  const dir = join(tmp, ".claude", "sustain");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "overrides.json"), JSON.stringify(obj));
}

async function freshImport(rel) {
  const url = new URL(rel + `?t=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(url.href);
}

test("applyOverrides: returns base unchanged when no overrides file", async () => {
  const { applyOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, null);
  assert.deepEqual(result, BASE_SPEC);
});

test("applyOverrides: id-matched ironRule replaces body but keeps unmatched entries", async () => {
  writeOverrides({
    ironRules: [{ id: "iron-1", body: "user-customized" }],
  });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result.ironRules.length, 2);
  assert.equal(result.ironRules.find(r => r.id === "iron-1").body, "user-customized");
  assert.equal(result.ironRules.find(r => r.id === "iron-1").title, "User intent first"); // preserved
  assert.equal(result.ironRules.find(r => r.id === "iron-2").body, "original");
});

test("applyOverrides: new ironRule with new id is appended", async () => {
  writeOverrides({
    ironRules: [{ id: "iron-99", title: "New rule", body: "added by user" }],
  });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result.ironRules.length, 3);
  assert.ok(result.ironRules.find(r => r.id === "iron-99"));
});

test("applyOverrides: skillRouting matches by `when`, replaces or appends", async () => {
  writeOverrides({
    skillRouting: [
      { when: "Debugging", use: "my-custom:debugger", source: "user" },
      { when: "New scenario", use: "my-skill:thing", source: "user" },
    ],
  });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result.skillRouting.length, 2);
  assert.equal(result.skillRouting.find(r => r.when === "Debugging").use, "my-custom:debugger");
  assert.ok(result.skillRouting.find(r => r.when === "New scenario"));
});

test("applyOverrides: details.R<n>.rules id-matched merge", async () => {
  writeOverrides({
    details: {
      R1: { rules: [{ id: "R1.1", text: "user-customized rule text" }] },
    },
  });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result.details.R1.title, "File Reading");
  assert.equal(result.details.R1.rules.find(r => r.id === "R1.1").text, "user-customized rule text");
});

test("applyOverrides: sets _appliedOverrides marker", async () => {
  writeOverrides({ ironRules: [{ id: "iron-1", body: "x" }] });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result._appliedOverrides, true);
});

test("applyOverrides: modelHint arrays APPEND to base by default", async () => {
  const base = {
    ...BASE_SPEC,
    modelHint: { wordLimit: 200, lookupVerbs: ["\\bfind\\b"], heavyKeywords: ["\\bdesign\\b"] },
  };
  writeOverrides({ modelHint: { lookupVerbs: ["\\bcatalog\\b"], heavyKeywords: ["\\baudit\\b"] } });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(base, readOverrides());
  assert.deepEqual(result.modelHint.lookupVerbs, ["\\bfind\\b", "\\bcatalog\\b"]);
  assert.deepEqual(result.modelHint.heavyKeywords, ["\\bdesign\\b", "\\baudit\\b"]);
  assert.equal(result.modelHint.wordLimit, 200);
});

test("applyOverrides: modelHint arrays REPLACE when replace flag is true", async () => {
  const base = {
    ...BASE_SPEC,
    modelHint: { wordLimit: 200, lookupVerbs: ["\\bfind\\b"], heavyKeywords: ["\\bdesign\\b"] },
  };
  writeOverrides({ modelHint: { lookupVerbs: ["\\bonly\\b"], replaceLookupVerbs: true, wordLimit: 50 } });
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  const result = applyOverrides(base, readOverrides());
  assert.deepEqual(result.modelHint.lookupVerbs, ["\\bonly\\b"]);
  assert.deepEqual(result.modelHint.heavyKeywords, ["\\bdesign\\b"]);
  assert.equal(result.modelHint.wordLimit, 50);
});

test("applyOverrides: malformed overrides.json is treated as no overrides", async () => {
  writeOverrides("not json"); // writeFileSync will stringify this — actually let's write raw bytes
  const dir = join(tmp, ".claude", "sustain");
  writeFileSync(join(dir, "overrides.json"), "{ this is not json");
  const { applyOverrides, readOverrides } = await freshImport("../../lib/overrides.js");
  assert.equal(readOverrides(), null);
  const result = applyOverrides(BASE_SPEC, readOverrides());
  assert.equal(result, BASE_SPEC);
});
