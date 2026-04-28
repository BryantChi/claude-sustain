// state.json — cached backend detection + sustain runtime state.
//
// Location: ~/.claude/sustain/state.json
// Schema:
//   {
//     version: "0.2.0",
//     detection: <detect() result>
//   }
//
// Refreshed every SessionStart (cheap — only filesystem stats).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const STATE_DIR = join(homedir(), ".claude", "sustain");
export const STATE_FILE = join(STATE_DIR, "state.json");
export const STATE_VERSION = "0.2.0";

export function readState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function writeState(detection) {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload = {
    version: STATE_VERSION,
    detection,
  };
  writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2));
  return payload;
}
