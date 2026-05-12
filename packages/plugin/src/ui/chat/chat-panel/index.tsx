import React, { useEffect, useRef, useState, useMemo } from "react";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import type { QueueItem } from "../../../context/queue";
import type { CodeAgent } from "../../../../../agent/src";
import type { LLMProviders, ModelSelection } from "../../../../../request/src/providers";
import { useSession } from "../use-session";
import { MessageList } from "../messages";
import { Header } from "./header";
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
   * 输入框上方 focus 区域的渲染函数。
   * 返回 ReactNode，展示当前聚焦的组件 / 区域信息。
   */
  renderFocus?: () => React.ReactNode;
  /** 是否禁用发送输入框 */
  disabled?: boolean;
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

const ChatPanel = ({
  user,
  copilot,
  header = true,
  agent,
  onUpload,
  title,
  renderUserMessage,
  renderFocus,
  disabled = false,
}: ChatPanelProps) => {
  const agentKey = agent?.key ?? "";

  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(agentKey));
  const [contextDisabled, setContextDisabled] = useState(() => context.disabled);

  // 模型选择器状态
  const modelSelector = useMemo(() => {
    const llmProviders = context.llmProviders;
    if (!llmProviders || !llmProviders.isValid()) return undefined;
    const models = llmProviders.getValidModels();
    const selected = llmProviders.getSelected();
    return {
      models,
      selected,
      onSelect: (selection: ModelSelection) => {
        llmProviders.setSelected(selection.providerId, selection.modelId);
      },
    };
  }, [context.llmProviders]);

  const { messages, syncAgent, subscribeSession, clearSession } = useSession(agent);
  const messageListRef = useRef<{ scrollToBottom: () => void }>(null);

  // 同步历史 + 订阅事件 + turn 滚底
  useEffect(() => {
    if (!agent) return;
    syncAgent(agent).catch(console.error);
    const scrollToBottom = () => messageListRef.current?.scrollToBottom();
    const unsubSession = subscribeSession(agent, { onTurnStart: scrollToBottom, onTurnEnd: scrollToBottom });
    return unsubSession;
  }, [agent, syncAgent, subscribeSession]);

  // 监听 aiQueue loading / queue 状态
  useEffect(() => {
    const unL = context.aiQueue.events.on("loading", (d) => {
      if (d.key === agentKey) setLoading(d.loading);
    });
    const unQ = context.aiQueue.events.on("queue", (d) => {
      if (d.key === agentKey) setPendingQueue([...d.queue]);
    });
    const unD = context.events.on("disabled", (v: boolean) => setContextDisabled(v));
    return () => { unL(); unQ(); unD(); };
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

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments } = sendMessage;
    if (!agent) return;

    context.aiQueue.send(
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ message, attachments });
      },
      { message, attachments }
    );
  };

  return (
    <div className={css["chat-panel"]}>
      {header ? <Header title={title} onClear={onClear} onExport={onExportHistory} /> : null}

      <div className={css["messages-area"]}>
        <MessageList
          ref={messageListRef}
          messages={messages}
          user={user}
          copilot={copilot}
          agent={agent}
          renderUserMessage={renderUserMessage}
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
        disabled={!agent || disabled || contextDisabled}
        mode="mention"
        chatMode={null}
        onSend={onSend}
        onChatModeChange={() => {}}
        onUpload={onUpload ?? context.pluginParams.onUpload}
        onStop={() => context.aiQueue.stop(agentKey)}
        pendingQueue={pendingQueue}
        onRemoveFromQueue={(id: string) => context.aiQueue.removeFromQueue(agentKey, id)}
        renderFocus={renderFocus}
        modelSelector={modelSelector}
      />
    </div>
  );
};

export { ChatPanel };
