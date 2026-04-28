#!/usr/bin/env node
// CI guard against personal-path / username leakage in shipped files.
// Fails (exit 1) if any forbidden token appears outside the allowed list.

import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage", "tests/fixtures", "validation"]);
const SKIP_FILES = new Set(["lint-personal.js"]);

const FORBIDDEN = [
  { pattern: /bryantchi/gi, label: "username 'bryantchi'", allowIn: ["package.json", "LICENSE", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json", "README.md", "CHANGELOG.md"] },
  { pattern: /\/Users\/[A-Za-z0-9_-]+/g, label: "absolute /Users/<name> path", allowIn: [] },
  { pattern: /\/home\/[A-Za-z0-9_-]+/g, label: "absolute /home/<name> path", allowIn: [] }
];

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = resolve(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

async function main() {
  const failures = [];
  for await (const file of walk(ROOT)) {
    const rel = relative(ROOT, file);
    if (SKIP_FILES.has(rel.split("/").pop())) continue;
    const ext = rel.split(".").pop();
    if (!["js", "mjs", "ts", "json", "md", "sh", "yml", "yaml", "toml"].includes(ext)) continue;
    const info = await stat(file);
    if (info.size > 1_000_000) continue;
    const content = await readFile(file, "utf8");
    for (const rule of FORBIDDEN) {
      if (rule.allowIn.includes(rel)) continue;
      const matches = content.match(rule.pattern);
      if (matches) {
        failures.push({ rel, label: rule.label, samples: [...new Set(matches)].slice(0, 3) });
      }
    }
  }
  if (failures.length) {
    console.error("Personal-content lint failed:");
    for (const f of failures) {
      console.error(`  ${f.rel}: ${f.label}  →  ${f.samples.join(", ")}`);
    }
    process.exit(1);
  }
  console.log("Personal-content lint passed.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
