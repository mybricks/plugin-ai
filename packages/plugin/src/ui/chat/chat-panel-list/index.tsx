import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sender, SenderRef } from "../../components/sender";
import { MentionTag } from "../../components/mention";
import { context } from "../../../context";
import { ChatPanel } from "../chat-panel";
import type { MessageRecord } from "../use-session";
import css from "../chat-panel/index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatPanelListProps {
  user?: User;
  copilot?: User;
  /** 上传文件回调，不传时回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** Header 标题，不传时读 context.name */
  title?: string;
}

interface ComInstance {
  comId: string;
  focusSnapshot: any;
}

// ─── 默认 renderUserMessage ────────────────────────────────────────────────────
// 渲染 focus 信息 + 消息文本

const pluginRenderUserMessage = (record: MessageRecord) => {
  const focus = record.meta?.focus;
  return (
    <span>
      {focus && (
        <span className={css["user-message-focus"]}>
          <MentionTag focus={focus} />
          {" "}
        </span>
      )}
      {record.userText}
    </span>
  );
};

// ─── ChatPanelList ────────────────────────────────────────────────────────────
//
// 监听 focus 事件，每个 comId 对应一个独立 ChatPanel 实例（display:none 切换）。
// 各 ChatPanel 持有独立的 useSession，agent 事件 re-render 完全隔离。

const ChatPanelList = ({ user, copilot, onUpload, title }: ChatPanelListProps) => {
  const [currentComId, setCurrentComId] = useState<string | undefined>(undefined);
  const [instances, setInstances] = useState<ComInstance[]>([]);
  const disabledSenderRef = useRef<SenderRef>(null);

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
        // 更新 focusSnapshot（新 reference 触发 ChatPanel 内部 useEffect 重新注入 mention）
        return prev.map((inst) =>
          inst.comId === comId ? { ...inst, focusSnapshot: { ...focus } } : inst
        );
      }
      return [...prev, { comId, focusSnapshot: { ...focus } }];
    });
  }, []);

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

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* 无 focus 时展示 disabled sender 提示 */}
      {!currentComId && (
        <>
          <div className={css["empty-hint"]}>
            请先从画布中选择场景或组件，再开始对话
          </div>
          <Sender
            ref={disabledSenderRef}
            loading={false}
            placeholder={`您好，我是${context.name}，请先从画布中选择场景或组件，再开始对话`}
            disabled={true}
            mode="mention"
            chatMode={null}
            onSend={() => {}}
            onChatModeChange={() => {}}
            onUpload={onUpload ?? context.pluginParams.onUpload}
          />
        </>
      )}

      {/* 每个 comId 对应一个独立 ChatPanel 实例 */}
      {instances.map(({ comId, focusSnapshot }) => {
        const agentKey = context.getAgentKey(comId);
        const agent = context.agentMap.get(agentKey);
        return (
          <div
            key={comId}
            style={{ display: comId === currentComId ? "contents" : "none", height: "100%" }}
          >
            <ChatPanel
              agent={agent}
              user={user}
              copilot={copilot}
              onUpload={onUpload}
              title={title}
              renderUserMessage={pluginRenderUserMessage}
              renderFocus={focusSnapshot ? () => (
                <>
                  <span>对于</span>
                  <MentionTag focus={focusSnapshot} />
                </>
              ) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
};

export { ChatPanelList };
