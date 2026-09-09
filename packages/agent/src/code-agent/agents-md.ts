import type { Message } from "../types";
import { splitFrontmatter } from "../utils/frontmatter";
import { scanProjectResources } from "./project-resources";
import { getAgentMdPath, isAgentRulePath } from "./config-dir";

function compareAgentRulePaths(a: string, b: string): number {
  const depthDiff = a.split("/").length - b.split("/").length;
  if (depthDiff) return depthDiff;
  return a.localeCompare(b);
}

function formatEntry(path: string, content: string): string {
  const escapedPath = path.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<agents-md path="${escapedPath}">\n${content}\n</agents-md>`;
}

/** Scans AgentSandbox project rules and returns a single agents.md string. */
export async function scanAgentsMd(
  sandbox: import("../agent-sandbox").AgentSandbox,
  configDirName?: string,
): Promise<string> {
  const agentMdPath = getAgentMdPath(configDirName);
  const files = await scanProjectResources(sandbox, {
    candidates: [agentMdPath],
    matches: (path) => isAgentRulePath(path, configDirName),
    compare: compareAgentRulePaths,
  });
  return files.flatMap((file) => {
    const content = splitFrontmatter(file.content).body.trim();
    return content ? [formatEntry(file.path, content)] : [];
  }).join("\n\n");
}

/** Creates the stable context message consumed by CodeAgent on every turn. */
export async function createAgentsMdContextMessage(
  sandbox: import("../agent-sandbox").AgentSandbox,
  configDirName?: string,
): Promise<Message | null> {
  const content = await scanAgentsMd(sandbox, configDirName);
  if (!content) return null;
  return {
    role: "user",
    content:
      `<system-reminder>\n` +
      `As you answer the user's questions, you can use the following context:\n` +
      `# agents.md\n\n${content}\n\n` +
      `IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n` +
      `</system-reminder>`,
  };
}
