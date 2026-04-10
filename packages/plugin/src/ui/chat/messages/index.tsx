import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import markdownit from "markdown-it";
import { TextShimmer } from "../../components/text-shimmer";
import { AttachmentsList } from "../../components/attachments";
import { ElapsedTime } from "../../components/elapsed-time";
import type { MessageRecord } from "../use-sessions";
import type { ToolCallRecord } from "../../../../agent/src";
import { getToolRenderer } from "./tool-renders/index";
import { DefaultToolRenderer } from "./tool-renders/renders";
import css from "./index.less";

const md = markdownit();

interface User {
  name?: string;
  avatar?: string;
}

export interface MessageListProps {
  messages: MessageRecord[];
  user?: User;
  copilot?: User;
}

const MessageList = ({ messages, user, copilot }: MessageListProps) => {
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const autoScroller = new AutoScroller(mainRef.current!);
    return () => autoScroller.destroy();
  }, []);

  return (
    <main ref={mainRef} className={css["message-list"]}>
      {messages.map((record) => (
        <MessageBubble key={record.id} record={record} user={user} copilot={copilot} />
      ))}
    </main>
  );
};

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = ({ record, user, copilot }: { record: MessageRecord; user?: User; copilot?: User }) => (
  <div className={css["chat-bubble-container"]}>
    {/* 时间戳居中 */}
    <div className={css["chat-bubble-time"]}>{formatTime(record.startTime)}</div>

    {/* 用户消息 —— 靠右 */}
    <div className={classNames(css["chat-bubble"], css["user-bubble"])}>
      <header className={css["chat-bubble-header"]}>
        <span className={css["chat-bubble-header-name"]}>{user?.name ?? "用户"}</span>
        {user?.avatar && (
          <div className={css["chat-bubble-header-avatar"]}>
            <img className={css["user-avatar"]} src={user.avatar} />
          </div>
        )}
      </header>
      <section className={classNames(css["chat-message-container"], css["user-message"])}>
        <span>{record.userText}</span>
        {record.userAttachments.length > 0 && (
          <AttachmentsList
            className={css["attachments-list"]}
            attachments={record.userAttachments.filter((a) => a.type === "image") as any}
          />
        )}
      </section>
    </div>

    {/* AI 回复 —— 靠左 */}
    <div className={classNames(css["chat-bubble"], css["ai-bubble"])}>
      <header className={css["chat-bubble-header"]}>
        {copilot?.avatar && (
          <div className={css["chat-bubble-header-avatar"]}>
            <img className={css["user-avatar"]} src={copilot.avatar} />
          </div>
        )}
        <span className={css["chat-bubble-header-name"]}>{copilot?.name ?? "智能助手"}</span>
      </header>
      <section className={classNames(css["chat-message-container"], css["ai-message"])}>
        <div className={css["markdown-body"]}>
          {/* 无任何 iteration 且 pending → 规划占位 */}
          {record.status === "pending" && record.iterations.length === 0 && (
            <TextShimmer className={css["iter-header-placeholder"]}>规划下一步...</TextShimmer>
          )}

          {/* 按 iteration 渲染 */}
          {record.iterations.map((iter, iterIdx) => {
            const isLastIter = iterIdx === record.iterations.length - 1;
            const isPending = record.status === "pending";
            const hasTools = iter.toolCalls.length > 0;
            // 当前 iteration 的 LLM 是否已完成
            const llmDone = iter.endTime !== undefined;
            // 是否是最后一个 iteration 且 LLM 还在响应中
            const llmStreaming = isLastIter && isPending && !llmDone;
            // 是否在等待下一轮 LLM（当前 iter 工具全完成，还没下一个 iter）
            const waitingNextStep = isLastIter && isPending && llmDone && !hasTools;

            return (
              <React.Fragment key={iterIdx}>
                {/* 思考内容 */}
                {iter.thinkingContent && (
                  <ThinkingCard
                    thinkingContent={iter.thinkingContent}
                    llmStreaming={llmStreaming}
                  />
                )}

                {/* iter 头部 */}
                <div className={css["iter-header"]}>
                  {iter.content ? (
                    <>
                      <BubbleMessage message={iter.content} />
                      {iter.startTime && <ElapsedTime startTime={iter.startTime} endTime={iter.endTime} className={css["planning-elapsed"]} />}
                    </>
                  ) : iter.toolCalls.length === 0 && isPending ? (
                    <>
                      <TextShimmer className={css["iter-header-placeholder"]}>规划下一步...</TextShimmer>
                      {iter.startTime && <ElapsedTime startTime={iter.startTime} endTime={iter.endTime} className={css["planning-elapsed"]} />}
                    </>
                  ) : null}
                </div>

                {/* 工具列表 */}
                {iter.toolCalls.map((tool) => {
                  const toolStatus = tool.status === "success" || tool.execEndTime ? tool.status : "pending" as const;
                  const uiTool = { ...tool, status: toolStatus as "pending" | "success" | "error" };
                  return (
                    <React.Fragment key={tool.callId}>
                      <ToolBubble tool={uiTool} />
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* 已取消 */}
          {record.status === "abort" && (
            <div className={css["ai-chat-abort-tip"]}>已取消</div>
          )}

          {/* 错误 */}
          {record.status === "error" && record.error && (
            <div className={css["ai-chat-error-code-block"]}>
              <span>{record.error}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  </div>
);

// ─── ToolBubble ───────────────────────────────────────────────────────────────

type UIToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };

const ToolBubble = ({ tool }: { tool: UIToolRecord }) => {
  const renderer = getToolRenderer(tool.name);
  if (renderer) {
    return <>{renderer(tool as any)}</>;
  }
  return <DefaultToolRenderer tool={tool as any} />;
};

const ThinkingCard = ({
  thinkingContent,
  llmStreaming,
}: {
  thinkingContent: string;
  llmStreaming: boolean;
}) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const message = `${thinkingContent}${llmStreaming ? "..." : ""}`;

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [message]);

  return (
    <div className={css["think-card"]}>
      <div className={css["think-card-header"]}>
        {llmStreaming ? (
          <TextShimmer className={css["think-card-title"]}>思考中</TextShimmer>
        ) : (
          <span className={css["think-card-title"]}>思考</span>
        )}
      </div>
      <div ref={bodyRef} className={css["think-card-body"]}>
        <BubbleMessage message={message} />
      </div>
    </div>
  );
};

// ─── BubbleMessage ────────────────────────────────────────────────────────────

const BubbleMessage = ({ message }: { message: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = md.render(message);
  }, [message]);
  return <span ref={ref} />;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ─── AutoScroller ─────────────────────────────────────────────────────────────

class AutoScroller {
  private isLockedToBottom = true;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private scrollRafId: number | null = null;

  constructor(private container: HTMLElement) {
    if (!container) return;
    container.addEventListener("scroll", this.handleScroll.bind(this));
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isLockedToBottom) this.scheduleScrollToBottom();
    });
    this.resizeObserver.observe(container);
    this.mutationObserver = new MutationObserver(() => {
      if (this.isLockedToBottom) this.scheduleScrollToBottom();
    });
    this.mutationObserver.observe(container, { childList: true, subtree: true, characterData: true });
  }

  handleScroll() {
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    this.isLockedToBottom = Math.abs(scrollHeight - scrollTop - clientHeight) <= 5;
  }

  /** 用 rAF 节流，同一帧内多次触发只滚动一次 */
  scheduleScrollToBottom() {
    if (this.scrollRafId !== null) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = null;
      this.scrollToBottom();
    });
  }

  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  destroy() {
    if (this.scrollRafId !== null) {
      cancelAnimationFrame(this.scrollRafId);
      this.scrollRafId = null;
    }
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.container?.removeEventListener("scroll", this.handleScroll.bind(this));
  }
}

export { MessageList };
