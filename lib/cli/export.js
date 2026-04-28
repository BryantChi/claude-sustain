#!/usr/bin/env node
// CLI entry for /sustain:export and `npm run export`.
// Reads rules/spec.json and writes CLAUDE.md / AGENTS.md / GEMINI.md to a target dir.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate as genClaude } from "../generators/claude.js";
import { generate as genAgents } from "../generators/agents.js";
import { generate as genGemini } from "../generators/gemini.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function parseArgs(argv) {
  const args = { target: process.cwd(), only: null };
  for (const a of argv.slice(2)) {
    if (a.startsWith("--target=")) args.target = a.slice("--target=".length);
    else if (a.startsWith("--only=")) args.only = a.slice("--only=".length).split(",");
  }
  if (args.target === "plugin-self") args.target = ROOT;
  return args;
}

async function main() {
  const { target, only } = parseArgs(process.argv);
  const specPath = join(ROOT, "rules", "spec.json");
  if (!existsSync(specPath)) {
    console.error(`spec.json not found at ${specPath}`);
    process.exit(1);
  }
  const spec = JSON.parse(await readFile(specPath, "utf8"));

  const outputs = {
    "CLAUDE.md": genClaude(spec),
    "AGENTS.md": genAgents(spec),
    "GEMINI.md": genGemini(spec)
  };

  const targetAbs = resolve(target);
  await mkdir(targetAbs, { recursive: true });

  for (const [name, content] of Object.entries(outputs)) {
    if (only && !only.includes(name)) continue;
    const path = join(targetAbs, name);
    await writeFile(path, content);
    console.log(`wrote ${path} (${content.length} bytes)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
