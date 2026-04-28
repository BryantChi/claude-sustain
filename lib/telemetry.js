// Telemetry log: one JSONL row per Stop event.
//
// File: ~/.claude/sustain/telemetry/<YYYY-MM-DD>.jsonl
// Schema (one row): { ts, sessionId, transcriptPath, tokens: {...}, hitRate }
//
// The Stop hook calls append() with whatever it managed to tally; readers
// (e.g. /sustain:status) compute moving averages with movingAverage().

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TELEMETRY_DIR = join(homedir(), ".claude", "sustain", "telemetry");

function ensureDir() {
  if (!existsSync(TELEMETRY_DIR)) mkdirSync(TELEMETRY_DIR, { recursive: true });
}

function todayFile() {
  return join(TELEMETRY_DIR, new Date().toISOString().slice(0, 10) + ".jsonl");
}

export function append({ sessionId, transcriptPath, tokens } = {}) {
  if (!tokens) return null;
  ensureDir();
  const cacheTotal = (tokens.cache_creation || 0) + (tokens.cache_read || 0);
  const hitRate = cacheTotal > 0 ? tokens.cache_read / cacheTotal : 0;
  const row = {
    ts: new Date().toISOString(),
    sessionId: sessionId || null,
    transcriptPath: transcriptPath || null,
    tokens: {
      input: tokens.input || 0,
      output: tokens.output || 0,
      cache_creation: tokens.cache_creation || 0,
      cache_read: tokens.cache_read || 0,
    },
    hitRate: Number(hitRate.toFixed(4)),
  };
  appendFileSync(todayFile(), JSON.stringify(row) + "\n");
  return row;
}

export function readAll({ sinceDays = 30 } = {}) {
  if (!existsSync(TELEMETRY_DIR)) return [];
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000;
  const files = readdirSync(TELEMETRY_DIR)
    .filter(f => f.endsWith(".jsonl"))
    .sort();
  const rows = [];
  for (const f of files) {
    let content;
    try { content = readFileSync(join(TELEMETRY_DIR, f), "utf8"); } catch { continue; }
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (new Date(row.ts).getTime() >= cutoff) rows.push(row);
      } catch { /* skip malformed line */ }
    }
  }
  return rows;
}

export function movingAverage({ sinceDays = 7 } = {}) {
  const rows = readAll({ sinceDays });
  if (rows.length === 0) return null;
  const sum = { input: 0, output: 0, cache_creation: 0, cache_read: 0, hitRate: 0 };
  for (const r of rows) {
    sum.input += r.tokens.input;
    sum.output += r.tokens.output;
    sum.cache_creation += r.tokens.cache_creation;
    sum.cache_read += r.tokens.cache_read;
    sum.hitRate += r.hitRate;
  }
  const n = rows.length;
  return {
    samples: n,
    avgInput: Math.round(sum.input / n),
    avgOutput: Math.round(sum.output / n),
    avgCacheCreation: Math.round(sum.cache_creation / n),
    avgCacheRead: Math.round(sum.cache_read / n),
    avgHitRate: Number((sum.hitRate / n).toFixed(4)),
  };
}
