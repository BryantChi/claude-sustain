// claude-mem backend (AGPL-3.0).
//
// IMPORTANT: We never import or statically link claude-mem code — its license
// would otherwise infect this MIT plugin. Instead we just produce *guidance*
// that the model can read and then route through claude-mem's MCP tools
// (mcp__plugin_claude-mem_mcp-search__*) on the user's behalf.
//
// This backend therefore exposes the same write/query interface but its
// implementations return "instructional" results — the model uses them as
// hints, not as data sources.

const NS = "mcp__plugin_claude-mem_mcp-search__";

export function writeHint({ wing, slug, body }) {
  return {
    instructionFor: "model",
    backend: "claude-mem",
    summary:
      `claude-mem is the active backend. Persist this observation by including it in your reply ` +
      `naturally — claude-mem captures observations from session content automatically. ` +
      `Use wing="${wing}", slug="${slug}".`,
    body,
  };
}

export function queryHint({ text, wing }) {
  return {
    instructionFor: "model",
    backend: "claude-mem",
    summary:
      `Use the claude-mem MCP search tool to look up prior observations. ` +
      `Suggested call: ${NS}smart_search with query="${text}"` +
      (wing ? `, scoped to wing="${wing}"` : "") + ".",
    suggestedTools: [
      `${NS}smart_search`,
      `${NS}search`,
      `${NS}get_observations`,
      `${NS}timeline`,
    ],
  };
}
