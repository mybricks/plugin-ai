import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { QueueItem } from "../../../context/queue";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { MessageList } from "../messages";
import type { HistoryCollapseConfig } from "../messages";
import { useHistoryCollapse } from "./use-history-collapse";
import { Header } from "./header";
import { ChatPanelProvider } from "./context";
import type { MarkdownSkinConfig } from "./context";
import type { MessageRecord } from "../use-session";
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
  agent?: CodeAgent;
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
   * 超长历史折叠配置。
   * - maxIters：iter 数量上限，超过后折叠旧 turns，默认 50
   */
  historyCollapse?: HistoryCollapseConfig;
  /**
   * 是否将模式选择器和模型选择器渲染在 renderFocus / 附件区域下方、输入框上方。
   * 默认 false（保持渲染在底部操作栏左侧）。
   */
  selectorRenderInTop?: boolean;
  /**
   * 支持上传的文件类型及限制配置。
   * key 为不含点的文件扩展名（小写），如 "ts"、"md"。
   * 不传时使用内置默认值（支持大部分常见文本/代码文件）。
   * 图片（image/*）始终走 attachment 流程，无需在此声明。
   */
  supportFiles?: SenderProps["supportFiles"];
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
  scrollWithSender = false,
  className,
  style,
  markdownSkin,
  historyCollapse,
  selectorRenderInTop = false,
  supportFiles,
}, ref) => {
  const agentKey = agent?.key ?? "";

  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(agentKey));
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatMode] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);

  // 模型选择器状态跟随当前 Agent，避免多 Agent/多面板串状态。
  const llmProviders = agent?.getLLMProviders();
  const hasLLMProviders = !!(llmProviders && llmProviders.isValid());
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(
    () => llmProviders?.getSelected() ?? null
  );

  useEffect(() => {
    const lp = llmProviders;
    if (!lp) return;
    setSelectedModel(lp.getSelected());
    return lp.onSelectionChange((sel) => setSelectedModel(sel));
  }, [llmProviders]);

  const modelSelector = useMemo(() => {
    if (!hasLLMProviders || !llmProviders) return undefined;
    return {
      models: llmProviders.getValidModels(),
      selected: selectedModel,
      onSelect: (selection: ModelSelection) => {
        llmProviders.setSelected(selection.providerId, selection.modelId);
      },
    };
  }, [hasLLMProviders, llmProviders, selectedModel]);

  const { messages, historyStatus, historyError, subscribeSession, clearSession } = useSession(agent);
  const messageListRef = useRef<{ scrollToBottom: () => void }>(null);
  const maxHistoryIters = historyCollapse?.maxIters ?? 50;
  const {
    collapseCursor,
    onExpandHistory,
  } = useHistoryCollapse(messages, maxHistoryIters);

  useImperativeHandle(ref, () => ({
    focus: () => {
      senderRef.current?.focus();
    },
    canAppendInput: () => senderRef.current?.canAppendInput() ?? false,
    appendInput: (params) => {
      senderRef.current?.appendInput(params);
    },
    getInput: () => senderRef.current?.getInput() ?? { message: "", attachments: [], mentions: [], chips: [] },
    replaceFocusContent: (params) => {
      senderRef.current?.replaceFocusContent(params);
    },
    clearFocusContent: () => {
      senderRef.current?.clearFocusContent();
    },
  }), []);

  // 订阅 turn 事件 + turn 滚底；历史状态由 agent.historyManager 驱动。
  useEffect(() => {
    if (!agent) return;
    const scrollToBottom = () => messageListRef.current?.scrollToBottom();
    const handleTurnEnd = () => {
      scrollToBottom();
    };
    // 先订阅 turn 事件，避免面板挂载瞬间错过新请求事件。
    const unsubSession = subscribeSession(agent, { onTurnStart: scrollToBottom, onTurnEnd: handleTurnEnd });
    // 同步 agent 内部的 mode 变化（如 requestAI 带 mode 参数）
    const unsubMode = agent.events.on("mode:change", ({ mode }) => setChatMode(mode));
    return () => {
      unsubSession?.();
      unsubMode();
    };
  }, [agent, subscribeSession]);

  // aiViewDisplay 时自动聚焦输入框
  useEffect(() => {
    if (!agent || disabled) return;
    senderRef.current?.focus()
    const unDisplay = context.events.on("aiViewDisplay", () => {
      setTimeout(() => senderRef.current?.focus());
    });
    return unDisplay;
  }, [agent, disabled]);

  // 监听 aiQueue loading / queue 状态
  useEffect(() => {
    const unL = context.aiQueue.events.on("loading", (d) => {
      if (d.key === agentKey) setLoading(d.loading);
    });
    const unQ = context.aiQueue.events.on("queue", (d) => {
      if (d.key === agentKey) setPendingQueue([...d.queue]);
    });
    return () => { unL(); unQ(); };
  }, [agentKey]);

  const onClear = async () => {
    if (!agent || isDisabled) return;
    await agent.clearHistory();
    clearSession();
  };

  const onExportHistory = async () => {
    if (!agent) return;

    try {
      const content = {
        agentKey: agent.key,
        exportedAt: new Date().toISOString(),
        turns: agent.getTurns(),
        compactRecord: agent.getCompactRecord?.() ?? null,
      };
      const name = `rxai-${Date.now()}.json`;
      await context.pluginParams.onDownload({ name, content: JSON.stringify(content) });
    } catch (e) {
      console.error("[plugin-ai] export history failed", e);
    }
  };

  // 统一入口：带 mode 调用 requestAI 时同步更新 Sender UI
  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, chips, mode } = sendMessage;
    if (!agent) return;
    const meta = chips?.length ? { chips } : undefined;
    context.aiQueue.send(
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ message, attachments, ...(mode ? { mode } : {}), ...(meta ? { meta } : {}) });
      },
      { message, attachments }
    );
  };

  const historyFailed = historyStatus === "error";
  const historyLoading = historyStatus === "idle" || historyStatus === "loading";
  const isDisabled = !agent || !!disabled || historyLoading || historyFailed;
  const canExecutePlan = Boolean(agent && !isDisabled && availableModes.includes(AgentModeEnum.Build));

  const onExecutePlan = (title: string) => {
    if (!agent || !canExecutePlan) return;
    const message = `执行「${title}」方案`;
    context.aiQueue.send(
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ message, mode: AgentModeEnum.Build });
      },
      { message }
    );
  };

  const headerNode = typeof header === "function"
    ? header()
    : header
      ? <Header title={title} onClear={onClear} onExport={onExportHistory} disabled={isDisabled} />
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
      onSend={onSend}
      onChatModeChange={(nextMode: AgentMode | null) => {
        if (nextMode) agent?.setMode(nextMode, "ui-change");
      }}
      onUpload={onUpload ?? context.pluginParams.onUpload}
      onStop={() => context.aiQueue.stop(agentKey)}
      pendingQueue={pendingQueue}
      onRemoveFromQueue={(id: string) => context.aiQueue.removeFromQueue(agentKey, id)}
      renderFocus={renderFocus}
      renderAttachmentSuffix={renderAttachmentSuffix}
      modelSelector={modelSelector}
      selectorRenderInTop={selectorRenderInTop}
      chipTypes={chipRegistry.getAll()}
      matchDefaultFocusContent={matchDefaultFocusContent}
      supportFiles={supportFiles}
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
    <ChatPanelProvider value={{ user, copilot, disabled: isDisabled, renderUserMessage, markdownSkin }}>
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
            agent={agent}
            onExecutePlan={onExecutePlan}
            canExecutePlan={canExecutePlan}
            renderEmpty={historyStatus === "ready" ? renderEmpty : undefined}
            renderFooter={scrollWithSender ? () => senderBlockNode : undefined}
            collapseCursor={collapseCursor}
            onExpandHistory={onExpandHistory}
          />
        </div>
        {scrollWithSender ? null : senderBlockNode}
      </div>
    </ChatPanelProvider>
  );
});

export { ChatPanel };
