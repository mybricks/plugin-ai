import type { AgentSandboxCommands } from "./commands";
import type { AgentSandboxFiles } from "./files";

/** The sandbox contract consumed by CodeAgent and its tools. */
export interface AgentSandbox {
  readonly files: AgentSandboxFiles;
  readonly commands: AgentSandboxCommands;
  getContext?: () => Promise<string | null>;
}

export function isAgentSandbox(value: unknown): value is AgentSandbox {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentSandbox>;
  return !!candidate.files && !!candidate.commands &&
    typeof candidate.files.list === "function" &&
    typeof candidate.files.read === "function" &&
    typeof candidate.files.readFiles === "function" &&
    typeof candidate.files.write === "function" &&
    typeof candidate.files.writeFiles === "function" &&
    typeof candidate.files.remove === "function" &&
    typeof candidate.files.removeFiles === "function" &&
    typeof candidate.commands.execute === "function";
}
