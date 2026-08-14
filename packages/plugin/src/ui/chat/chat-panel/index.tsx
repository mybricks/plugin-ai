import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { AgentMode } from "../../../../../agent/src";
import type { AttachProcessor } from "../../../content-limits";
import type { MentionProvider } from "../../components/types";
import { MessageList } from "../messages";
import type { ActionBarItem, HistoryCollapseConfig } from "../messages";
import { useHistoryCollapse } from "./use-history-collapse";
import { Header } from "./header";
import { ChatPanelProvider } from "./context";
import type { ChatMarkdownItConfig, MarkdownSkinConfig, MessagesRenderVariant } from "./context";
import type { MessageRecord } from "../use-session";
import { useAgent, type ChatAgent } from "./use-agent";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export type ChatPanelSize = "small" | "medium" | "large";

export interface ChatPanelProps {
  user?: User;
  copilot?: User;
  /** 是否展示 Header，默认 true；传函数时自定义渲染 Header */
  header?: boolean | (() => React.ReactNode);
  /** agent 实例 */
  agent?: ChatAgent;
  /** 上传文件回调，不传时回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** Header 标题，不传时读 context.name */
  title?: string;
  /**
   * 用户消息自定义渲染函数（只有 record）。
   * 返回 ReactNode，替换消息气泡中的默认文本展示。
   */
  renderUserMessage?: (record: MessageRecord) => React.ReactNode;
  /**
   * @deprecated ChatPanelList 内部已改用默认 focus 内容串；该入口仅为外部兼容保留。
   * 输入框上方 focus 区域的渲染函数。
   * 返回 ReactNode，展示当前聚焦的组件 / 区域信息。
   */
  renderFocus?: () => React.ReactNode;
  /** 是否禁用 ChatPanel；由调用方显式控制，不读取 context.disabled */
  disabled?: boolean;
  /**
   * ⚠️ 试验性 API，后续版本将移除。
   * 在附件上传按钮之后插入自定义渲染内容。
   */
  renderAttachmentSuffix?: () => React.ReactNode;
  /** 判断输入框当前内容是否为默认 focus 内容串 */
  matchDefaultFocusContent?: SenderProps["matchDefaultFocusContent"];
  /** Sender 普通 placeholder，不传时使用默认问候文案 */
  placeholder?: SenderProps["placeholder"];
  /** 命中默认 focus 内容串时展示的 placeholder */
  defaultFocusPlaceholder?: SenderProps["defaultFocusPlaceholder"];
  /**
   * 消息列表为空时，在 Sender 上方渲染的自定义内容（如引导语、快捷指令卡片等）。
   * 返回 ReactNode；有消息后自动隐藏。
   */
  renderEmpty?: () => React.ReactNode;
  /**
   * 在 Sender 下方渲染的自定义内容。
   * 返回 ReactNode；随 Sender 一起渲染，不受消息数量影响。
   */
  renderSenderFooter?: () => React.ReactNode;
  /** 面板尺寸，默认 small；通过 CSS 变量控制消息列表、Sender 和卡片间距/字号 */
  size?: ChatPanelSize;
  /** 消息内工具调用的展示形态，默认 card。 */
  messagesRenderVariant?: MessagesRenderVariant;
  /**
   * 是否让消息滚动容器包含 Sender 区域。
   * 默认 false，保持 Sender 位于消息滚动容器外部的旧布局；
   * 开启后 Sender 会作为 sticky footer 渲染在消息滚动容器底部，同时保留 MessageList.scrollToBottom 能力。
   */
  scrollWithSender?: boolean;
  /** 自定义根元素类名，用于覆盖 ChatPanel CSS 变量 */
  className?: string;
  /** 自定义根元素样式，可直接传入 CSS 变量做局部调节 */
  style?: React.CSSProperties;
  /**
   * Markdown 皮肤配置，允许覆盖消息 / plan 场景的 markdown 渲染 class。
   * - message：AI 消息内容的皮肤，默认内置 skin-message
   * - plan：计划卡片 body 的皮肤，默认内置 skin-plan
   */
  markdownSkin?: MarkdownSkinConfig;
  /**
   * messages 专用 Markdown 扩展配置。
   * 只影响消息区 MarkdownMessage，不影响 plan / PRD 等其他渲染入口。
   */
  markdownit?: ChatMarkdownItConfig;
  /**
   * 超长历史折叠配置。
   * - maxIters：iter 数量上限，超过后折叠旧 turns，默认 50
   */
  historyCollapse?: HistoryCollapseConfig;
  /**
   * ActionBar 白名单配置。
   * - 不传：默认只展示复制
   * - 传递数组：按白名单展示对应按钮
   */
  actionBar?: ActionBarItem[];
  /**
   * 是否将模式选择器和模型选择器渲染在 renderFocus / 附件区域下方、输入框上方。
   * 默认 false（保持渲染在底部操作栏左侧）。
   */
  selectorRenderInTop?: boolean;
  /**
   * 附件前置处理器列表。
   * - type: "file"  → match 测文件名，process 对 File 做转换
   * - type: "link"  → match 测完整 URL，process 对 LinkAttachment 做转换
   * ChatPanel 会根据 agent 类型自动选择 processInSandbox 还是 process，调用方无需关心。
   * 图片（image/*）始终走 attachment 流程，不受此配置影响。
   */
  attachProcessors?: AttachProcessor[];
  /** 自定义 mention 注册源，透传给 Sender */
  mentions?: MentionProvider[];
}

export interface ChatPanelRef {
  focus: () => void;
  /** 当前输入框是否可以被外部自动追加内容 */
  canAppendInput: () => boolean;
  appendInput: SenderRef["appendInput"];
  /** 获取输入框当前草稿内容 */
  getInput: SenderRef["getInput"];
  /** 替换输入框内当前的默认 focus 内容串 */
  replaceFocusContent: SenderRef["replaceFocusContent"];
  /** 清空输入框内当前文本/chip，不清空附件 */
  clearFocusContent: SenderRef["clearFocusContent"];
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

const ChatPanel = forwardRef<ChatPanelRef, ChatPanelProps>(({
  user,
  copilot,
  header = true,
  agent,
  onUpload,
  title,
  renderUserMessage,
  renderFocus,
  disabled = false,
  renderAttachmentSuffix,
  matchDefaultFocusContent,
  placeholder,
  defaultFocusPlaceholder,
  renderEmpty,
  renderSenderFooter,
  size = "small",
  messagesRenderVariant = "card",
  scrollWithSender = false,
  className,
  style,
  markdownSkin,
  markdownit,
  historyCollapse,
  actionBar,
  selectorRenderInTop = false,
  attachProcessors,
  mentions = (context.pluginParams.mentions ?? []) as MentionProvider[],
}, ref) => {
  const senderRef = useRef<SenderRef>(null);

  useEffect(() => {
    mentions.forEach((mention) => chipRegistry.register(mention.chip));
  }, [mentions]);
  const messageListRef = useRef<{ scrollToBottom: () => void }>(null);

  const scrollToBottom = useCallback(() => {
    messageListRef.current?.scrollToBottom();
  }, []);

  const localAgent = useAgent({
    agent,
    disabled,
    onTurnStart: scrollToBottom,
    onTurnEnd: scrollToBottom,
  });
  const chatAgent = localAgent;

  const {
    messages,
    historyStatus,
    historyError,
    hasMore,
    isLoadingMore,
    loading,
    pendingQueue,
    showChatMode,
    chatMode,
    modelSelector,
    isDisabled,
    canExecutePlan,
  } = chatAgent;

  const maxHistoryIters = historyCollapse?.maxIters ?? 50;
  const {
    collapseCursor,
    onExpandHistory: onExpandHistoryBase,
  } = useHistoryCollapse(messages, maxHistoryIters);

  const onExpandHistory = useCallback(async (type: "one" | "ten") => {
    if (isLoadingMore) return;
    const collapsedCount = collapseCursor?.visibleStartIndex ?? 0;

    // 当前页还有折叠内容时，只在本地展开；展开完后才向历史源请求更早记录。
    if (collapsedCount > 0) {
      onExpandHistoryBase(type === "one" ? "one" : "all");
      return;
    }

    if (hasMore) await chatAgent.loadMoreHistory(type === "one" ? 1 : 10);
  }, [chatAgent, collapseCursor?.visibleStartIndex, hasMore, isLoadingMore, onExpandHistoryBase]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      senderRef.current?.focus();
    },
    canAppendInput: () => senderRef.current?.canAppendInput() ?? false,
    appendInput: (params) => {
      senderRef.current?.appendInput(params);
    },
    getInput: () => senderRef.current?.getInput() ?? { message: "", attachments: [], chips: [] },
    replaceFocusContent: (params) => {
      senderRef.current?.replaceFocusContent(params);
    },
    clearFocusContent: () => {
      senderRef.current?.clearFocusContent();
    },
  }), []);

  // aiViewDisplay 时自动聚焦输入框
  useEffect(() => {
    if (isDisabled) return;
    senderRef.current?.focus()
    const unDisplay = context.events.on("aiViewDisplay", () => {
      setTimeout(() => senderRef.current?.focus());
    });
    return unDisplay;
  }, [isDisabled]);

  const historyFailed = historyStatus === "error";
  const historyLoading = historyStatus === "idle" || historyStatus === "loading";

  const headerNode = typeof header === "function"
    ? header()
    : header
      ? <Header title={title} onClear={chatAgent.clear} onExport={chatAgent.exportHistory} disabled={isDisabled} />
      : null;

  const senderNode = (
    <Sender
      ref={senderRef}
      loading={loading}
      placeholder={placeholder ?? `您好，我是${context.name}，请详细描述您的需求`}
      defaultFocusPlaceholder={defaultFocusPlaceholder}
      disabled={isDisabled}
      mode="mention"
      chatMode={showChatMode ? chatMode : null}
      onSend={chatAgent.send}
      onChatModeChange={(nextMode: AgentMode | null) => {
        chatAgent.setChatMode(nextMode);
      }}
      onUpload={onUpload ?? context.pluginParams.onUpload}
      onStop={chatAgent.stop}
      pendingQueue={pendingQueue}
      onRemoveFromQueue={chatAgent.removeFromQueue}
      renderFocus={renderFocus}
      renderAttachmentSuffix={renderAttachmentSuffix}
      modelSelector={modelSelector}
      selectorRenderInTop={selectorRenderInTop}
      chipTypes={chipRegistry.getAll()}
      mentions={mentions}
      matchDefaultFocusContent={matchDefaultFocusContent}
      attachProcessors={attachProcessors}
      agent={chatAgent.source === "local" ? agent as any : undefined}
    />
  );
  const senderFooterNode = renderSenderFooter?.();
  const senderBlockNode = senderFooterNode !== undefined && senderFooterNode !== null && senderFooterNode !== false ? (
    <div className={css["sender-block"]}>
      {senderNode}
      <div className={css["sender-footer"]}>{senderFooterNode}</div>
    </div>
  ) : senderNode;

  return (
    <ChatPanelProvider value={{ user, copilot, disabled: isDisabled, renderUserMessage, markdownSkin, markdownit, messagesRenderVariant }}>
      <div
        className={classNames(css["chat-panel"], css[`size-${size}`], className)}
        style={style}
      >
        {headerNode}

        <div className={css["messages-area"]}>
          {historyLoading ? (
            <div className={css["history-status"]}>正在加载历史记录...</div>
          ) : null}
          {historyFailed ? (
            <div className={css["history-status"]}>
              历史记录加载失败，请刷新后重试
            </div>
          ) : null}
          <MessageList
            ref={messageListRef}
            messages={messages}
            agent={chatAgent.source === "local" ? agent as any : undefined}
            actionBar={actionBar}
            onRetry={chatAgent.retry}
            onDelete={chatAgent.deleteTurn}
            onExecutePlan={chatAgent.executePlan}
            canExecutePlan={canExecutePlan}
            renderEmpty={historyStatus === "ready" ? renderEmpty : undefined}
            renderFooter={scrollWithSender ? () => senderBlockNode : undefined}
            collapseCursor={collapseCursor ? { ...collapseCursor, hasMore, isLoadingMore } : (hasMore ? { visibleStartIndex: 0, collapsedCount: 0, hasMore, isLoadingMore } : undefined)}
            onExpandHistory={onExpandHistory}
          />
        </div>
        {scrollWithSender ? null : senderBlockNode}
      </div>
    </ChatPanelProvider>
  );
});

export { ChatPanel };
export type { ChatMarkdownItConfig, MarkdownSkinConfig, MessagesRenderVariant } from "./context";
export { useAgent } from "./use-agent";
export { HttpAgent, isHttpAgent } from "./http-agent";
export type { ChatAgent, ChatPanelAgentState } from "./use-agent";
export type {
  BrowserToolRequest,
  BrowserToolResult,
  DisplayModelHttpAgentRequestAIParams,
  HttpAgentOptions,
  HttpAgentRequestAIParams,
  MessageHttpAgentRequestAIParams,
  RemoteAgentEvent,
} from "./http-agent";
