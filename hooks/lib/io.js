// Hook IO helpers: read stdin JSON, write stdout JSON, locate plugin root.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, "../..");

export function readStdinJson() {
  try {
    const data = readFileSync(0, "utf8");
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export function loadSpec() {
  return JSON.parse(readFileSync(resolve(PLUGIN_ROOT, "rules/spec.json"), "utf8"));
}
