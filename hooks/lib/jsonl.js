// Best-effort token tally from a Claude Code session JSONL transcript.
// Returns null when the transcript can't be located so callers can skip gracefully.

import { readFileSync, existsSync } from "node:fs";

export function tallyTokens(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return null;
  let text;
  try {
    text = readFileSync(transcriptPath, "utf8");
  } catch {
    return null;
  }
  const totals = { input: 0, output: 0, cache_creation: 0, cache_read: 0 };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let evt;
    try { evt = JSON.parse(line); } catch { continue; }
    const usage = evt?.message?.usage || evt?.usage;
    if (!usage) continue;
    totals.input += usage.input_tokens || 0;
    totals.output += usage.output_tokens || 0;
    totals.cache_creation += usage.cache_creation_input_tokens || 0;
    totals.cache_read += usage.cache_read_input_tokens || 0;
  }
  return totals;
}

export function formatTokens(t) {
  if (!t) return "tokens: n/a";
  const f = n => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);
  const cacheTotal = t.cache_creation + t.cache_read;
  const hitRate = cacheTotal > 0 ? Math.round((t.cache_read / cacheTotal) * 100) : 0;
  return `tokens: ${f(t.input)} in / ${f(t.output)} out / cache hit ${hitRate}%`;
}
