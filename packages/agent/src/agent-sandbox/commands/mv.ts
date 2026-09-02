import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { getProxyCommand } from "./helpers/request";
import { createFileSystem, execMv } from "./helpers/file-access";

export function createMvCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "mv",
    async execute(request) {
      const result = await execMv(getProxyCommand(request)?.args ?? [], fileSystem);
      return { stdout: result.stdout, exitCode: result.exitCode };
    },
  };
}
