// Filesystem fallback backend.
//
// Mirrors mempalace's wings/rooms/drawers structure so a future migration can
// import these files without restructuring:
//
//   ~/.claude/sustain/memory/
//   ├── MEMORY.md                       (wings index, one line per drawer)
//   └── wings/
//       └── <wing>/
//           └── drawers/
//               └── <YYYY-MM-DD>-<slug>.md
//
// Each drawer file is a markdown document with YAML frontmatter:
//   ---
//   wing: feedback
//   slug: dont-mock-database
//   created: 2026-04-29T...
//   ---
//   <body>

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MEMORY_ROOT = join(homedir(), ".claude", "sustain", "memory");
export const MEMORY_INDEX = join(MEMORY_ROOT, "MEMORY.md");

const VALID_WING = /^[a-z][a-z0-9-]*$/;
const VALID_SLUG = /^[a-z0-9][a-z0-9-]*$/;

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function drawerPath(wing, filename) {
  return join(MEMORY_ROOT, "wings", wing, "drawers", filename);
}

function listDrawers(wing) {
  const dir = join(MEMORY_ROOT, "wings", wing, "drawers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith(".md"))
    .map(name => ({ name, path: join(dir, name) }));
}

function listWings() {
  const dir = join(MEMORY_ROOT, "wings");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
  });
}

function buildFrontmatter(meta) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

export function write({ wing, slug, body, date }) {
  if (!wing || !VALID_WING.test(wing)) {
    throw new Error(`Invalid wing: "${wing}" (use lowercase, hyphens; e.g. "feedback")`);
  }
  const safeSlug = slugify(slug);
  if (!VALID_SLUG.test(safeSlug)) {
    throw new Error(`Invalid slug after normalization: "${safeSlug}"`);
  }
  const day = date || todayISO();
  const filename = `${day}-${safeSlug}.md`;
  const file = drawerPath(wing, filename);
  ensureDir(join(MEMORY_ROOT, "wings", wing, "drawers"));

  const content = buildFrontmatter({
    wing,
    slug: safeSlug,
    created: new Date().toISOString(),
  }) + (body || "").trim() + "\n";

  writeFileSync(file, content);
  refreshIndex();
  return { path: file, wing, slug: safeSlug, date: day };
}

export function query({ text, wing }) {
  const needle = String(text || "").trim().toLowerCase();
  if (!needle) return [];
  const wings = wing ? [wing] : listWings();
  const hits = [];
  for (const w of wings) {
    for (const drawer of listDrawers(w)) {
      let content;
      try { content = readFileSync(drawer.path, "utf8"); } catch { continue; }
      if (content.toLowerCase().includes(needle)) {
        hits.push({
          wing: w,
          path: drawer.path,
          name: drawer.name,
          excerpt: extractExcerpt(content, needle),
        });
      }
    }
  }
  return hits;
}

function extractExcerpt(content, needle) {
  const idx = content.toLowerCase().indexOf(needle);
  if (idx < 0) return content.slice(0, 160);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + needle.length + 60);
  return (start > 0 ? "…" : "") + content.slice(start, end).replace(/\s+/g, " ").trim() + (end < content.length ? "…" : "");
}

function refreshIndex() {
  const wings = listWings();
  const lines = ["# Memory Index", ""];
  for (const w of wings.sort()) {
    const drawers = listDrawers(w).sort((a, b) => a.name.localeCompare(b.name));
    if (drawers.length === 0) continue;
    lines.push(`## ${w}`, "");
    for (const d of drawers) {
      const stem = d.name.replace(/\.md$/, "");
      lines.push(`- [${stem}](wings/${w}/drawers/${d.name})`);
    }
    lines.push("");
  }
  ensureDir(MEMORY_ROOT);
  writeFileSync(MEMORY_INDEX, lines.join("\n"));
}

export function rebuildIndex() {
  refreshIndex();
}

export function listAll() {
  const result = [];
  for (const w of listWings()) {
    for (const d of listDrawers(w)) result.push({ wing: w, ...d });
  }
  return result;
}
