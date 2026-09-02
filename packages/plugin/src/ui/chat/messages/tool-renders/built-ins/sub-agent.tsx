import React, { useState } from "react";
import type { ToolRecord } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import { Duration, StatusIcon } from "../shared";
import { InitProjectRenderer } from "./init-project";
import css from "../render.less";

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
  const [collapsed, setCollapsed] = useState(false);

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
  const isError = displayTool.status === "error";
  const streamingContent = progress?.content ?? "";
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

  const lineCount = displayContent ? displayContent.split("\n").length : 0;

  const canToggle = !isPending && !isError && !!displayContent;
  const isCollapsed = isError || (canToggle && collapsed);
  const shouldShowBody = (isPending && streamingContent) || (!isPending && !isCollapsed && displayContent);

  return (
    <div className={css["code-card"]}>
      <div
        className={css["code-card-header"]}
        onClick={() => canToggle && setCollapsed((c: boolean) => !c)}
        style={canToggle ? undefined : { cursor: "default" }}
      >
          <span className={css["code-card-icon"]}>
          <StatusIcon tool={displayTool} />
        </span>

        <span className={css["code-card-filename"]}>
          {isPending ? <TextShimmer>{headerTitle}</TextShimmer> : headerTitle}
        </span>

        {lineCount > 0 && !isError && (
          <span className={css["code-card-lines"]}>{lineCount} 行</span>
        )}

        <Duration tool={displayTool} />

        {canToggle && (
          <span className={css["code-card-toggle"]}>{isCollapsed ? "▶" : "▼"}</span>
        )}
      </div>

      {shouldShowBody && (
        <pre className={css["code-card-body"]}>
          <code>{displayContent}</code>
        </pre>
      )}
    </div>
  );
};
