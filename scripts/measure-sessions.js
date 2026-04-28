#!/usr/bin/env node
// Per-session token measurement for the claude-sustain validation protocol.
// Walks Claude Code's session JSONL store, tallies tokens per session,
// and emits a snapshot suitable for baseline-vs-with-plugin comparison.
//
// Usage:
//   node scripts/measure-sessions.js [--since=YYYY-MM-DD] [--until=YYYY-MM-DD]
//     [--projects-dir=PATH] [--label=NAME] [--out=FILE] [--top=N] [--json]

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { homedir } from "node:os";

function parseArgs(argv) {
  const args = {
    since: null,
    until: null,
    projectsDir: join(homedir(), ".claude", "projects"),
    label: "snapshot",
    out: null,
    top: 10,
    jsonOnly: false
  };
  for (const a of argv.slice(2)) {
    const [k, v] = a.includes("=") ? a.split("=", 2) : [a, true];
    switch (k) {
      case "--since": args.since = v; break;
      case "--until": args.until = v; break;
      case "--projects-dir": args.projectsDir = v; break;
      case "--label": args.label = v; break;
      case "--out": args.out = v; break;
      case "--top": args.top = Number(v); break;
      case "--json": args.jsonOnly = true; break;
    }
  }
  return args;
}

function emptyTotals() {
  return { input: 0, output: 0, cache_creation: 0, cache_read: 0, events: 0 };
}

function add(a, b) {
  a.input += b.input;
  a.output += b.output;
  a.cache_creation += b.cache_creation;
  a.cache_read += b.cache_read;
  a.events += b.events;
  return a;
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function cacheHitRate(t) {
  const total = t.cache_creation + t.cache_read;
  return total > 0 ? Math.round((t.cache_read / total) * 100) : 0;
}

async function processJsonl(filePath) {
  let content;
  try { content = await readFile(filePath, "utf8"); } catch { return null; }
  const totals = emptyTotals();
  let firstTs = null;
  let lastTs = null;
  let sessionId = basename(filePath, ".jsonl");
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let evt;
    try { evt = JSON.parse(line); } catch { continue; }
    if (evt.sessionId) sessionId = evt.sessionId;
    if (evt.timestamp) {
      if (!firstTs || evt.timestamp < firstTs) firstTs = evt.timestamp;
      if (!lastTs || evt.timestamp > lastTs) lastTs = evt.timestamp;
    }
    const usage = evt?.message?.usage || evt?.usage;
    if (!usage) continue;
    totals.input += usage.input_tokens || 0;
    totals.output += usage.output_tokens || 0;
    totals.cache_creation += usage.cache_creation_input_tokens || 0;
    totals.cache_read += usage.cache_read_input_tokens || 0;
    totals.events += 1;
  }
  return { sessionId, firstTs, lastTs, totals, file: filePath };
}

function inDateRange(record, since, until) {
  const ts = record.firstTs || record.lastTs;
  if (!ts) return false;
  const day = ts.slice(0, 10);
  if (since && day < since) return false;
  if (until && day > until) return false;
  return true;
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : Math.round((sorted[m - 1] + sorted[m]) / 2);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(args.projectsDir)) {
    console.error(`projects dir not found: ${args.projectsDir}`);
    process.exit(1);
  }

  const projects = await readdir(args.projectsDir);
  const sessions = [];

  for (const projDir of projects) {
    const projPath = join(args.projectsDir, projDir);
    let st;
    try { st = await stat(projPath); } catch { continue; }
    if (!st.isDirectory()) continue;
    let entries;
    try { entries = await readdir(projPath); } catch { continue; }
    for (const f of entries) {
      if (!f.endsWith(".jsonl")) continue;
      const rec = await processJsonl(join(projPath, f));
      if (!rec) continue;
      if (rec.totals.events === 0) continue;
      rec.project = projDir;
      if (!inDateRange(rec, args.since, args.until)) continue;
      sessions.push(rec);
    }
  }

  sessions.sort((a, b) => (b.totals.input + b.totals.output) - (a.totals.input + a.totals.output));

  const summary = sessions.reduce((acc, s) => add(acc, s.totals), emptyTotals());
  const totalsPerSession = sessions.map(s => s.totals.input + s.totals.output);

  const snapshot = {
    label: args.label,
    range: { since: args.since, until: args.until },
    projects_dir: args.projectsDir,
    generated_at: new Date().toISOString(),
    summary: {
      sessions: sessions.length,
      ...summary,
      cache_hit_rate_pct: cacheHitRate(summary),
      avg_tokens_per_session: sessions.length ? Math.round((summary.input + summary.output) / sessions.length) : 0,
      median_tokens_per_session: median(totalsPerSession)
    },
    sessions: sessions.map(s => ({
      id: s.sessionId,
      project: s.project,
      started_at: s.firstTs,
      ended_at: s.lastTs,
      tokens: s.totals,
      cache_hit_rate_pct: cacheHitRate(s.totals),
      total_tokens: s.totals.input + s.totals.output
    }))
  };

  if (args.out) {
    await writeFile(resolve(args.out), JSON.stringify(snapshot, null, 2));
  }

  if (args.jsonOnly) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  const range = `${args.since || "(any)"} → ${args.until || "(any)"}`;
  console.log(`== claude-sustain measurement: ${args.label} (${range}) ==`);
  console.log(`Sessions found: ${snapshot.summary.sessions}`);
  console.log(`Total tokens:   ${fmt(summary.input)} in / ${fmt(summary.output)} out / cache ${fmt(summary.cache_creation)} creation / ${fmt(summary.cache_read)} read (hit ${snapshot.summary.cache_hit_rate_pct}%)`);
  console.log(`Avg / session:  ${fmt(snapshot.summary.avg_tokens_per_session)} (input+output)`);
  console.log(`Median / session: ${fmt(snapshot.summary.median_tokens_per_session)} (input+output)`);
  if (args.out) console.log(`Snapshot written: ${resolve(args.out)}`);
  console.log("");
  if (args.top > 0 && sessions.length) {
    console.log(`Top ${Math.min(args.top, sessions.length)} sessions by total tokens (input+output):`);
    sessions.slice(0, args.top).forEach((s, i) => {
      const total = s.totals.input + s.totals.output;
      const day = (s.firstTs || "").slice(0, 10);
      console.log(`  ${String(i + 1).padStart(2)}. ${day}  ${fmt(total).padStart(7)}  cache ${cacheHitRate(s.totals)}%  ${s.project}/${s.sessionId.slice(0, 8)}`);
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
