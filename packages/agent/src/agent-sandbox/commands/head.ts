import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { getProxyCommand } from "./helpers/request";
import { createFileSystem, execHead } from "./helpers/file-access";

export function createHeadCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "head",
    async execute(request) {
      const result = await execHead(getProxyCommand(request)?.args ?? [], fileSystem);
      return { stdout: result.stdout, exitCode: result.exitCode };
    },
  };
}
