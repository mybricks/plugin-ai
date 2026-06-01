import React, { useCallback, useEffect, useRef, useState } from "react";
import { Sender, SenderRef } from "../../components/sender";
import { MentionTag } from "../../components/mention";
import { context } from "../../../context";
import { ChatPanel } from "../chat-panel";
import type { ChatPanelRef } from "../chat-panel";
import type { MessageRecord } from "../use-session";
import type { SendToAgentParams } from "../../../sandbox";
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

const FocusTag = ({ focus }: { focus: any }) => {
  const label = focus?.focusArea?.title ?? focus?.title ?? "元素";
  return (
    <span className={css["focus-tag"]}>
      <span className={css["focus-tag-icon"]} aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 5.5h5m-5 2.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={css["focus-tag-text"]}>{label}</span>
    </span>
  );
};

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
  const panelRefs = useRef(new Map<string, ChatPanelRef | null>());
  const currentComIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    currentComIdRef.current = currentComId;
  }, [currentComId]);

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

  const ensureInstance = useCallback((comId: string, focus?: any) => {
    const focusSnapshot = focus ?? { comId };
    setCurrentComId(comId);
    setInstances((prev) => {
      const existing = prev.find((inst) => inst.comId === comId);
      if (existing) {
        return prev.map((inst) =>
          inst.comId === comId ? { ...inst, focusSnapshot: { ...inst.focusSnapshot, ...focusSnapshot } } : inst
        );
      }
      return [...prev, { comId, focusSnapshot }];
    });
  }, []);

  useEffect(() => {
    if (context.currentFocus) {
      handleFocus(context.currentFocus);
    }

    const unFocus = context.events.on("focus", handleFocus);
    const unDisplay = context.events.on("aiViewDisplay", () => {
      if (!currentComIdRef.current) {
        setTimeout(() => disabledSenderRef.current?.focus());
      }
    });
    const unAppendInput = context.events.on("appendInput", ({ comId, input }: { comId: string; input: string | SendToAgentParams }) => {
      if (!comId) return;
      ensureInstance(comId);
      setTimeout(() => panelRefs.current.get(comId)?.appendInput(input));
    });

    // 注册 inputGetter，供 context.getInput() 调用（与 appendInput 同构，反向读取）
    context.registerInputGetter((comId?: string) => {
      const targetComId = comId ?? currentComIdRef.current;
      if (!targetComId) return undefined;
      return panelRefs.current.get(targetComId)?.getInput();
    });

    return () => {
      unFocus();
      unDisplay();
      unAppendInput();
      context.registerInputGetter(undefined);
    };
  }, [handleFocus, ensureInstance]);

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
              ref={(ref) => {
                panelRefs.current.set(comId, ref);
              }}
              agent={agent}
              user={user}
              copilot={copilot}
              onUpload={onUpload}
              title={title}
              renderUserMessage={pluginRenderUserMessage}
              renderFocus={focusSnapshot ? () => (
                <>
                  <span>对于 </span>
                  <FocusTag focus={focusSnapshot} />
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
