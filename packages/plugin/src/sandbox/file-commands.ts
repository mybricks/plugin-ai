import type { AgentSandboxFiles, AgentSandboxCommands } from "../../../agent/src";
import { DEFAULT_BASH_ALLOWED_COMMANDS } from "../../../agent/src/code-agent/tools/bash";
import { createMvCommandProxy, createCpCommandProxy, createRmCommandProxy, createRenameCommandProxy, createTouchCommandProxy, createSedCommandProxy, createHeadCommandProxy, createLsCommandProxy } from "../../../agent/src/agent-sandbox/commands";

/** 文件型设计器的命令由相同 AgentSandbox 文件操作实现。 */
export function createFileCommands(files: AgentSandboxFiles): AgentSandboxCommands {
  return {
    allowedCommands: DEFAULT_BASH_ALLOWED_COMMANDS,
    proxies: [createMvCommandProxy(files), createCpCommandProxy(files), createRmCommandProxy(files), createRenameCommandProxy(files), createTouchCommandProxy(files), createSedCommandProxy(files), createHeadCommandProxy(files), createLsCommandProxy(files)],
    async execute(command) {
      return { stdout: `Command unavailable in designer sandbox: ${command}`, exitCode: 1 };
    },
  };
}
