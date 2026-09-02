import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { getProxyCommand } from "./helpers/request";
import { createFileSystem, execRm } from "./helpers/file-access";

export function createRmCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "rm",
    async execute(request) {
      const result = await execRm(getProxyCommand(request)?.args ?? [], fileSystem);
      return { stdout: result.stdout, exitCode: result.exitCode };
    },
  };
}
