// Unified memory adapter.
//
// The fs backend is *always* written (it's our durable, license-clean record).
// When a richer backend is detected, we additionally produce a routing hint so
// the model can mirror the entry through the user's preferred MCP server.
//
// Read path: query() searches fs locally. If a richer backend is preferred,
// the result also includes a "suggestion" pointing the model at the MCP tool.
//
// Plugin code cannot call MCP itself, so suggestions are surfaced as text and
// it is the model's job to act on them.

import * as fs from "./backends/fs.js";
import * as claudeMem from "./backends/claude-mem.js";
import * as mempalace from "./backends/mempalace.js";
import { readState } from "./state.js";

function resolvePreferred() {
  const state = readState();
  return state?.detection?.preferred || "fs";
}

export function write({ wing, slug, body, date } = {}) {
  if (!wing) throw new Error("write: 'wing' is required (e.g. 'feedback', 'project').");
  if (!slug) throw new Error("write: 'slug' is required.");
  const result = fs.write({ wing, slug, body, date });
  const preferred = resolvePreferred();
  if (preferred === "mempalace") {
    result.hint = mempalace.writeHint({ wing, slug, body });
  } else if (preferred === "claude-mem") {
    result.hint = claudeMem.writeHint({ wing, slug, body });
  }
  result.preferred = preferred;
  return result;
}

export function query({ text, wing } = {}) {
  const hits = fs.query({ text, wing });
  const preferred = resolvePreferred();
  const out = { hits, preferred };
  if (preferred === "mempalace") {
    out.suggestion = mempalace.queryHint({ text, wing });
  } else if (preferred === "claude-mem") {
    out.suggestion = claudeMem.queryHint({ text, wing });
  }
  return out;
}

export function listAll() {
  return fs.listAll();
}

export function rebuildIndex() {
  return fs.rebuildIndex();
}
