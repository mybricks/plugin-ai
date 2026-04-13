import React, { useEffect, useRef, useState } from "react";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { MentionTag } from "../../components/mention";
import { context } from "../../../context";
import type { QueueItem } from "../../../context/queue";
import type { CodeAgent } from "../../../../agent/src";
import { useSession } from "../use-session";
import { MessageList } from "../messages";
import { Header } from "./header";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatPanelProps {
  user?: User;
  copilot?: User;
  /** agent 实例 */
  agent?: CodeAgent;
  /** focus 快照，用于初始化 sender 的 mention */
  focusSnapshot?: any;
  /** 上传文件回调，不传时回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** Header 标题，不传时读 context.name */
  title?: string;
  /**
   * 用户消息文本的自定义渲染函数（原始文本，未经 formatUserMessage 处理）。
   * 返回 ReactNode，替换消息气泡中的默认文本展示。
   */
  renderUserMessage?: (text: string, record: any) => React.ReactNode;
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

const ChatPanel = ({ user, copilot, agent, focusSnapshot, onUpload, title, renderUserMessage }: ChatPanelProps) => {
  const agentKey = agent?.key ?? "";

  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(agentKey));

  const { messages, syncAgent, subscribeSession, clearSession } = useSession(agent);

  // 同步历史 + 订阅事件
  useEffect(() => {
    if (!agent) return;
    syncAgent(agent).catch(console.error);
    subscribeSession(agent);
  }, [agent]);

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

  // focusSnapshot 变化时注入 mention 并聚焦
  useEffect(() => {
    if (focusSnapshot) {
      const { onProgress, ...mentionData } = focusSnapshot;
      setTimeout(() => {
        senderRef.current?.setMentions?.([mentionData] as any);
        senderRef.current?.focus();
      });
    }
  }, [focusSnapshot]);

  const onClear = async () => {
    if (!agent) return;
    await agent.clearHistory();
    clearSession();
  };

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments } = sendMessage;
    if (!agent) return;

    const sandbox = context.sandboxMap.get(agentKey);

    context.aiQueue.send(
      agentKey,
      async () => {
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({
          message,
          attachments,
          ...(focusSnapshot ? { meta: { focus: focusSnapshot } } : {}),
        });
      },
      { message, attachments }
    );
  };

  return (
    <div className={css["chat-panel"]}>
      <Header title={title} onClear={onClear} />

      <div className={css["messages-area"]}>
        <MessageList messages={messages} user={user} copilot={copilot} renderUserMessage={renderUserMessage} />
      </div>

      <Sender
        ref={senderRef}
        loading={loading}
        placeholder={`您好，我是${context.name}，请详细描述您的需求`}
        disabled={!agent}
        mode="mention"
        chatMode={null}
        onSend={onSend}
        onChatModeChange={() => {}}
        onUpload={onUpload ?? context.pluginParams.onUpload}
        onStop={() => context.aiQueue.stop(agentKey)}
        pendingQueue={pendingQueue}
        onRemoveFromQueue={(id) => context.aiQueue.removeFromQueue(agentKey, id)}
        renderFocus={focusSnapshot ? () => (
          <>
            <span>对于</span>
            {focusSnapshot.focusArea ? (
              <span className={css["focus-area"]}>{focusSnapshot.focusArea.title || "区域"}</span>
            ) : (
              <MentionTag mention={focusSnapshot} />
            )}
          </>
        ) : undefined}
      />
    </div>
  );
};

export { ChatPanel };
