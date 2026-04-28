#!/usr/bin/env node
// Compare two measurement snapshots produced by measure-sessions.js.
// Prints per-metric deltas so we can answer "did the plugin actually save tokens?"

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function fmt(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function pct(before, after) {
  if (!before) return after === 0 ? 0 : Infinity;
  return ((after - before) / before) * 100;
}

function arrow(delta) {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "·";
}

async function main() {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) {
    console.error("Usage: compare-snapshots.js BASELINE.json WITH-PLUGIN.json");
    process.exit(1);
  }
  const before = JSON.parse(await readFile(resolve(a), "utf8"));
  const after = JSON.parse(await readFile(resolve(b), "utf8"));

  const metrics = [
    ["sessions", "sessions"],
    ["avg_tokens_per_session", "avg total tokens / session"],
    ["median_tokens_per_session", "median total tokens / session"],
    ["input", "total input"],
    ["output", "total output"],
    ["cache_creation", "cache creation"],
    ["cache_read", "cache read"],
    ["cache_hit_rate_pct", "cache hit rate (%)"]
  ];

  console.log(`Baseline:    ${before.label}  (${before.range.since || "any"} → ${before.range.until || "any"})  n=${before.summary.sessions}`);
  console.log(`With plugin: ${after.label}   (${after.range.since || "any"} → ${after.range.until || "any"})  n=${after.summary.sessions}`);
  console.log("");
  console.log("Metric                                  Baseline      With plugin   Δ          Δ%");
  console.log("---------------------------------------------------------------------------------");
  for (const [key, label] of metrics) {
    const bv = before.summary[key] || 0;
    const av = after.summary[key] || 0;
    const delta = av - bv;
    const pctDelta = pct(bv, av);
    const fmtDelta = key === "cache_hit_rate_pct"
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}pp`
      : `${delta >= 0 ? "+" : ""}${fmt(delta)}`;
    const fmtPct = isFinite(pctDelta) ? `${pctDelta >= 0 ? "+" : ""}${pctDelta.toFixed(1)}%` : "n/a";
    console.log(
      `${label.padEnd(40)}${fmt(bv).padStart(12)}  ${fmt(av).padStart(12)}  ${arrow(delta)}${fmtDelta.padStart(8)}  ${fmtPct.padStart(7)}`
    );
  }

  console.log("");
  const avgPct = pct(before.summary.avg_tokens_per_session, after.summary.avg_tokens_per_session);
  if (avgPct <= -10) {
    console.log(`✅ Avg tokens/session dropped ${(-avgPct).toFixed(1)}% — meets MVP threshold (≥10%).`);
  } else if (avgPct < 0) {
    console.log(`⚠ Avg tokens/session dropped only ${(-avgPct).toFixed(1)}% — below MVP threshold (10%).`);
  } else {
    console.log(`❌ Avg tokens/session increased ${avgPct.toFixed(1)}% — investigate (could be heavier sessions, not regression).`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
