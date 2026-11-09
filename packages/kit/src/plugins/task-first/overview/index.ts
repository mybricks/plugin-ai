import type { AgentSandbox, CodeAgentPlugin } from "../../../../../agent/src";
import overviewWorkflow from "./task-overview-workflow.md";

/** Add the overview workflow and document status to an initialized task-first plugin. */
export function withTaskOverview(
  plugin: CodeAgentPlugin,
  sandbox: AgentSandbox,
  taskPath: string,
): CodeAgentPlugin {
  const overviewPath = taskPath.replace(/TASKS\.md$/, "overview.yaml");
  return {
    ...plugin,
    promptSections: {
      ...plugin.promptSections,
      workflowSection: [plugin.promptSections?.workflowSection, overviewWorkflow]
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
