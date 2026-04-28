// PreToolUse hook (matcher: Task) — Iron-2 enforcement (warn-only in v0.1).
// Checks that subagent prompts include a word cap and an escape clause.
// Never blocks in v0.1 — emits a user-visible systemMessage advisory and exits 0
// so we can collect data before deciding whether to enforce.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";

const WORD_CAP_PATTERNS = [
  /[≤<]\s*\d+\s*字/,           // 中文：≤ 200 字
  /(?:max|cap|limit)[^\n]{0,40}\d+\s*(?:words|tokens)/i,
  /\b(?:under|less than)\s+\d+\s*(?:words|tokens)\b/i,
  /\bword\s*cap\b/i,
  /≤\s*\d+\s*(?:words|tokens)/i
];

const ESCAPE_PATTERNS = [
  /不受字數限制/,
  /escape\s+clause/i,
  /report[^\n]{0,40}(?:in full|regardless|anomal|significant)/i,
  /異常.*詳述/,
  /重大.*務必/
];

const event = readStdinJson();
const toolName = event.tool_name || event.toolName;
if (toolName !== "Task") {
  process.exit(0);
}

const prompt = event.tool_input?.prompt || event.toolInput?.prompt || "";

const hasCap = WORD_CAP_PATTERNS.some(p => p.test(prompt));
const hasEscape = ESCAPE_PATTERNS.some(p => p.test(prompt));

if (hasCap && hasEscape) {
  process.exit(0);
}

let spec;
try { spec = loadSpec(); } catch { spec = null; }
const iron2 = spec?.ironRules?.find(r => r.id === "iron-2");

const missing = [];
if (!hasCap) missing.push("word cap (e.g. \"≤ 800 字\" or \"under 800 words\")");
if (!hasEscape) missing.push("escape clause (e.g. \"但發現異常或重大問題務必詳述，不受字數限制\")");

const advice = [
  "[claude-sustain] Iron-2 advisory — subagent prompt is missing:",
  ...missing.map(m => `  • ${m}`),
  iron2 ? `Reference caps: pure-check ≤200 / structural ≤800 / deep-analysis ≤2000.` : ""
].filter(Boolean).join("\n");

writeJson({ systemMessage: advice });
process.exit(0);
