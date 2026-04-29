// Memory audit — never auto-deletes. Returns a report the user can review.
//
// Three signals:
//   - stale: drawer not modified in > staleDays days
//   - duplicate: two drawers with similar slugs in the same wing
//     (>= 0.7 character-bigram Jaccard similarity)
//   - deadUrl: drawer body contains an http(s) URL whose hostname looks
//     suspicious (we don't actually fetch — that's a network round-trip we
//     shouldn't do silently. The skill prompts the user to verify.)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MEMORY_ROOT = join(homedir(), ".claude", "sustain", "memory");

const URL_RE = /https?:\/\/[^\s)\]]+/g;

function listWings() {
  const dir = join(MEMORY_ROOT, "wings");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(name => {
    try { return statSync(join(dir, name)).isDirectory(); } catch { return false; }
  });
}

function listDrawers(wing) {
  const dir = join(MEMORY_ROOT, "wings", wing, "drawers");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(n => n.endsWith(".md"))
    .map(name => {
      const path = join(dir, name);
      let mtime = null, content = "";
      try { mtime = statSync(path).mtime; } catch { /* ignore */ }
      try { content = readFileSync(path, "utf8"); } catch { /* ignore */ }
      return { wing, name, path, mtime, content };
    });
}

function bigrams(s) {
  const set = new Set();
  const t = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect++;
  return intersect / (a.size + b.size - intersect);
}

function slugFromName(name) {
  // strip "<YYYY-MM-DD>-" prefix and ".md" suffix
  return name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
}

export function audit({ staleDays = 90, similarityThreshold = 0.7 } = {}) {
  const now = Date.now();
  const staleCutoff = now - staleDays * 24 * 60 * 60 * 1000;

  const stale = [];
  const duplicates = [];
  const deadUrls = [];
  const wings = listWings();

  for (const wing of wings) {
    const drawers = listDrawers(wing);

    // Stale check
    for (const d of drawers) {
      if (d.mtime && d.mtime.getTime() < staleCutoff) {
        stale.push({
          wing: d.wing,
          name: d.name,
          path: d.path,
          ageDays: Math.round((now - d.mtime.getTime()) / 86400000),
        });
      }
    }

    // Duplicate check (within same wing)
    const slugs = drawers.map(d => ({ ...d, slug: slugFromName(d.name), grams: bigrams(slugFromName(d.name)) }));
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const sim = jaccard(slugs[i].grams, slugs[j].grams);
        if (sim >= similarityThreshold) {
          duplicates.push({
            wing,
            a: slugs[i].name,
            b: slugs[j].name,
            similarity: Number(sim.toFixed(3)),
          });
        }
      }
    }

    // URL extraction (best-effort — we don't fetch)
    for (const d of drawers) {
      const matches = d.content.match(URL_RE);
      if (matches) {
        for (const url of matches) {
          deadUrls.push({ wing: d.wing, name: d.name, path: d.path, url });
        }
      }
    }
  }

  return {
    auditedAt: new Date().toISOString(),
    wingCount: wings.length,
    drawerCount: wings.reduce((n, w) => n + listDrawers(w).length, 0),
    stale,
    duplicates,
    urls: deadUrls,
    notes: [
      "claude-sustain audit never auto-deletes; review and act on this report yourself.",
      "URLs are extracted, not fetched — verify them via WebFetch or browser if needed.",
    ],
  };
}
