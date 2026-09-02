import { createAgentSandboxCommandExecutor } from "./commands";
import type { AgentSandbox } from "./types";

/** Compiles an AgentSandbox's command declarations into the runtime executor. */
export function createAgentSandboxRuntime(base: AgentSandbox): AgentSandbox {
  const commandExecutor = createAgentSandboxCommandExecutor(base.commands, base.files);
  return {
    files: base.files,
    commands: { ...base.commands, execute: commandExecutor.execute },
    ...(base.getContext ? { getContext: base.getContext.bind(base) } : {}),
  };
}
