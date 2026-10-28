import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { getProxyCommand } from "./helpers/request";
import { createFileSystem, execLs } from "./helpers/file-access";

export function createLsCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "ls",
    async execute(request) {
      const result = await execLs(getProxyCommand(request)?.args ?? [], fileSystem);
      return { stdout: result.stdout, exitCode: result.exitCode };
    },
  };
}
