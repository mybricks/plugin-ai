import React, { useEffect, useRef, useMemo, useState } from "react";
import classNames from "classnames";
import markdownit from "markdown-it";
import { TextShimmer } from "../../components/text-shimmer";
import { AttachmentsList } from "../../components/attachments";
import { ElapsedTime } from "../../components/elapsed-time";
import type { MessageRecord } from "../use-session";
import type { ToolCallRecord, WarmupIter } from "../../../../../agent/src";
import type { CodeAgent } from "../../../../../agent/src";
import { getToolRenderer } from "./tool-renders/index";
import type { ToolRenderer } from "./tool-renders/index";
import { DefaultToolRenderer } from "./tool-renders/renders";
import "./tool-renders/register";
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
  agent?: CodeAgent;
  renderUserMessage?: (record: MessageRecord) => React.ReactNode;
  onRetry?: (turnId: string) => void;
}

type MessageListRef = { scrollToBottom: () => void };

const MessageList = React.forwardRef<MessageListRef, MessageListProps>(
  function MessageListInner({ messages, user, copilot, agent, renderUserMessage, onRetry }, ref) {
  const mainRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<AutoScroller | null>(null);

  // 缓存工具渲染器映射，避免流式渲染时重复计算
  const toolRendererMap = useMemo(() => {
    const map = new Map<string, ToolRenderer>();

    // 优先从 agent 的工具列表中提取自定义渲染器
    if (agent) {
      const tools = agent.getTools();
      for (const tool of tools) {
        if (tool.render) {
          map.set(tool.name, tool.render);
        }
      }
    }

    return map;
  }, [agent]);

  useEffect(() => {
    const s = new AutoScroller(mainRef.current!);
    scrollerRef.current = s;
    return () => s.destroy();
  }, []);

  React.useImperativeHandle(ref, () => ({
    scrollToBottom: () => scrollerRef.current?.forceScrollToBottom(),
  }), []);

  return (
    <main ref={mainRef} className={css["message-list"]}>
      {messages.map((record, index) => (
        <MessageBubble
          key={record.id}
          record={record}
          user={user}
          copilot={copilot}
          toolRendererMap={toolRendererMap}
          renderUserMessage={renderUserMessage}
          onRetry={index === messages.length - 1 ? onRetry : undefined}
          agent={agent}
        />
      ))}
    </main>
  );
  });

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = ({ record, user, copilot, toolRendererMap, renderUserMessage, onRetry, agent }: {
  record: MessageRecord;
  user?: User;
  copilot?: User;
  toolRendererMap: Map<string, ToolRenderer>;
  renderUserMessage?: (record: MessageRecord) => React.ReactNode;
  onRetry?: (turnId: string) => void;
  agent?: CodeAgent;
}) => {
  // 重试状态：{ attempt, maxRetries } 或 null
  const [retryState, setRetryState] = useState<{ attempt: number; maxRetries: number } | null>(null);

  // 订阅 llm:retry 事件
  useEffect(() => {
    if (!agent) return;

    const unsubscribe = agent.events.on('llm:retry', ({ step, attempt, maxRetries }) => {
      // 只显示当前 pending record 的重试状态
      if (record.status === 'pending') {
        setRetryState({ attempt, maxRetries });
      }
    });

    // 清理：当 record 不再 pending 时清空重试状态
    if (record.status !== 'pending') {
      setRetryState(null);
    }

    return unsubscribe;
  }, [agent, record.status]);

  return (
    <div className={css["chat-bubble-container"]}>
      {/* 时间戳居中 */}
      <div className={css["chat-bubble-time"]}>{formatTime(record.startTime)}</div>

      {/* 用户消息 —— 靠右 */}
      <div className={classNames(css["chat-bubble"], css["user-bubble"])}>
        <header className={css["chat-bubble-header"]}>
          <span className={css["chat-bubble-header-name"]}>{record.sender?.name ?? user?.name ?? "用户"}</span>
          {(record.sender?.avatar ?? user?.avatar) && (
            <div className={css["chat-bubble-header-avatar"]}>
              <img className={css["user-avatar"]} src={record.sender?.avatar ?? user?.avatar} />
            </div>
          )}
        </header>
        <section className={classNames(css["chat-message-container"], css["user-message"])}>
          {renderUserMessage ? renderUserMessage(record) : <div className={css["user-message-text"]}>{record.userText}</div>}
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
              <div className={css["iter-header"]}>
                <div className={css["iter-header-content"]}>
                  {retryState && (
                    <span className={css["retry-info"]}>
                      重试 {retryState.attempt}/{retryState.maxRetries}
                    </span>
                  )}
                  <TextShimmer className={css["iter-header-placeholder"]}>思考中...</TextShimmer>
                </div>
              </div>
            )}

            {/* 按 iteration 渲染 */}
            {record.iterations.map((iter, iterIdx) => {
              // warmup 特殊 iter：只在 loading/success 时展示，error 态由底部错误块承担
              if (iter.type === "warmup") {
                const warmupIter = iter as WarmupIter;
                if (warmupIter.status === "error") return null;
                const isLoading = warmupIter.status === "loading";
                return (
                  <div key={iterIdx} className={css["iter-header"]}>
                    <div className={css["iter-header-content"]}>
                      {isLoading ? (
                        <TextShimmer className={css["iter-header-placeholder"]}>{warmupIter.content}</TextShimmer>
                      ) : (
                        <span>{warmupIter.content}</span>
                      )}
                    </div>
                    <ElapsedTime startTime={warmupIter.startTime} endTime={warmupIter.endTime} className={css["planning-elapsed"]} />
                  </div>
                );
              }

              // 普通 LLM iter
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
                        <div className={css["iter-header-content"]}>
                          {retryState && isLastIter && isPending && (
                            <span className={css["retry-info"]}>
                              重试 {retryState.attempt}/{retryState.maxRetries}
                            </span>
                          )}
                          <BubbleMessage message={iter.content} />
                        </div>
                        {iter.startTime && <ElapsedTime startTime={iter.startTime} endTime={iter.endTime} className={css["planning-elapsed"]} />}
                      </>
                    ) : iter.toolCalls.length === 0 && isPending ? (
                      <>
                        <div className={css["iter-header-content"]}>
                          {retryState && isLastIter && (
                            <span className={css["retry-info"]}>
                              重试 {retryState.attempt}/{retryState.maxRetries}
                            </span>
                          )}
                          <TextShimmer className={css["iter-header-placeholder"]}>思考中...</TextShimmer>
                        </div>
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
                        <ToolBubble tool={uiTool} toolRendererMap={toolRendererMap} />
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
                {onRetry && (
                  <button
                    className={css["retry-button"]}
                    onClick={() => {
                      onRetry(record.id)
                    }}
                  >
                    重试
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
};

// ─── ToolBubble ───────────────────────────────────────────────────────────────

type UIToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };

const ToolBubble = ({ tool, toolRendererMap }: { tool: UIToolRecord; toolRendererMap: Map<string, ToolRenderer> }) => {
  // 优先从 agent 的工具列表中查找自定义渲染函数（已缓存）
  const customRenderer = toolRendererMap.get(tool.name);
  if (customRenderer) {
    return <>{customRenderer(tool as any)}</>;
  }

  // 降级到全局 registry（用于内置工具）
  const globalRenderer = getToolRenderer(tool.name);
  if (globalRenderer) {
    return <>{globalRenderer(tool as any)}</>;
  }

  // 最终降级到默认渲染器
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
  return <div className={css['message-content']} ref={ref} />;
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

  /** 强制锁底并立即滚到底（用于 turn:start / turn:end） */
  forceScrollToBottom() {
    this.isLockedToBottom = true;
    this.scrollToBottom();
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