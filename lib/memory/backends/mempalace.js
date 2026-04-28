// MemPalace backend (MIT).
//
// We *could* import mempalace's helpers safely here (license is compatible),
// but to keep installs optional we treat it the same as claude-mem: produce
// guidance text that routes the model to mempalace's MCP tools.
//
// MemPalace exposes structured wings/rooms/drawers. The fs fallback uses the
// same vocabulary so that — if a user later installs mempalace — their fs
// drawers can be imported wholesale (planned for v1.5).

const NS = "mcp__mempalace__"; // best-known prefix; mempalace's MCP server name may differ.

export function writeHint({ wing, slug, body }) {
  return {
    instructionFor: "model",
    backend: "mempalace",
    summary:
      `MemPalace is the active backend. Store this in wing="${wing}", drawer slug="${slug}". ` +
      `Use the mempalace MCP write tool (typically ${NS}store or ${NS}create_drawer) and pass the body verbatim.`,
    body,
  };
}

export function queryHint({ text, wing }) {
  return {
    instructionFor: "model",
    backend: "mempalace",
    summary:
      `Use mempalace's MCP search to retrieve prior drawers. Try ${NS}search with query="${text}"` +
      (wing ? `, scoped to wing="${wing}"` : "") + ". Mempalace returns verbatim entries (no compression).",
    suggestedTools: [
      `${NS}search`,
      `${NS}list_wings`,
      `${NS}get_drawer`,
    ],
  };
}
