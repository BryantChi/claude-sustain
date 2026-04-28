// Generate AGENTS.md content from spec.json.
// Audience: any agent following the AGENTS.md standard (Codex, Claude, Gemini, others).
// De-Claude-ified — uses generic "the agent" wording.

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
  parts.push(`> AGENTS.md generated from \`${spec.metadata.name}/rules/spec.json\` v${spec.version}.`);
  parts.push("> This file follows the AGENTS.md cross-platform standard (agents.md).");
  parts.push("");
  parts.push(renderLanguagePolicy(spec));
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("## Token Efficiency");
  parts.push("");
  parts.push("All rules below are mandatory for the agent in every session. Goal: minimize token waste while preserving user intent.");
  parts.push("");
  parts.push(renderIronRules(spec, { audience: "agents" }));
  parts.push("");
  parts.push(renderPhaseChecklist(spec));
  parts.push("");
  parts.push(renderSkillRouting(spec, { audience: "agents" }));
  parts.push("");
  parts.push(renderDetailRules(spec));
  parts.push("");
  return parts.join("\n");
}
