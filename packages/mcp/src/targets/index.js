import { codexProfile } from './codex.js';

// Protocol, workspace lifecycle and bridge live in the shared server. Add a
// profile here when another client has a verified MCP integration.
const profiles = { codex: codexProfile };
export function getTargetProfile(target) {
  const profile = profiles[target];
  if (!profile) throw new Error(`Unsupported MCP target: ${target}`);
  return profile;
}
