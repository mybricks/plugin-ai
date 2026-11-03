/** Codex-facing MCP profile. Keep client-specific guidance outside the bridge. */
export const codexProfile = {
  name: 'plugin-ai-codex',
  instructions: 'For every designer task: first call list_workspaces, then enter_workspace with the chosen workspace ID. Read plugin-ai://overview before any other work, and then read the development guide and relevant skills listed there as needed. Use workspace tools only after reading the overview. When finished, call exit_workspace.',
};
