// Generate CLAUDE.md content from spec.json.
// Audience: Claude Code. Full content with second-person framing.

import {
  renderIronRules,
  renderPhaseChecklist,
  renderSkillRouting,
  renderDetailRules,
  renderLanguagePolicy
} from "./render.js";

export function generate(spec) {
  const parts = [];
  parts.push(`# ${spec.metadata.title}`);
  parts.push("");
  parts.push(`> Generated from \`${spec.metadata.name}/rules/spec.json\` v${spec.version}.`);
  parts.push("> Edit the spec, not this file.");
  parts.push("");
  parts.push(renderLanguagePolicy(spec));
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("## Token Efficiency");
  parts.push("");
  parts.push("All rules below are mandatory in every session. Goal: minimize token waste while preserving user intent.");
  parts.push("");
  parts.push(renderIronRules(spec, { audience: "claude" }));
  parts.push("");
  parts.push(renderPhaseChecklist(spec));
  parts.push("");
  parts.push(renderSkillRouting(spec, { audience: "claude" }));
  parts.push("");
  parts.push(renderDetailRules(spec));
  parts.push("");
  return parts.join("\n");
}
