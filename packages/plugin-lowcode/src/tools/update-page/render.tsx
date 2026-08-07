import React, { useState } from "react";
import { ErrorIcon, Loading, Pencil, Success } from "../../../../plugin/src/ui/components/icons";
import type { ToolRecord } from "../../../../plugin/src/ui/chat/messages/tool-renders";
import { Duration, LineToolRenderer } from "../../../../plugin/src/ui/chat/messages/tool-renders/shared";
import css from "../../../../plugin/src/ui/chat/messages/tool-renders/render.less";
import { useChatPanel } from "../../../../plugin/src/ui/chat/chat-panel/context";

interface PageRequestViewModel {
  index: number;
  id?: string;
  name?: string;
  mode?: string;
  targetId?: string;
  pageId?: string;
  succeeded: number;
  failed: number;
  actions: string;
  failures: string[];
  error?: string;
}

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

function getTagContent(content: string, tag: string): string {
  const match = content.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`));
  return match?.[1]?.trim() ?? "";
}

function getPageRequests(tool: ToolRecord): PageRequestViewModel[] {
  const requests = tool.result?.metadata?.tasks;
  if (!Array.isArray(requests)) return [];
  return requests.map((request: any, index: number) => {
    const output = String(request?.output ?? "");
    const failures = getTagContent(output, "failed-actions").split("\n").filter(Boolean);
    return {
      index: Number(request?.taskIndex ?? index + 1),
      id: request?.taskId,
      name: request?.taskName,
      mode: request?.mode,
      targetId: request?.targetId,
      pageId: request?.pageId,
      succeeded: Number(request?.succeeded ?? 0),
      failed: Number(request?.failed ?? 0),
      actions: getTagContent(output, "generated-actions"),
      failures,
      error: request?.error,
    };
  });
}

function CopyActionsButton({ actions }: { actions: string }) {
  const [copied, setCopied] = useState(false);
  if (!actions) return null;

  const copy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(actions);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = actions;
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className={css["update-page-copy"]} type="button" onClick={copy} title={copied ? "已复制" : "复制"}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/** lowcode_generate_page 的结构化执行回执。 */
export const UpdatePageRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const { taskCount } = getStats(tool);
  const isRunning = tool.status === "pending";
  const isError = tool.status === "error";
  const pageRequests = getPageRequests(tool);
  const title = "操作页面";
  const meta = `${taskCount} 个页面需求`;
  const fallbackDetail = [tool.result?.output ? String(tool.result.output) : "", tool.error ? `错误：${tool.error}` : ""].filter(Boolean).join("\n\n");

  if (messagesRenderVariant === "line") {
    return <LineToolRenderer tool={tool} icon={<Pencil />} title={title} meta={meta} detail={fallbackDetail} />;
  }

  return (
    <div className={css["update-page-card"]}>
      <div className={css["update-page-header"]}>
        <span className={css["update-page-header-icon"]}>{isRunning ? <Loading /> : isError ? <ErrorIcon /> : <Success />}</span>
        <span className={css["update-page-header-title"]}>{title}</span>
        <span className={css["update-page-header-meta"]}>{meta}</span>
        <Duration tool={tool} />
      </div>

      {isRunning ? (
        <div className={css["update-page-progress"]}>正在接收并执行 actions…</div>
      ) : null}

      {pageRequests.map((request) => (
        <section className={css["update-page-request"]} key={`${request.index}-${request.id ?? request.name ?? ""}`}>
          <div className={css["update-page-request-header"]}>
            <span className={css["update-page-request-title"]}>{request.name || `页面请求 ${request.index}`}</span>
            <span className={css["update-page-request-meta"]}>{request.mode === "create" ? "新建页面" : "修改页面"}</span>
          </div>
          {request.targetId || request.pageId ? <div className={css["update-page-target"]}>目标：{request.pageId ?? request.targetId}</div> : null}
          <div className={css["update-page-request-footer"]}>
            <span className={css["update-page-request-meta"]}>{request.succeeded} 个操作成功{request.failed ? ` / ${request.failed} 个失败` : ""}</span>
            <CopyActionsButton actions={request.actions} />
          </div>
          {request.failures.length ? <div className={css["update-page-error"]}>{request.failures.join("\n")}</div> : null}
          {request.error ? <div className={css["update-page-error"]}>{request.error}</div> : null}
        </section>
      ))}

      {!isRunning && !pageRequests.length && fallbackDetail ? <pre className={css["update-page-fallback"]}>{fallbackDetail}</pre> : null}
    </div>
  );
};
