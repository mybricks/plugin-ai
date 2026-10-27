import { Tools, type CodeAgentPluginFactory } from "../../../../agent/src";
import taskFirstWorkflow from "./task-first-workflow.md";
import revokeTaskPrompt from "./revoke-task-git.md";
import type { GitBranchInfo } from "../branch-info";
import { readGitBranchInfoFromSandbox } from "../branch-info";
import { createTaskFirstStopCheck } from "./stop-check";
import { createTaskTransitionHook } from "./task-transition";

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
    let currentTaskPath: string | undefined;
    const taskPath = getTaskDocumentPath(branchInfo, configDirName);
    const stopCheck = createTaskFirstStopCheck({ sandbox, configDirName, taskPath });
    const transitionHook = createTaskTransitionHook({ sandbox, taskPath });

    return {
    name: "task-first",
    description: "按 TASKS.md 推进任务并在源码变更后检查回写。",
    tools: [Tools.createAskQuestions()],
    promptSections: { workflowSection: taskFirstWorkflow },
    promptTemplates: branchInfo ? [{
          name: "revoke-task",
          files: [
            { path: "PROMPT.md", content: revokeTaskPrompt },
            {
              path: "PROMPT.en.md",
              content: `---
displayName: Delete task
description: Delete a task and revert its related code
---`,
            },
          ],
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
      async beforeTurn() {
        currentTaskPath = undefined;
        await stopCheck.beforeTurn();
      },
      async afterToolCall({ toolCall }) {
        return transitionHook.afterToolCall(toolCall);
      },
      async beforeTurnStop({ turn }) {
        return stopCheck.beforeTurnStop(turn, currentTaskPath);
      },
      afterTurn(turn) {
        stopCheck.afterTurn(turn);
        currentTaskPath = undefined;
      },
    },
  };
  };
}
