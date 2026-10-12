import { Tools, type CodeAgentPluginFactory, type TurnRecord } from "../../../../agent/src";
import taskFirstWorkflow from "./task-first-workflow.md";
import revokeTaskPrompt from "./revoke-task-git.md";
import type { GitBranchInfo } from "../branch-info";
import { readGitBranchInfoFromSandbox } from "../branch-info";

const MUTATION_TOOLS = new Set([
  "write_file", "multi_write", "edit_file", "multi_edit", "delete_file", "init-project",
]);

const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\.\/+/, "");
const isCurrentTaskPath = (path: string, taskPath: string) => {
  const normalized = normalizePath(path);
  return normalized === taskPath || normalized.endsWith(`/${taskPath}`);
};
const isProjectSourcePath = (path: string, configDirName: string) => {
  const normalized = normalizePath(path);
  const relative = normalized.replace(/^\/+/, "");
  const configPath = configDirName.replace(/^\/+|\/+$/g, "");
  const isInsideConfig = relative === configPath || relative.startsWith(`${configPath}/`)
    || relative.includes(`/${configPath}/`);
  return !isInsideConfig && !relative.split("/").includes(".git");
};

function collectMutationPaths(turn: TurnRecord): string[] {
  const paths = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim()) paths.add(normalizePath(value.trim()));
  };

  for (const iteration of turn.iterations) {
    if ("type" in iteration) continue;
    for (const call of iteration.toolCalls) {
      if (call.status !== "success" || !MUTATION_TOOLS.has(call.name)) continue;
      const metadata = call.result?.metadata;
      switch (call.name) {
        case "write_file":
        case "edit_file":
          add(metadata?.path ?? call.args?.path);
          break;
        case "multi_write":
        case "init-project":
          for (const file of metadata?.files ?? []) {
            if (file?.status !== "error") add(file?.path);
          }
          break;
        case "multi_edit":
          for (const edit of metadata?.edits ?? []) {
            if (!edit?.error) add(edit?.path);
          }
          break;
        case "delete_file":
          for (const path of metadata?.deletedPaths ?? []) add(path);
          break;
      }
    }
  }
  return [...paths];
}

export function getTaskDocumentPath(
  branchInfo: GitBranchInfo | undefined,
  configDirName: string,
): string {
  const branchDir = (branchInfo?.branch ? branchInfo.branchDir || branchInfo.branch.replace(/[^a-zA-Z0-9]/g, "_") : "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
  const root = configDirName.replace(/^\/+|\/+$/g, "");
  return branchDir ? `${root}/${branchDir}/tasks/TASKS.md` : `${root}/tasks/TASKS.md`;
}

/**
 * Git 状态只能在 sandbox 可用后读取，因此返回一次性 factory；解析后的插件是静态的。
 */
export function createTaskFirstPlugin(): CodeAgentPluginFactory {
  return async ({ sandbox, configDirName }) => {
    const branchInfo = await readGitBranchInfoFromSandbox(sandbox);
    const promptedTurnIds = new Set<string>();
    let currentTaskPath: string | undefined;
    const taskPath = getTaskDocumentPath(branchInfo, configDirName);

    return {
    name: "task-first",
    description: "按 TASKS.md 推进任务并在源码变更后检查回写。",
    tools: [Tools.createAskQuestions()],
    promptSections: { workflowSection: taskFirstWorkflow },
    promptTemplates: branchInfo ? [{
          name: "revoke-task",
          files: [{ path: "PROMPT.md", content: revokeTaskPrompt }],
        }] : [],
    async getAttachmentContextMessages() {
      currentTaskPath = taskPath;

      let status = "尚未创建";
      try {
        const file = await sandbox.files.read(taskPath);
        if (file) {
          status = "已存在";
        }
      } catch (error) {
        console.warn(`[task-first] 读取 ${taskPath} 失败:`, error);
      }
      return [`<system-reminder>\n当前任务文档：${taskPath}\n状态：${status}\n</system-reminder>`];
    },
    hooks: {
      beforeTurn() {
        currentTaskPath = undefined;
      },
      async beforeTurnStop({ turn }) {
        if (promptedTurnIds.has(turn.id)) return;
        const mutationPaths = collectMutationPaths(turn);
        if (!mutationPaths.some((path) => isProjectSourcePath(path, configDirName))) return;

        const taskPath = currentTaskPath;
        if (!taskPath) return;
        if (mutationPaths.some((path) => isCurrentTaskPath(path, taskPath))) return;
        promptedTurnIds.add(turn.id);
        return {
          additionalMessages: [{
            role: "user",
            content: `本轮修改了项目源码，但尚未更新当前任务文档 \`${taskPath}\`。请先按任务文档工作流程回写本轮进展，再结束。`,
          }],
        };
      },
      afterTurn(turn) {
        promptedTurnIds.delete(turn.id);
        currentTaskPath = undefined;
      },
    },
  };
  };
}
