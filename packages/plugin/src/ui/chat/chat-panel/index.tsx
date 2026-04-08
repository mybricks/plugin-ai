import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import type { QueueItem } from "../../../context/queue";
import { useSessions } from "../use-sessions";
import { MessageList } from "../messages";
import { Header } from "./header";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatPanelProps {
  api: AiViewApi;
  user?: User;
  copilot?: User;
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

interface ComInstance {
  comId: string;
  focusSnapshot: any;
}

const ChatPanel = ({ user, copilot, api }: ChatPanelProps) => {
  const [currentComId, setCurrentComId] = useState<string | undefined>(undefined);
  const [instances, setInstances] = useState<ComInstance[]>([]);
  const disabledSenderRef = useRef<SenderRef>(null);

  const { getMessages, addMessage, syncAgent, clearSession, subscribeAgent, unsubscribeAll } = useSessions();

  const handleFocus = useCallback((focus: any) => {
    if (!focus) {
      setCurrentComId(undefined);
      return;
    }

    const comId: string = focus.comId ?? focus.pageId ?? "global";
    setCurrentComId(comId);
    setInstances((prev) => {
      const existing = prev.find((inst) => inst.comId === comId);
      if (existing) {
        return prev.map((inst) =>
          inst.comId === comId ? { ...inst, focusSnapshot: { ...focus } } : inst
        );
      }
      return [...prev, { comId, focusSnapshot: { ...focus } }];
    });

    const agent = context.agentMap.get(comId);
    if (agent) {
      syncAgent(agent).catch(console.error);
    }
  }, [syncAgent]);

  useEffect(() => {
    if (context.currentFocus) {
      handleFocus(context.currentFocus);
    }

    const unFocus = context.events.on("focus", handleFocus);

    const unDisplay = context.events.on("aiViewDisplay", () => {
      if (!currentComId) {
        setTimeout(() => disabledSenderRef.current?.focus());
      }
    });

    return () => { unFocus(); unDisplay(); };
  }, [handleFocus, currentComId]);

  const onClearMessages = useCallback(async (comId: string) => {
    const agent = context.agentMap.get(comId);
    if (agent) {
      await agent.clearHistory();
      clearSession(agent);
    }
  }, [clearSession]);

  const onMentionClick: NonNullable<SenderProps["onMentionClick"]> = (mention) => {
    const { id, type, comId, pageId } = mention;
    api[type === "page" ? "focusPage" : "focusCom"]((type === "page" ? pageId : comId) || (id as string));
  };

  return (
    <div className={css["chat-panel"]}>
      <Header
        onClear={() => currentComId && onClearMessages(currentComId)}
      />

      <div className={css["messages-area"]}>
        {instances.map(({ comId }) => {
          const agent = context.agentMap.get(comId);
          return (
            <div
              key={comId}
              style={{ display: comId === currentComId ? undefined : "none", height: "100%" }}
            >
              <MessageList
                messages={agent ? getMessages(agent) : []}
                user={user}
                copilot={copilot}
              />
            </div>
          );
        })}
        {!currentComId && (
          <div className={css["empty-hint"]}>
            请先从画布中选择场景或组件，再开始对话
          </div>
        )}
      </div>

      <div style={{ display: currentComId ? "none" : undefined }}>
        <Sender
          ref={disabledSenderRef}
          loading={false}
          placeholder={`您好，我是${context.name}，请先从画布中选择场景或组件，再开始对话`}
          disabled={true}
          mode="mention"
          chatMode={null}
          onSend={() => {}}
          onMentionClick={onMentionClick}
          onChatModeChange={() => {}}
          onUpload={context.pluginParams.onUpload}
        />
      </div>

      {instances.map(({ comId, focusSnapshot }) => (
        <SessionSender
          key={comId}
          comId={comId}
          focusSnapshot={focusSnapshot}
          active={comId === currentComId}
          onMentionClick={onMentionClick}
          addMessage={addMessage}
          subscribeAgent={subscribeAgent}
        />
      ))}
    </div>
  );
};

// ─── SessionSender ────────────────────────────────────────────────────────────

interface SessionSenderProps {
  comId: string;
  focusSnapshot: any;
  active: boolean;
  onMentionClick: NonNullable<SenderProps["onMentionClick"]>;
  addMessage: ReturnType<typeof useSessions>["addMessage"];
  subscribeAgent: ReturnType<typeof useSessions>["subscribeAgent"];
}

const SessionSender = ({ comId, focusSnapshot, active, onMentionClick, addMessage, subscribeAgent }: SessionSenderProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(comId));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(comId));

  useEffect(() => {
    const unL = context.aiQueue.events.on("loading", (d) => {
      if (d.key === comId) setLoading(d.loading);
    });
    const unQ = context.aiQueue.events.on("queue", (d) => {
      if (d.key === comId) setPendingQueue([...d.queue]);
    });
    return () => { unL(); unQ(); };
  }, [comId]);

  // 切换到当前 sender 时，注入 mention 并自动聚焦（对齐老代码 SenderPanel）
  useEffect(() => {
    if (active && focusSnapshot) {
      const { onProgress, ...mentionData } = focusSnapshot;
      setTimeout(() => {
        senderRef.current?.setMentions?.([mentionData] as any);
        senderRef.current?.focus();
      });
    }
  }, [active, focusSnapshot]);

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments } = sendMessage;
    const agent = context.agentMap.get(comId);
    const sandbox = context.sandboxMap.get(comId);
    if (!agent) return;

    const userAttachments = (attachments ?? []).map((a: any) => ({
      type: a.type ?? "image",
      content: a.content ?? a.url ?? "",
    }));

    const id = addMessage(agent, message ?? "", userAttachments);
    subscribeAgent(agent, id);

    context.aiQueue.send(
      comId,
      async () => {
        const contextPrompt = sandbox?.pluginContext?.getFocusArea?.();
        context.aiQueue.registerAbort(comId, () => agent.abort());
        await agent.requestAI({ message, attachments, contextPrompt });
      },
      { message, attachments }
    );
  };

  return (
    <div style={{ display: active ? undefined : "none" }}>
      <Sender
        ref={senderRef}
        loading={loading}
        placeholder={`您好，我是${context.name}，请详细描述您的需求`}
        disabled={false}
        mode="mention"
        chatMode={null}
        onSend={onSend}
        onMentionClick={onMentionClick}
        onChatModeChange={() => {}}
        onUpload={context.pluginParams.onUpload}
        onStop={() => context.aiQueue.stop(comId)}
        pendingQueue={pendingQueue}
        onRemoveFromQueue={(id) => context.aiQueue.removeFromQueue(comId, id)}
      />
    </div>
  );
};

export { ChatPanel };
