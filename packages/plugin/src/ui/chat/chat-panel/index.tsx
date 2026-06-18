import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { QueueItem } from "../../../context/queue";
import type { AgentMode, CodeAgent } from "../../../../../agent/src";
import { AgentModeEnum } from "../../../../../agent/src";
import type { LLMProviders, ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { MessageList } from "../messages";
import { Header } from "./header";
import { ChatPanelProvider } from "./context";
import type { MessageRecord } from "../use-session";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatPanelProps {
  user?: User;
  copilot?: User;
  /** 是否展示 Header，默认 true */
  header?: boolean;
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
  /** 命中默认 focus 内容串时展示的 placeholder */
  defaultFocusPlaceholder?: SenderProps["defaultFocusPlaceholder"];
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
  defaultFocusPlaceholder,
}, ref) => {
  const agentKey = agent?.key ?? "";

  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(agentKey));
  const availableModes = agent?.getAvailableModes() ?? [AgentModeEnum.Build];
  const showChatMode = availableModes.length > 1;
  const [chatMode, setChatMode] = useState<AgentMode>(() => agent?.getMode() ?? availableModes[0] ?? AgentModeEnum.Build);

  // 模型选择器状态 —— 通过 llmProviders 实例事件同步多视图
  const llmProviders = context.llmProviders;
  const hasLLMProviders = !!(llmProviders && llmProviders.isValid());
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(
    () => llmProviders?.getSelected() ?? null
  );

  useEffect(() => {
    const lp = context.llmProviders;
    if (!lp) return;
    setSelectedModel(lp.getSelected());
    return lp.onSelectionChange((sel) => setSelectedModel(sel));
  }, [context.llmProviders]);

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

  const { messages, syncAgent, subscribeSession, clearSession } = useSession(agent);
  const messageListRef = useRef<{ scrollToBottom: () => void }>(null);

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

  // 同步历史 + 订阅事件 + turn 滚底
  useEffect(() => {
    if (!agent) return;
    const scrollToBottom = () => messageListRef.current?.scrollToBottom();
    // 先订阅再同步历史，避免面板挂载瞬间错过新请求事件。
    const unsubSession = subscribeSession(agent, { onTurnStart: scrollToBottom, onTurnEnd: scrollToBottom });
    // 同步 agent 内部的 mode 变化（如 requestAI 带 mode 参数）
    const unsubMode = agent.events.on("mode:change", ({ mode }) => setChatMode(mode));
    syncAgent(agent).catch(console.error);
    return () => {
      unsubSession?.();
      unsubMode();
    };
  }, [agent, syncAgent, subscribeSession]);

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
    if (!agent) return;
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

  const isDisabled = !agent || !!disabled;
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

  return (
    <ChatPanelProvider value={{ user, copilot, disabled: isDisabled, renderUserMessage }}>
      <div className={css["chat-panel"]}>
        {header ? <Header title={title} onClear={onClear} onExport={onExportHistory} /> : null}

        <div className={css["messages-area"]}>
          <MessageList
            ref={messageListRef}
            messages={messages}
            agent={agent}
            onExecutePlan={onExecutePlan}
            canExecutePlan={canExecutePlan}
            onRetry={(id: string) => {
              if (!agent) return;
              context.aiQueue.clearQueue(agentKey);
              context.aiQueue.send(
                agentKey,
                async () => {
                  context.aiQueue.registerAbort(agentKey, () => agent.abort());
                  await agent.retry(id);
                },
                { message: "" }
              );
            }}
          />
        </div>

        <Sender
          ref={senderRef}
          loading={loading}
          placeholder={`您好，我是${context.name}，请详细描述您的需求`}
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
          chipTypes={chipRegistry.getAll()}
          matchDefaultFocusContent={matchDefaultFocusContent}
        />
      </div>
    </ChatPanelProvider>
  );
});

export { ChatPanel };
