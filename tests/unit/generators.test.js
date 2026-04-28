// Unit tests for spec → markdown generators.
// Validates structural invariants rather than full snapshot equality —
// the spec content is expected to evolve and we don't want test churn on every wording tweak.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generate as genClaude } from "../../lib/generators/claude.js";
import { generate as genAgents } from "../../lib/generators/agents.js";
import { generate as genGemini } from "../../lib/generators/gemini.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const spec = JSON.parse(readFileSync(resolve(ROOT, "rules/spec.json"), "utf8"));

test("CLAUDE.md contains all four Iron Rules", () => {
  const out = genClaude(spec);
  for (const rule of spec.ironRules) {
    assert.match(out, new RegExp(rule.id, "i"), `missing ${rule.id}`);
    assert.ok(out.includes(rule.title), `missing title "${rule.title}"`);
  }
});

test("CLAUDE.md contains all phase checklist questions", () => {
  const out = genClaude(spec);
  for (const item of spec.phaseChecklist) {
    const firstWord = item.question.split(/\s+/)[0].slice(0, 12);
    assert.ok(out.includes(firstWord), `phase checklist item "${item.id}" not rendered`);
  }
});

test("CLAUDE.md contains every skill routing entry", () => {
  const out = genClaude(spec);
  for (const r of spec.skillRouting) {
    assert.ok(out.includes(r.use), `routing entry "${r.use}" missing`);
  }
});

test("CLAUDE.md renders all R1–R5 detail rules", () => {
  const out = genClaude(spec);
  for (const key of Object.keys(spec.details)) {
    for (const rule of spec.details[key].rules) {
      assert.ok(out.includes(rule.id), `${rule.id} missing in CLAUDE.md`);
    }
  }
});

test("AGENTS.md is structurally similar to CLAUDE.md but uses neutral framing", () => {
  const claude = genClaude(spec);
  const agents = genAgents(spec);
  for (const rule of spec.ironRules) {
    assert.ok(agents.includes(rule.title), `AGENTS.md missing ${rule.title}`);
  }
  assert.ok(agents.includes("the agent"), "AGENTS.md should use generic 'the agent' phrasing");
  assert.ok(Math.abs(agents.length - claude.length) < claude.length * 0.5, "AGENTS.md too divergent from CLAUDE.md in size");
});

test("GEMINI.md is short and points to AGENTS.md", () => {
  const out = genGemini(spec);
  assert.ok(out.length < 1000, "GEMINI.md should be a thin pointer");
  assert.ok(/AGENTS\.md/.test(out), "GEMINI.md must reference AGENTS.md");
});

test("Generators are deterministic (idempotent)", () => {
  assert.equal(genClaude(spec), genClaude(spec));
  assert.equal(genAgents(spec), genAgents(spec));
  assert.equal(genGemini(spec), genGemini(spec));
});
