// Unit tests for the runtime routing filter.
// Verify that filterRouting() correctly partitions spec.skillRouting based
// on what's installed, including OR-clauses and Anthropic built-ins.

import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRouting } from "../../lib/routing/filter.js";

const FAKE_INSTALLED = [
  { name: "claude-sustain:claude-sustain:phase-self-check", shortName: "phase-self-check", source: "claude-sustain/claude-sustain", kind: "skill" },
  { name: "claude-sustain:claude-sustain:audit-memory", shortName: "audit-memory", source: "claude-sustain/claude-sustain", kind: "skill" },
];

test("filterRouting: claude-sustain only install hides superpowers entries", () => {
  const spec = {
    skillRouting: [
      { when: "phase end", use: "claude-sustain:phase-self-check", source: "claude-sustain" },
      { when: "debugging", use: "superpowers:systematic-debugging", source: "superpowers" },
      { when: "writing plans", use: "superpowers:writing-plans", source: "superpowers" },
      { when: "audit", use: "claude-sustain:audit-memory", source: "claude-sustain" },
    ],
  };
  const r = filterRouting(spec, { installed: FAKE_INSTALLED });
  assert.equal(r.totalCount, 4);
  assert.equal(r.available.length, 2);
  assert.equal(r.unavailable.length, 2);
  assert.deepEqual(r.available.map(e => e.use).sort(), [
    "claude-sustain:audit-memory",
    "claude-sustain:phase-self-check",
  ]);
});

test("filterRouting: Anthropic built-ins are always available", () => {
  const spec = {
    skillRouting: [
      { when: "API", use: "claude-api", source: "anthropic" },
      { when: "config", use: "update-config", source: "anthropic" },
      { when: "UI", use: "frontend-design", source: "anthropic" },
    ],
  };
  const r = filterRouting(spec, { installed: [] });
  assert.equal(r.available.length, 3);
  assert.equal(r.unavailable.length, 0);
});

test("filterRouting: OR-clause counts available if ANY referenced token resolves", () => {
  const spec = {
    skillRouting: [
      // claude-mem is installed in FAKE_INSTALLED2 but mempalace is not — should be available.
      { when: "memory search", use: "claude-mem:smart-explore OR mempalace:search", source: "memory-backend" },
      // Neither installed → unavailable.
      { when: "exotic", use: "made-up-plugin:foo OR another-fake:bar", source: "external" },
    ],
  };
  const installedWithClaudeMem = [
    { name: "thedotmack:claude-mem:smart-explore", shortName: "smart-explore", source: "thedotmack/claude-mem", kind: "skill" },
  ];
  const r = filterRouting(spec, { installed: installedWithClaudeMem });
  assert.equal(r.available.length, 1);
  assert.equal(r.available[0].when, "memory search");
  assert.equal(r.unavailable.length, 1);
});

test("filterRouting: arrow chain (a → b) treated like OR for availability", () => {
  const spec = {
    skillRouting: [
      { when: "creative work", use: "superpowers:brainstorming → superpowers:writing-plans", source: "superpowers" },
    ],
  };
  // Only writing-plans installed → still considered available (any-of).
  const partial = [
    { name: "superpowers-dev:superpowers:writing-plans", shortName: "writing-plans", source: "superpowers-dev/superpowers", kind: "skill" },
  ];
  const r = filterRouting(spec, { installed: partial });
  assert.equal(r.available.length, 1);
});

test("filterRouting: empty spec → empty result", () => {
  const r = filterRouting({ skillRouting: [] }, { installed: [] });
  assert.equal(r.totalCount, 0);
  assert.equal(r.available.length, 0);
  assert.equal(r.unavailable.length, 0);
});

test("filterRouting: agents resolve via ns:name → ns-name.md convention", () => {
  const spec = {
    skillRouting: [
      { when: "stuck", use: "codex:rescue OR gemini:rescue", source: "external-rescue" },
    ],
  };
  const installed = [
    { name: "openai-codex:codex:codex-rescue", shortName: "codex-rescue", source: "openai-codex/codex", kind: "agent" },
  ];
  const r = filterRouting(spec, { installed });
  assert.equal(r.available.length, 1);
});
