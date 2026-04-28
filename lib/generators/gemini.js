// Generate GEMINI.md content from spec.json.
// Audience: Gemini CLI. Minimal — defer to AGENTS.md for the full content.

export function generate(spec) {
  return [
    `# ${spec.metadata.title} — Gemini entry point`,
    "",
    `> Generated from \`${spec.metadata.name}/rules/spec.json\` v${spec.version}.`,
    "",
    "Please read [AGENTS.md](./AGENTS.md) for the full rule set.",
    "",
    "If your runtime does not auto-resolve `@AGENTS.md` includes, copy the AGENTS.md content into this file by running `npm run regen-claude-md` or the equivalent generator script.",
    ""
  ].join("\n");
}
