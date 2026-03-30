import React, { useEffect, useRef, useState, useCallback } from "react"
import classNames from "classnames";
import { Header } from "./components";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import type { ChatModeType } from "../components/chatMode";
import { context } from "../context";
import { Agents } from '../agents'
import { AbstractAgent } from "../agents/utils/config";
import { getUniqueIdentifier } from "../utils";
import type { QueueItem } from "../context/AIRequestQueue";
import css from "./index.less";

interface ViewProps {
  api: AiViewApi;
  user: any;
  copilot: any;
}

interface SenderInstance {
  instanceKey: string;
  viewKey: string;
  trackKey: string;
  focusSnapshot: any;
  chatMode: ChatModeType;
}

interface SenderPanelProps {
  focusKey: string;
  focusSnapshot: any;
  chatMode: ChatModeType;
  active: boolean;
  onMentionClick: NonNullable<SenderProps["onMentionClick"]>;
  onChatModeChange: (mode: ChatModeType) => void;
}

const SenderPanel = ({ focusKey, focusSnapshot, chatMode, active, onMentionClick, onChatModeChange }: SenderPanelProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(focusKey));
  const [pendingQueue, setPendingQueue] = useState<QueueItem[]>(() => context.aiQueue.getQueue(focusKey));

  useEffect(() => {
    const unLoading = context.aiQueue.events.on("loading", (data) => {
      if (data.key === focusKey) {
        setLoading(data.loading);
      }
    });
    const unQueue = context.aiQueue.events.on("queue", (data) => {
      if (data.key === focusKey) {
        setPendingQueue([...data.queue]);
      }
    });
    return () => {
      unLoading();
      unQueue();
    };
  }, [focusKey]);

  useEffect(() => {
    if (active && focusSnapshot) {
      const { onProgress, ...other } = focusSnapshot;
      setTimeout(() => {
        senderRef.current?.setMentions([other] as any);
        senderRef.current?.focus();
      });
    }
  }, [active, focusSnapshot]);

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, ...extension } = sendMessage;
    const focusAtSendTime = focusSnapshot ? { ...focusSnapshot } : focusSnapshot;
    const agentTypeAtSendTime = chatMode === 'vibe' ? 'vibe' : 'common';
    const requestKeyAtSendTime = focusKey;

    if (!focusAtSendTime) {
      return;
    }

    context.aiQueue.send(
      requestKeyAtSendTime,
      agentTypeAtSendTime,
      {
        message,
        attachments,
        extension,
        focus: focusAtSendTime,
        key: requestKeyAtSendTime,
        onProgress: focusAtSendTime.onProgress,
      }
    );
  };

  const onStop = () => {
    context.aiQueue.stop(focusKey);
  };

  const onRemoveFromQueue = (id: string) => {
    context.aiQueue.removeFromQueue(focusKey, id);
  };

  return (
    <div style={{ display: active ? undefined : 'none' }}>
      <Sender
        ref={senderRef}
        loading={loading}
        placeholder={`您好，我是${context.name}，请详细描述您的需求`}
        disabled={false}
        mode="mention"
        chatMode={chatMode}
        onSend={onSend}
        onMentionClick={onMentionClick}
        onChatModeChange={onChatModeChange}
        onUpload={context.pluginParams.onUpload}
        onStop={onStop}
        pendingQueue={pendingQueue}
        onRemoveFromQueue={onRemoveFromQueue}
      />
    </div>
  );
};

const getChatModeByFocus = (focus: any): ChatModeType => {
  if (!focus) return null;
  const type = focus.type;
  const id = ["page", "section"].includes(type) ? focus.pageId : focus.comId;
  if (focus.vibeCoding) {
    if (!context.vibeStatus[id]) {
      context.vibeStatus[id] = 'vibe';
    }
    return context.vibeStatus[id];
  }
  return null;
};

const getFocusKey = (focus: any, chatMode: ChatModeType): string | undefined => {
  if (!focus) return undefined;
  if (chatMode === 'vibe') {
    return `${context.pluginParams.key}_${focus.comId}`;
  }
  return getUniqueIdentifier(focus);
};

const getViewKey = (focus: any, chatMode: ChatModeType): string => {
  if (chatMode === 'vibe') {
    return `${context.pluginParams.key}_${focus.comId}`;
  }
  return String(context.rxai?.key ?? 'default');
};

const View = ({ user, copilot, api }: ViewProps) => {
  const [rxai, setRxai] = useState(context.rxai);
  const [currentInstanceKey, setCurrentInstanceKey] = useState<string | undefined>(undefined);
  const [instances, setInstances] = useState<SenderInstance[]>([]);
  const disabledSenderRef = useRef<SenderRef>(null);

  const changeRxai = useCallback((mode: ChatModeType, comId?: string) => {
    if (mode === "vibe") {
      setTimeout(() => {
        const agent = context.agents!.find((agent) => agent instanceof AbstractAgent && agent.type === "vibeCoding");
        if (agent) {
          setRxai((agent as AbstractAgent).getRxai({ key: `${context.pluginParams.key}_${comId}` }));
        } else {
          setRxai(context.rxai);
        }
      });
    } else {
      setRxai(context.rxai);
    }
  }, []);

  useEffect(() => {
    const disconnectAiViewDisplay = context.events.on("aiViewDisplay", () => {
      if (!currentInstanceKey) {
        setTimeout(() => disabledSenderRef.current?.focus());
      }
    }, true);

    const disconnectFocus = context.events.on("focus", (focus) => {
      if (!focus) {
        setCurrentInstanceKey(undefined);
        changeRxai(null);
        return;
      }

      const chatMode = getChatModeByFocus(focus);
      const focusKey = getFocusKey(focus, chatMode);
      const viewKey = getViewKey(focus, chatMode);
      const instanceKey = `${viewKey}::${focusKey}`;

      setCurrentInstanceKey(instanceKey);
      changeRxai(chatMode, focus.comId);

      setInstances((prev) => {
        const existing = prev.find((inst) => inst.instanceKey === instanceKey);
        if (existing) {
          return prev.map((inst) => inst.instanceKey === instanceKey ? {
            ...inst,
            chatMode,
            focusSnapshot: { ...focus }
          } : inst);
        }

        return prev.concat({
          instanceKey,
          viewKey,
          focusKey: focusKey!,
          focusSnapshot: { ...focus },
          chatMode,
        });
      });
    }, true);

    return () => {
      disconnectAiViewDisplay();
      disconnectFocus();
    };
  }, [changeRxai, currentInstanceKey]);

  const onMentionClick: NonNullable<SenderProps["onMentionClick"]> = (mention) => {
    const { id, type, comId, pageId } = mention;
    api[type === "page" ? "focusPage" : "focusCom"]((type === "page" ? pageId : comId) || id as string);
  };

  const onChatModeChange = useCallback((instanceKey: string) => (mode: ChatModeType) => {
    setInstances((prev) => {
      const next = prev.map((inst) => inst.instanceKey === instanceKey ? { ...inst, chatMode: mode } : inst);
      const current = next.find((inst) => inst.instanceKey === instanceKey);
      if (current) {
        const focus = current.focusSnapshot;
        const type = focus?.type;
        const id = ["page", "section"].includes(type) ? focus?.pageId : focus?.comId;
        if (id) {
          context.vibeStatus[id] = mode;
        }
        changeRxai(mode, focus?.comId);
      }
      return next;
    });
  }, [changeRxai]);

  return (
    <div className={classNames(css.view)}>
      <Header rxai={rxai}/>
      <Messages
        key={rxai.key}
        user={user}
        copilot={copilot}
        rxai={rxai}
        onMentionClick={onMentionClick}
      />
      <div style={{ display: currentInstanceKey ? 'none' : undefined }}>
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
      {instances.map((inst) => (
        <SenderPanel
          key={inst.instanceKey}
          focusKey={inst.focusKey}
          focusSnapshot={inst.focusSnapshot}
          chatMode={inst.chatMode}
          active={inst.instanceKey === currentInstanceKey}
          onMentionClick={onMentionClick}
          onChatModeChange={onChatModeChange(inst.instanceKey)}
        />
      ))}
    </div>
  )
}

export { View }
