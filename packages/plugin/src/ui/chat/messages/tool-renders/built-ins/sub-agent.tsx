import React, { useState } from "react";
import type { ToolRecord } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import { Duration, StatusIcon } from "../shared";
import { InitProjectRenderer } from "./init-project";
import css from "../render.less";

type SubAgentToolCall = {
  callId: string;
  name: string;
  title?: string;
  status: "running" | "success" | "error";
};

function getSubAgentToolCalls(tool: ToolRecord): SubAgentToolCall[] {
  const raw = tool.progress?.subAgentToolCalls ?? tool.result?.metadata?.subAgentToolCalls;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SubAgentToolCall =>
    !!item && typeof item.callId === "string" && typeof item.name === "string"
  );
}

export const SubAgentRenderer = ({ tool }: { tool: ToolRecord }) => {
  const agentType: string = tool.args?.type ?? "";

  // 根据 agent 类型选择专用渲染器
  if (agentType === "init-project") {
    return <InitProjectRenderer tool={tool} />;
  }

  // 默认渲染器（通用 SubAgent）
  return <DefaultSubAgentRenderer tool={tool} />;
};

// ─── 默认 SubAgent 渲染器 ─────────────────────────────────────────────────────

const DefaultSubAgentRenderer = ({ tool }: { tool: ToolRecord }) => {
  const [toolsExpanded, setToolsExpanded] = useState(false);

  const agentType: string = tool.args?.type ?? "";
  const taskName = tool.args?.name ?? "";
  const progress = tool.progress;
  const isAsync = tool.result?.metadata?.async === true;
  const asyncStatus = isAsync ? progress?.status : undefined;
  const isAsyncRunning = asyncStatus === "running";
  const isAsyncError = asyncStatus === "error" || asyncStatus === "aborted";
  // async 调用会立刻完成原始 function-call；卡片状态则跟随后台任务的 progress。
  const displayTool: ToolRecord = isAsyncRunning
    ? { ...tool, status: "pending" }
    : isAsyncError
      ? { ...tool, status: "error" }
      : tool;
  const isPending = displayTool.status === "pending";
  const streamingContent = progress?.content ?? "";
  const subAgentToolCalls = getSubAgentToolCalls(tool);
  const toolCallCount = subAgentToolCalls.length;
  const files = progress?.files ?? [];

  // 如果有文件列表，显示正在处理的文件名
  const currentFile = files.find((f: any) => f.status === "writing");
  const currentFileName = currentFile?.path?.split("/").pop() ?? "";

  const headerTitle = isPending
    ? taskName
      ? `${taskName}${currentFileName ? ` - ${currentFileName}` : ""}…`
      : agentType
        ? `${agentType}…`
        : "处理中…"
    : taskName || agentType || "已完成";

  // 显示内容：执行中显示流式内容，完成后显示最终结果
  const displayContent: string = isPending
    ? streamingContent
    : (isAsync ? progress?.output ?? tool.result?.output ?? "" : tool.result?.output ?? "");

  const shouldShowContent = isPending || !!displayContent;

  return (
    <div className={css["sub-agent-card"]}>
      <div className={css["sub-agent-header"]}>
        <span className={css["sub-agent-header-icon"]}>
          <StatusIcon tool={displayTool} />
        </span>

        <span className={css["sub-agent-header-title"]}>
          {isPending ? <TextShimmer>{headerTitle}</TextShimmer> : headerTitle}
        </span>

        {toolCallCount > 0 && (
          <span className={css["sub-agent-header-meta"]}>{toolCallCount} 次调用</span>
        )}

        <Duration tool={displayTool} />
      </div>

      {shouldShowContent && (
        <div className={css["sub-agent-output"]}>
          <div className={css["sub-agent-section-title"]}>
            {isPending ? "最新输出" : "执行结果"}
          </div>
          <pre className={css["sub-agent-output-content"]}>
            <code>{displayContent || "等待模型输出…"}</code>
          </pre>
        </div>
      )}

      {toolCallCount > 0 && (
        <div className={css["sub-agent-tools"]}>
          <div className={css["sub-agent-tools-heading"]}>
            <span className={css["sub-agent-section-title"]}>调用工具</span>
            <button
              type="button"
              className={css["sub-agent-tools-toggle"]}
              aria-expanded={toolsExpanded}
              onClick={() => setToolsExpanded((expanded) => !expanded)}
            >
              {toolsExpanded ? "收起" : "展开调用"}
            </button>
          </div>
          {toolsExpanded && (
            <div className={css["sub-agent-tools-list"]}>
              {subAgentToolCalls.map((toolCall) => (
                <div key={toolCall.callId} className={css["sub-agent-tool-item"]}>
                  <span>{toolCall.title || toolCall.name}</span>
                  <span className={css[`sub-agent-tool-status-${toolCall.status}`]}>
                    {toolCall.status === "running" ? "执行中" : toolCall.status === "error" ? "失败" : "完成"}
                  </span>
                  {toolCall.title && <code>{toolCall.name}</code>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
