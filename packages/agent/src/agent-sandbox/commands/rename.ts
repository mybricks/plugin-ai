import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { getProxyCommand } from "./helpers/request";
import { createFileSystem, execRename } from "./helpers/file-access";

export function createRenameCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "rename",
    async execute(request) {
      const result = await execRename(getProxyCommand(request)?.args ?? [], fileSystem);
      return { stdout: result.stdout, exitCode: result.exitCode };
    },
  };
}
