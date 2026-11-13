import type { AgentSandbox } from "../../../agent/src";

/** 当前 Git 分支；无分支时两个字段均为空字符串。 */
export interface GitBranchInfo {
  branch: string;
  branchDir: string;
}

/** 读取当前 sandbox 工作目录的分支；命令不可用时不假定存在分支。 */
export async function readGitBranchInfoFromSandbox(
  sandbox: Pick<AgentSandbox, "commands">,
): Promise<GitBranchInfo | undefined> {
  try {
    const result = await sandbox.commands.execute("git branch --show-current", { timeoutMs: 10_000 });
    if (result.exitCode !== 0) return undefined;
    const branch = result.stdout.trim();
    return {
      branch,
      branchDir: branch.replace(/[^a-zA-Z0-9]/g, "_"),
    };
  } catch {
    return undefined;
  }
}
