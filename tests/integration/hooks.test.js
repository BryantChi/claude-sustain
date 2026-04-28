// Integration tests for hook scripts.
// Each test spawns the hook with a JSON payload on stdin and asserts on
// stdout JSON / exit code. As of v0.1.1 hooks emit a user-visible
// `systemMessage` field alongside the existing Claude-context fields.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function runHook(scriptRel, payload) {
  const script = resolve(ROOT, scriptRel);
  const result = spawnSync("node", [script], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT }
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status
  };
}

test("PreToolUse: Task with cap + escape clause exits silently", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Task",
    tool_input: {
      prompt: "Survey the project. ≤ 800 字。但發現異常或重大問題務必詳述，不受字數限制。"
    }
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr.trim(), "");
});

test("PreToolUse: Task missing cap emits systemMessage advisory", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Task",
    tool_input: { prompt: "Survey the project and report back." }
  });
  assert.equal(r.status, 0, "warn-only must exit 0");
  const out = JSON.parse(r.stdout);
  assert.match(out.systemMessage, /Iron-2/);
  assert.match(out.systemMessage, /word cap|字/);
});

test("PreToolUse: non-Task tool is ignored", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Read",
    tool_input: { file_path: "/tmp/x" }
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
});

test("UserPromptSubmit: keyword '逐個' triggers Iron-1 reminder + visible systemMessage", () => {
  const r = runHook("hooks/user-prompt-submit.js", {
    prompt: "請逐個檢查這些檔案"
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(out.hookSpecificOutput.additionalContext, /Iron-1/);
  assert.match(out.systemMessage, /Iron-1/);
  assert.match(out.systemMessage, /逐個/);
});

test("UserPromptSubmit: keyword 'thoroughly' triggers Iron-1 reminder", () => {
  const r = runHook("hooks/user-prompt-submit.js", {
    prompt: "Please thoroughly review the migration script"
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /Iron-1/);
  assert.match(out.systemMessage, /thoroughly/);
});

test("UserPromptSubmit: benign prompt does not inject context", () => {
  const r = runHook("hooks/user-prompt-submit.js", {
    prompt: "fix the typo on line 42"
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), "");
});

test("SessionStart: emits primer with version, Claude-context and user systemMessage", () => {
  const r = runHook("hooks/session-start.js", {});
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /claude-sustain v/);
  assert.match(out.hookSpecificOutput.additionalContext, /IRON-1/i);
  assert.match(out.systemMessage, /claude-sustain v/);
  assert.match(out.systemMessage, /active/);
});

test("Stop: emits checklist + token line in user-visible systemMessage", () => {
  const r = runHook("hooks/stop.js", { transcript_path: "/nonexistent" });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.systemMessage, /phase-end checklist/);
  assert.match(out.systemMessage, /tokens:/);
});
