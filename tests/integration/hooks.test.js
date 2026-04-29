// Integration tests for hook scripts.
// Each test spawns the hook with a JSON payload on stdin and asserts on
// stdout JSON / exit code. As of v0.1.1 hooks emit a user-visible
// `systemMessage` field alongside the existing Claude-context fields.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function runHook(scriptRel, payload, extraEnv = {}) {
  const script = resolve(ROOT, scriptRel);
  const result = spawnSync("node", [script], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: ROOT, ...extraEnv }
  });
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status
  };
}

function withConfigDir(files) {
  const dir = mkdtempSync(join(tmpdir(), "sustain-cfg-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
  }
  return {
    dir,
    cleanup: () => { try { rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}

test("PreToolUse: compliant non-lookup Task is silent (no Iron-2 advisory, no model hint)", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Task",
    tool_input: {
      prompt: "Implement the new export pipeline as described in the plan. ≤ 2000 字。但發現異常或重大問題務必詳述，不受字數限制。"
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
  assert.match(out.hookSpecificOutput.additionalContext, /Memory backend/);
  assert.match(out.hookSpecificOutput.additionalContext, /Skill routing — \d+\/\d+ entries available/);
  assert.match(out.systemMessage, /claude-sustain v/);
  assert.match(out.systemMessage, /active/);
  assert.match(out.systemMessage, /\d+\/\d+ skill routes/);
  assert.match(out.systemMessage, /memory: (fs|mempalace|claude-mem)/);
});

test("Stop: emits checklist + token line in user-visible systemMessage", () => {
  const r = runHook("hooks/stop.js", { transcript_path: "/nonexistent" });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.systemMessage, /phase-end checklist/);
  assert.match(out.systemMessage, /tokens:/);
});

test("PreToolUse: lookup-style Task gets a model hint", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Task",
    tool_input: { prompt: "Find all files containing TODO and list them. ≤ 200 字。但發現異常或重大問題務必詳述，不受字數限制。" }
  });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.systemMessage, /Model hint/);
  assert.match(out.systemMessage, /haiku/);
});

test("PreToolUse: design-style Task does not get a model hint", () => {
  const r = runHook("hooks/pre-tool-use.js", {
    tool_name: "Task",
    tool_input: { prompt: "Refactor the auth module. ≤ 2000 字。但發現異常或重大問題務必詳述，不受字數限制。" }
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "", "compliant non-lookup Task should be silent");
});

test("PreToolUse: hard-gate denies missing-cap Task when ironGate=true", () => {
  const cfg = withConfigDir({ "strict.json": { ironGate: true, bypassPatterns: [] } });
  try {
    const r = runHook("hooks/pre-tool-use.js", {
      tool_name: "Task",
      tool_input: { prompt: "Survey the project and report back." }
    }, { CLAUDE_SUSTAIN_CONFIG_DIR: cfg.dir });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /Iron-2/);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /hard-gate/);
  } finally { cfg.cleanup(); }
});

test("PreToolUse: hard-gate respects bypassPatterns", () => {
  const cfg = withConfigDir({ "strict.json": { ironGate: true, bypassPatterns: ["#bypass-iron2"] } });
  try {
    const r = runHook("hooks/pre-tool-use.js", {
      tool_name: "Task",
      tool_input: { prompt: "Survey the project and report back. #bypass-iron2" }
    }, { CLAUDE_SUSTAIN_CONFIG_DIR: cfg.dir });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout || "{}");
    assert.equal(out.hookSpecificOutput?.permissionDecision, undefined, "bypass should not deny");
    assert.match(out.systemMessage || "", /Iron-2 advisory/);
  } finally { cfg.cleanup(); }
});

test("PreToolUse: hard-gate off (default) preserves warn-only behavior", () => {
  const cfg = withConfigDir({ "strict.json": { ironGate: false } });
  try {
    const r = runHook("hooks/pre-tool-use.js", {
      tool_name: "Task",
      tool_input: { prompt: "Survey the project and report back." }
    }, { CLAUDE_SUSTAIN_CONFIG_DIR: cfg.dir });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput?.permissionDecision, undefined);
    assert.match(out.systemMessage, /Iron-2 advisory/);
  } finally { cfg.cleanup(); }
});
