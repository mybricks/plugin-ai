import {
  EDIT_TOOL_NAME,
  GLOB_TOOL_NAME,
  GREP_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  MULTI_WRITE_TOOL_NAME,
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  type AgentSandbox,
  type CodeAgentPlugin,
  type SubAgentConfig,
} from "../../../../../agent/src";
import overviewWorkflow from "./task-overview-workflow.md";
import overviewDispatch from "./task-overview-dispatch.md";

/** 异步维护总览的子 Agent 名称，供主 Agent 通过 call-sub-agent 调用。 */
export const TASK_OVERVIEW_SUB_AGENT_NAME = "task-overview";

function collectTaskIds(content: string | undefined): Set<string> {
  const ids = new Set<string>();
  const titleOccurrences = new Map<string, number>();
  for (const section of (content ?? "").split(/(?=^##\s+)/m).filter((value) => /^##\s+/.test(value))) {
    const title = section.split("\n", 1)[0]?.replace(/^##\s+/, "").trim();
    if (!title) continue;
    const occurrence = titleOccurrences.get(title) ?? 0;
    titleOccurrences.set(title, occurrence + 1);
    ids.add(title.match(/^(T-\d+)\b/)?.[1] ?? `${title}\u0000${occurrence}`);
  }
  return ids;
}

/**
 * 总览维护只读写文档和源码，不需要执行命令或改动项目运行时。
 * call-sub-agent 由 resolveSubAgentConfig 强制排除，无需在此声明。
 */
const OVERVIEW_ALLOWED_TOOLS = [
  READ_TOOL_NAME,
  GREP_TOOL_NAME,
  GLOB_TOOL_NAME,
  WRITE_TOOL_NAME,
  EDIT_TOOL_NAME,
  MULTI_WRITE_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
];

function createOverviewSubAgent(taskPath: string, overviewPath: string): SubAgentConfig {
  return {
    name: TASK_OVERVIEW_SUB_AGENT_NAME,
    title: "维护任务总览",
    description: "根据任务文档和本次改动维护 overview.yaml 思维导图。任务或源码改动后异步调用，无需关注本Agent返回。",
    supportsAsync: true,
    // 与 summary / compact 一样使用轻量模型，不继承父 turn 选中的模型。
    aiRole: "flash",
    // 子 Agent 不继承父 Agent 的 system，任务文档与总览路径必须显式写进 system。
    system: overviewWorkflow
      .replaceAll("<taskPath>", taskPath)
      .replaceAll("<overviewPath>", overviewPath),
    allowedTools: OVERVIEW_ALLOWED_TOOLS,
  };
}

/**
 * 给已初始化的 task-first 插件补上任务总览能力。
 *
 * 总览维护被拆成独立的异步 SubAgent：主 Agent 只负责在任务或代码发生变化后
 * 调用一次 `call-sub-agent`，思路导图的读写不占用主对话的上下文和轮次。
 */
export function withTaskOverview(
  plugin: CodeAgentPlugin,
  sandbox: AgentSandbox,
  taskPath: string,
): CodeAgentPlugin {
  const overviewPath = taskPath.replace(/TASKS\.md$/, "overview.yaml");
  let taskIdsAtTurnStart: Set<string> | undefined;
  return {
    ...plugin,
    agents: [...(plugin.agents ?? []), createOverviewSubAgent(taskPath, overviewPath)],
    promptSections: {
      ...plugin.promptSections,
      workflowSection: [plugin.promptSections?.workflowSection, overviewDispatch]
        .filter(Boolean)
        .join("\n\n"),
    },
    hooks: {
      ...plugin.hooks,
      async beforeTurn(params) {
        try {
          taskIdsAtTurnStart = collectTaskIds((await sandbox.files.read(taskPath))?.content);
        } catch (error) {
          taskIdsAtTurnStart = undefined;
          console.warn(`[task-overview] Failed to read ${taskPath} before turn:`, error);
        }
        await plugin.hooks?.beforeTurn?.(params);
      },
      async beforeTurnStop(params) {
        const existing = await plugin.hooks?.beforeTurnStop?.(params);
        const previousIds = taskIdsAtTurnStart;
        taskIdsAtTurnStart = undefined;
        if (!previousIds) return existing;

        try {
          const [taskFile, overviewFile] = await Promise.all([
            sandbox.files.read(taskPath),
            sandbox.files.read(overviewPath),
          ]);
          const addedTasks = [...collectTaskIds(taskFile?.content)].filter((id) => !previousIds.has(id));
          if (!addedTasks.length || overviewFile) return existing;

          const reminder = {
            role: "user" as const,
            content: `New task entries were added to \`${taskPath}\` during this turn, but \`${overviewPath}\` does not exist. Before ending the turn, asynchronously call the \`${TASK_OVERVIEW_SUB_AGENT_NAME}\` sub-agent to create and maintain the overview for the added tasks.`,
          };
          return { additionalMessages: [...(existing?.additionalMessages ?? []), reminder] };
        } catch (error) {
          console.warn(`[task-overview] Failed to check task and overview files before turn stop:`, error);
          return existing;
        }
      },
      async afterTurn(turn) {
        taskIdsAtTurnStart = undefined;
        await plugin.hooks?.afterTurn?.(turn);
      },
    },
    async getAttachmentContextMessages(attachmentContext) {
      const [taskMessages, status] = await Promise.all([
        plugin.getAttachmentContextMessages?.(attachmentContext),
        sandbox.files.read(overviewPath).then(
          (file) => file ? "Exists" : "Not created yet",
          (error) => {
            console.warn(`[task-overview] Failed to read ${overviewPath}:`, error);
            return "Read failed";
          },
        ),
      ]);
      return [
        ...(taskMessages ?? []),
        { key: "task-overview-document", content: `<system-reminder>\nCurrent task overview document: ${overviewPath}\nStatus: ${status}\n</system-reminder>` },
      ];
    },
  };
}
