import React from "react";
import { Pencil } from "../../../../plugin/src/ui/components/icons";
import type { ToolRecord } from "../../../../plugin/src/ui/chat/messages/tool-renders";
import { useChatPanel } from "../../../../plugin/src/ui/chat/chat-panel/context";
import { CodeCard, LineToolRenderer, PendingCodeCard } from "../../../../plugin/src/ui/chat/messages/tool-renders/shared";

function getStats(tool: ToolRecord) {
  const source = tool.status === "pending" ? tool.progress : tool.result?.metadata;
  return {
    succeeded: Number(source?.succeeded ?? 0),
    failed: Number(source?.failed ?? 0),
    actionCount: Number(source?.actionCount ?? 0),
    taskCount: Number(source?.taskCount ?? source?.tasks?.length ?? 0),
    completedTaskCount: Number(source?.completedTaskCount ?? source?.taskCount ?? source?.tasks?.length ?? 0),
  };
}

/** lowcode_generate_page 的专用执行回执。 */
export const UpdatePageRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();

  const { succeeded, failed, actionCount, taskCount, completedTaskCount } = getStats(tool);
  const isRunning = tool.status === "pending";
  const title = isRunning ? "正在生成页面任务" : tool.status === "error" ? "页面任务失败" : "页面任务完成";
  const meta = isRunning
    ? `${completedTaskCount}/${taskCount} 个任务，${actionCount} 个 action`
    : `${taskCount} 个任务，${succeeded} 成功 / ${failed} 失败`;
  const detail = [
    tool.result?.output ? String(tool.result.output) : "",
    tool.error ? `错误：${tool.error}` : "",
  ].filter(Boolean).join("\n\n");
  const lineMeta = isRunning
    ? `${completedTaskCount}/${taskCount} 个任务，${actionCount} 个 action`
    : `${taskCount} 个任务，${succeeded} 成功${failed ? ` / ${failed} 失败` : ""}`;

  if (messagesRenderVariant === "line") {
    return <LineToolRenderer tool={tool} icon={<Pencil />} title={title} meta={meta} detail={detail} />;
  }

  if (isRunning) {
    return <PendingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} />;
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Pencil />}
      title={title}
      content={detail}
      lineMeta={lineMeta}
      showCode={Boolean(detail)}
    />
  );
};
