// UserPromptSubmit hook — Iron-1 keyword detection.
// When the user signals "exhaustive" intent, inject a reminder so the agent
// avoids templating / batching / parallel shortcuts for this turn.

import { readStdinJson, writeJson, loadSpec } from "./lib/io.js";

const event = readStdinJson();
const prompt = event.prompt || event.user_prompt || event.userPrompt || "";

let spec;
try { spec = loadSpec(); } catch { spec = null; }
const iron1 = spec?.ironRules?.find(r => r.id === "iron-1");
const keywords = iron1?.triggers?.keywords || [
  "逐個", "仔細", "全部", "不要省略", "都要確認", "thoroughly", "each", "all", "every"
];

const hit = keywords.find(k => {
  if (/^[a-z]+$/i.test(k)) {
    return new RegExp(`\\b${k}\\b`, "i").test(prompt);
  }
  return prompt.includes(k);
});

if (!hit) {
  process.exit(0);
}

const reminder = [
  `[claude-sustain] Iron-1 active — user intent contains "${hit}".`,
  "Take the original path. Do not apply templating, batching, parallelization, or sampling shortcuts.",
  "Verify every item the user asked about; do not infer or skip."
].join(" ");

writeJson({
  systemMessage: `[claude-sustain] Iron-1 active — keyword "${hit}" detected; shortcuts disabled for this turn`,
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: reminder
  }
});
process.exit(0);
