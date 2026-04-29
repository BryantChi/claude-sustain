// PreToolUse hook (matcher: Task) — Iron-2 enforcement + model-routing hint.
//
// v0.6 behavior:
//   - Iron-2 word-cap / escape-clause check (warn-only by default; hard-gate
//     when ~/.claude/sustain/strict.json has { "ironGate": true })
//   - Model routing advisory: if the prompt looks like a lookup task, suggest
//     `model: "haiku"` via systemMessage. Never mutates tool_input.
//
// Hard gate is opt-in to preserve back-compat. When tripped it returns a
// permissionDecision=deny via hookSpecificOutput so Claude Code blocks the
// call without the user having to fight a warning loop.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";
import { loadStrict } from "../lib/config.js";
import { modelHint } from "../lib/routing/model-hint.js";

const WORD_CAP_PATTERNS = [
  /[≤<]\s*\d+\s*字/,
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

const toolInput = event.tool_input || event.toolInput || {};
const prompt = toolInput.prompt || "";
const explicitModel = toolInput.model || null;

const hasCap = WORD_CAP_PATTERNS.some(p => p.test(prompt));
const hasEscape = ESCAPE_PATTERNS.some(p => p.test(prompt));

const strict = loadStrict();
const bypassed = strict.bypassPatterns.some(p => p && prompt.includes(p));
const hint = modelHint({ prompt, explicitModel });

const messages = [];
let denyReason = null;

if (!(hasCap && hasEscape)) {
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

  if (strict.ironGate && !bypassed) {
    denyReason = advice + "\n[claude-sustain] Iron-2 hard-gate is on; add the missing pieces or list this prompt fragment in ~/.claude/sustain/strict.json bypassPatterns.";
  } else {
    messages.push(advice);
  }
}

if (hint.advise) {
  messages.push(
    `[claude-sustain] Model hint — consider passing model: "${hint.suggestion}" for this Task. Reason: ${hint.reason}.`
  );
}

if (denyReason) {
  writeJson({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: denyReason
    },
    systemMessage: denyReason
  });
  process.exit(0);
}

if (messages.length > 0) {
  writeJson({ systemMessage: messages.join("\n\n") });
}
process.exit(0);
