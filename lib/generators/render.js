// Shared rendering helpers for spec → markdown generators.
// Both claude.js and agents.js share most content; only the framing differs.

export function renderIronRules(spec, { audience }) {
  const lines = [];
  const heading = audience === "claude" ? "Iron Rules (3+1) — top priority" : "Iron Rules (3+1) — top priority";
  lines.push(`### ${heading}`);
  lines.push("");
  lines.push("These override the detailed rules below when in conflict.");
  lines.push("");
  for (const rule of spec.ironRules) {
    lines.push(`- **${rule.id.toUpperCase()} — ${rule.title}**: ${rule.body}`);
  }
  return lines.join("\n");
}

export function renderPhaseChecklist(spec) {
  const lines = ["**Phase-end self-check**:"];
  spec.phaseChecklist.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.question}`);
  });
  return lines.join("\n");
}

export function renderSkillRouting(spec, { audience }) {
  const lines = [];
  lines.push(audience === "claude" ? "### Skill Routing" : "### Skill / Tool Routing");
  lines.push("");
  lines.push("| Scenario | Use |");
  lines.push("| --- | --- |");
  for (const r of spec.skillRouting) {
    lines.push(`| ${r.when} | \`${r.use}\` |`);
  }
  return lines.join("\n");
}

export function renderDetailRules(spec) {
  const lines = [];
  for (const key of Object.keys(spec.details)) {
    const block = spec.details[key];
    lines.push(`### ${key}: ${block.title}`);
    lines.push("");
    lines.push("| Rule | Detail |");
    lines.push("| --- | --- |");
    for (const r of block.rules) {
      lines.push(`| ${r.id} | ${r.text} |`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function renderLanguagePolicy(spec) {
  return [
    "## Language",
    "- Detect the user's language from their message and respond in the same language.",
    `- Default: ${spec.metadata.language.default === "en" ? "English" : spec.metadata.language.default}.`,
    "- Code comments, identifiers, and git commits remain in English."
  ].join("\n");
}
