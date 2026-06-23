import React, { useEffect, useRef, useMemo, useState } from "react";
import classNames from "classnames";
import markdownit from "markdown-it";
import { Image } from "antd";
import { TextShimmer } from "../../components/text-shimmer";
import { AttachmentsList } from "../../components/attachments";
import { ElapsedTime } from "../../components/elapsed-time";
import type { MessageRecord } from "../use-session";
import type { ToolCallRecord, WarmupIter } from "../../../../../agent/src/types";
import type { CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { ActivePlanFile } from "../../../../../agent/src/mode-manager";
import { WRITE_TOOL_NAME } from "../../../../../agent/src/code-agent/tools/write";
import { EDIT_TOOL_NAME } from "../../../../../agent/src/code-agent/tools/edit";
import { MULTI_WRITE_TOOL_NAME } from "../../../../../agent/src/code-agent/tools/multi-write";
import { MULTI_EDIT_TOOL_NAME } from "../../../../../agent/src/code-agent/tools/multi-edit";
import { getToolRenderer } from "./tool-renders/index";
import type { ToolRenderer } from "./tool-renders/index";
import { DefaultToolRenderer } from "./tool-renders/renders";
import { useChatPanel } from "../chat-panel/context";
import { isPlanFilePath, usePlanState } from "../../components/plan";
import "./tool-renders/register";
import css from "./index.less";
import { PlanFileCardWithContent } from "./action-cards/plan-card";
import { SuggestionsBlock } from "./action-cards/suggestions-card";

const md = markdownit();

/** 将底层错误消息映射为用户友好的提示（仅渲染层使用，原始数据保留不变） */
function toUserFriendlyError(msg: string): string {
  if (msg === 'Failed to fetch' || msg === 'Load failed') {
    return '模型服务连接失败，请检查网络或稍后重试';
  }
  if (/^SSE \d+:/.test(msg)) {
    return '模型服务响应异常，请稍后重试';
  }
  return msg;
}


export interface MessageListProps {
  messages: MessageRecord[];
  agent?: CodeAgent;
  onRetry?: (turnId: string) => void;
  onExecutePlan?: (title: string) => void;
  canExecutePlan?: boolean;
  /** 消息列表为空时在区域内居中展示的自定义内容 */
  renderEmpty?: () => React.ReactNode;
  /** 粘在滚动区域底部的自定义 footer，例如 Sender */
  renderFooter?: () => React.ReactNode;
}

type MessageListRef = { scrollToBottom: () => void };

const MessageList = React.forwardRef<MessageListRef, MessageListProps>(
  function MessageListInner({ messages, agent, onRetry, onExecutePlan, canExecutePlan = true, renderEmpty, renderFooter }, ref) {
  const mainRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<AutoScroller | null>(null);
  const { activePlan } = usePlanState(agent);

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
      <div className={css["message-list-inner"]}>
        {messages.length === 0 && renderEmpty ? (
          <div className={css["empty-state"]}>{renderEmpty()}</div>
        ) : (
          messages.map((record, index) => (
            <MessageBubble
              key={record.id}
              record={record}
              toolRendererMap={toolRendererMap}
              onRetry={index === messages.length - 1 ? onRetry : undefined}
              isLast={index === messages.length - 1}
              agent={agent}
              onExecutePlan={onExecutePlan}
              canExecutePlan={canExecutePlan}
              activePlan={activePlan}
            />
          ))
        )}
        {renderFooter ? (
          <div className={css["message-list-footer"]}>{renderFooter()}</div>
        ) : null}
      </div>
    </main>
  );
  });

// ─── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = ({ record, toolRendererMap, onRetry, isLast, agent, onExecutePlan, canExecutePlan = true, activePlan }: {
  record: MessageRecord;
  toolRendererMap: Map<string, ToolRenderer>;
  onRetry?: (turnId: string) => void;
  isLast?: boolean;
  agent?: CodeAgent;
  onExecutePlan?: (title: string) => void;
  canExecutePlan?: boolean;
  activePlan: ActivePlanFile | null;
}) => {
  const { user, copilot, renderUserMessage } = useChatPanel();
  const isPlanRecord = isPlanModeRecord(record);
  const isCompletedPlanRecord =
    record.status === "success" &&
    Boolean(record.endTime) &&
    isPlanRecord;
  const planFile = useMemo(() => {
    if (!isCompletedPlanRecord) return null;
    return getActivePlanFileFromRecord(record, activePlan);
  }, [record, isCompletedPlanRecord, activePlan]);
  const shouldShowPlanCard =
    isCompletedPlanRecord &&
    Boolean(planFile?.content?.trim());
  const canOperatePlanCard = Boolean(isLast) && Boolean(agent);

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
          {renderUserMessage ? renderUserMessage(record) : <UserMessageContent message={record.userText} />}
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
          <div className={css["message-flow"]}>
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
                          <MarkdownMessage message={iter.content} />
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
                <div className={css["ai-chat-error-content"]}>{toUserFriendlyError(record.error)}</div>
                {onRetry && !record.error.includes("连续调用，已自动中断") && (
                  <div className={css["ai-chat-error-actions"]}>
                    <button
                      className={css["retry-button"]}
                      onClick={() => {
                        onRetry(record.id)
                      }}
                    >
                      重试
                    </button>
                  </div>
                )}
              </div>
            )}

            {shouldShowPlanCard && planFile && (
              <PlanFileCardWithContent
                path={planFile.path}
                content={planFile.content}
                onExecute={canOperatePlanCard ? () => {
                  onExecutePlan?.(planFile.title ?? planFile.path);
                } : undefined}
                canExecute={canOperatePlanCard && canExecutePlan}
                // TODO: 先隐藏「废弃方案」入口，后续确认交互价值后再恢复。
                onAbandon={undefined}
                renderContent={(body) => <MarkdownMessage message={body} />}
              />
            )}

            {/* 建议选项（仅最后一条 turn、且 suggestions 已就绪时展示；与 plan card 互斥） */}
            {isLast && !shouldShowPlanCard && record.suggestions && !record.suggestionsDismissed && agent && (
              <SuggestionsBlock turnId={record.id} suggestions={record.suggestions} agent={agent} />
            )}
          </div>
        </section>
      </div>
    </div>
  )
};

const UserMessageContent = ({ message }: { message: string }) => {
  if (/!\[[^\]]*]\([^)]+\)/.test(message)) {
    return <MarkdownMessage message={message} className={css["user-message-text"]} />;
  }

  return <div className={css["user-message-text"]}>{message}</div>;
};

function getActivePlanFileFromRecord(record: MessageRecord, activePlan: ActivePlanFile | null): ActivePlanFile | null {
  if (!activePlan || activePlan.status !== "active" || !activePlan.content.trim()) return null;

  const relatedPlanPaths = new Set<string>();

  for (const iter of record.iterations) {
    if (iter.type === "warmup") continue;

    for (const tool of iter.toolCalls) {
      for (const path of getPlanPathsFromTool(tool)) {
        relatedPlanPaths.add(path);
      }
    }
  }

  return relatedPlanPaths.has(activePlan.path.replace(/^\/+/, "")) ? activePlan : null;
}

function getPlanPathsFromTool(tool: ToolCallRecord): string[] {
  const normalizePlanPath = (path: unknown) => {
    if (typeof path !== "string" || !path) return null;
    const normalized = path.replace(/^\/+/, "");
    return isPlanFilePath(normalized) ? normalized : null;
  };

  if (tool.name === WRITE_TOOL_NAME || tool.name === EDIT_TOOL_NAME) {
    const path = normalizePlanPath(tool.args?.path);
    return path ? [path] : [];
  }

  if (tool.name === MULTI_WRITE_TOOL_NAME) {
    const files: Array<{ path?: string }> = Array.isArray(tool.args?.files) ? tool.args.files : [];
    return files.map((file) => normalizePlanPath(file.path)).filter(Boolean) as string[];
  }

  if (tool.name === MULTI_EDIT_TOOL_NAME) {
    const edits: Array<{ path?: string }> = Array.isArray(tool.args?.edits) ? tool.args.edits : [];
    return edits.map((edit) => normalizePlanPath(edit.path)).filter(Boolean) as string[];
  }

  return [];
}

// ─── ToolBubble ───────────────────────────────────────────────────────────────

type UIToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };

const ToolBubble = ({ tool, toolRendererMap }: { tool: UIToolRecord; toolRendererMap: Map<string, ToolRenderer> }) => {
  // 优先从 agent 的工具列表中查找自定义渲染函数（已缓存）
  const customRenderer = toolRendererMap.get(tool.name);
  if (customRenderer) {
    return renderToolWithErrorBoundary(customRenderer, tool, "custom");
  }

  // 降级到全局 registry（用于内置工具）
  const globalRenderer = getToolRenderer(tool.name);
  if (globalRenderer) {
    return renderToolWithErrorBoundary(globalRenderer, tool, "registry");
  }

  // 最终降级到默认渲染器
  return <DefaultToolRenderer tool={tool as any} />;
};

function renderToolWithErrorBoundary(renderer: ToolRenderer, tool: UIToolRecord, source: "custom" | "registry") {
  return React.createElement(
    ToolRendererErrorBoundary as any,
    { tool, source, resetKey: getToolRendererResetKey(tool) },
    <ToolRendererInvoker renderer={renderer} tool={tool as any} />
  );
}

const ToolRendererInvoker = ({ renderer, tool }: { renderer: ToolRenderer; tool: ToolCallRecord }) => {
  return renderer(tool as any);
};

class ToolRendererErrorBoundary extends React.Component<
  { tool: ToolCallRecord; source: "custom" | "registry"; resetKey: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[ToolRenderer] render failed, fallback to default renderer", {
      toolName: this.props.tool.name,
      callId: this.props.tool.callId,
      source: this.props.source,
      error,
    });
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <DefaultToolRenderer tool={this.props.tool as any} />;
    }
    return this.props.children;
  }
}

function getToolRendererResetKey(tool: UIToolRecord): string {
  return `${tool.callId}:${tool.status}:${tool.execEndTime}`;
}

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
        <MarkdownMessage message={message} />
      </div>
    </div>
  );
};

// ─── MarkdownMessage ──────────────────────────────────────────────────────────

const MarkdownMessage = ({ message, className }: { message: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewCurrent, setPreviewCurrent] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.innerHTML = md.render(message);

    const nextImageUrls = Array.from(ref.current.querySelectorAll("img"))
      .map((img) => img.getAttribute("src") ?? "")
      .filter(Boolean);

    setImageUrls((prev) => {
      if (prev.length === nextImageUrls.length && prev.every((src, index) => src === nextImageUrls[index])) {
        return prev;
      }
      return nextImageUrls;
    });
  }, [message]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const image = target?.closest?.("img") as HTMLImageElement | null;
    if (!image) return;

    const images = Array.from(ref.current?.querySelectorAll("img") ?? []);
    const index = images.indexOf(image);
    if (index === -1) return;

    const nextImageUrls = images
      .map((img) => img.getAttribute("src") ?? img.src ?? img.currentSrc ?? "")
      .filter(Boolean);

    event.preventDefault();
    event.stopPropagation();
    setImageUrls(nextImageUrls);
    setPreviewCurrent(index);
    setPreviewVisible(true);
  };

  return (
    <>
      <div className={classNames(css["message-content"], css["markdown-body"], className)} ref={ref} onClick={handleClick} />
      <div style={{ display: "none" }}>
        <Image.PreviewGroup
          preview={{
            visible: previewVisible,
            onVisibleChange: setPreviewVisible,
            current: previewCurrent,
          }}
        >
          {imageUrls.map((src, index) => (
            <Image key={`${src}-${index}`} src={src} />
          ))}
        </Image.PreviewGroup>
      </div>
    </>
  );
};

export { MessageList };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlanModeRecord(record: MessageRecord): boolean {
  return record.iterations.some((iter) => (iter as any).type !== "warmup" && (iter as any).mode === AgentModeEnum.Plan);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isSameDay) {
    return time;
  }

  const date = `${d.getMonth() + 1}月${d.getDate()}日`;

  if (d.getFullYear() === now.getFullYear()) {
    return `${date} ${time}`;
  }

  return `${d.getFullYear()}年${date} ${time}`;
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
