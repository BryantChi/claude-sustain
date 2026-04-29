import { test } from "node:test";
import assert from "node:assert/strict";
import { modelHint } from "../../lib/routing/model-hint.js";

test("advises haiku for short lookup prompts", () => {
  const r = modelHint({ prompt: "Find all files containing TODO and list them." });
  assert.equal(r.advise, true);
  assert.equal(r.suggestion, "haiku");
});

test("advises haiku for short Chinese lookup prompts", () => {
  const r = modelHint({ prompt: "找出所有 TODO 標記，列出檔名" });
  assert.equal(r.advise, true);
});

test("does not advise when explicit model is set", () => {
  const r = modelHint({ prompt: "Find TODOs", explicitModel: "opus" });
  assert.equal(r.advise, false);
});

test("does not advise when prompt has heavy keywords", () => {
  const r = modelHint({ prompt: "Find TODOs and refactor the surrounding code." });
  assert.equal(r.advise, false);
});

test("does not advise when prompt is too long", () => {
  const long = "find ".repeat(220);
  const r = modelHint({ prompt: long });
  assert.equal(r.advise, false);
});

test("does not advise when no lookup verb is present", () => {
  const r = modelHint({ prompt: "Please tell me your opinion on this approach." });
  assert.equal(r.advise, false);
});

test("does not advise on empty prompt", () => {
  assert.equal(modelHint({ prompt: "" }).advise, false);
  assert.equal(modelHint({}).advise, false);
});

test("uses custom config: extra lookup verb triggers advise", () => {
  const config = {
    wordLimit: 200,
    lookupVerbs: ["\\bcatalog\\b"],
    heavyKeywords: [],
  };
  const r = modelHint({ prompt: "Catalog the package contents.", config });
  assert.equal(r.advise, true);
});

test("uses custom config: extra heavy keyword suppresses advise", () => {
  const config = {
    wordLimit: 200,
    lookupVerbs: ["\\bfind\\b"],
    heavyKeywords: ["\\bcatalog\\b"],
  };
  const r = modelHint({ prompt: "Find and catalog the package.", config });
  assert.equal(r.advise, false);
});

test("uses custom wordLimit", () => {
  const promptOf = n => "find " + "x ".repeat(n - 1).trim();
  const config = { wordLimit: 5, lookupVerbs: ["\\bfind\\b"], heavyKeywords: [] };
  assert.equal(modelHint({ prompt: promptOf(4), config }).advise, true);
  assert.equal(modelHint({ prompt: promptOf(10), config }).advise, false);
});
