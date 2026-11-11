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
  return {
    ...plugin,
    agents: [...(plugin.agents ?? []), createOverviewSubAgent(taskPath, overviewPath)],
    promptSections: {
      ...plugin.promptSections,
      workflowSection: [plugin.promptSections?.workflowSection, overviewDispatch]
        .filter(Boolean)
        .join("\n\n"),
    },
    async getAttachmentContextMessages(attachmentContext) {
      const [taskMessages, status] = await Promise.all([
        plugin.getAttachmentContextMessages?.(attachmentContext),
        sandbox.files.read(overviewPath).then(
          (file) => file ? "已存在" : "尚未创建",
          (error) => {
            console.warn(`[task-overview] 读取 ${overviewPath} 失败:`, error);
            return "读取失败";
          },
        ),
      ]);
      return [
        ...(taskMessages ?? []),
        { key: "task-overview-document", content: `<system-reminder>\n当前任务总览文档：${overviewPath}\n状态：${status}\n</system-reminder>` },
      ];
    },
  };
}
