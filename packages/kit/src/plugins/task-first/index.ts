import { Tools, type CodeAgentPlugin, type CodeAgentPluginFactory } from "../../../../agent/src";
import taskFirstWorkflow from "./task-first-workflow.md";
import revokeTaskPrompt from "./revoke-task-git.md";
import type { GitBranchInfo } from "../branch-info";
import { readGitBranchInfoFromSandbox } from "../branch-info";
import { createTaskTransitionHook } from "./task-transition";
import { withTaskOverview } from "./overview";

export interface TaskFirstPluginOptions {
  /** Maintain an overview.yaml alongside the task document. Disabled by default. */
  overview?: boolean;
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
export function createTaskFirstPlugin(options: TaskFirstPluginOptions = {}): CodeAgentPluginFactory {
  const factory: CodeAgentPluginFactory = async (context) => {
    const { plugin, taskPath } = await resolveTaskFirstPlugin(context);
    return options.overview ? withTaskOverview(plugin, context.sandbox, taskPath) : plugin;
  };
  return Object.assign(factory, { pluginName: "task-first" });
}

async function resolveTaskFirstPlugin(
  { sandbox, configDirName, isInRemoteMode }: Parameters<CodeAgentPluginFactory>[0],
): Promise<{ plugin: CodeAgentPlugin; taskPath: string }> {
  const branchInfo = await readGitBranchInfoFromSandbox(sandbox);
  const taskPath = getTaskDocumentPath(branchInfo, configDirName);
  const transitionHook = createTaskTransitionHook({ sandbox, taskPath });
  const verification = await (sandbox as any).tasksManager?.createVerification({ sandbox, taskPath });

  const plugin: CodeAgentPlugin = {
    name: "task-first",
    description: "按 TASKS.md 推进任务。",
    ui: verification?.todoArea ? { todoArea: verification.todoArea } : undefined,
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
      let status = "Not created yet";
      try {
        const file = await sandbox.files.read(taskPath);
        if (file) {
          status = "Exists";
        }
      } catch (error) {
        console.warn(`[task-first] Failed to read ${taskPath}:`, error);
      }
      return [{ key: "task-document", content: `<system-reminder>\nCurrent task document: ${taskPath}\nStatus: ${status}\n</system-reminder>` }];
    },
    hooks: isInRemoteMode ? undefined : {
      beforeTurn: verification?.beforeTurn,
      afterTurn: verification?.afterTurn,
      async afterToolCall({ toolCall }) {
        return transitionHook.afterToolCall(toolCall);
      },
    },
  };
  return { plugin, taskPath };
}
