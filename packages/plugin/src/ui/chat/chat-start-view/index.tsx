import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import type { CodeAgent } from "../../../../../agent/src";
import { useSession } from "../use-session";
import { ensureAIPanelOpen } from "../../../utils/ensure-ai-panel-open";
import css from "./index.less";

// ─── LoadingView ────────────────────────────────────────────────────────────
export interface LoadingViewProps {
  tip: string;
}

const LoadingView = (props: LoadingViewProps) => {
  return (
    <div className={css["loading-view"]}>
      <div className={css["loading-dots"]}>
        <span className={css["dot"]} />
        <span className={css["dot"]} />
        <span className={css["dot"]} />
      </div>
      <span className={css["loading-text"]}>{props.tip}</span>
    </div>
  )
}

// ─── ChatStartView ────────────────────────────────────────────────────────────

export interface ChatStartViewProps {
  /** agent 实例 */
  agent?: CodeAgent;
  /** sandbox 组件 ID，用于打开对应面板 */
  comId?: string;
  /** 上传文件回调 */
  onUpload?: (file: File) => Promise<string>;
  /** 占位符文案 */
  placeholder?: string;
  /** 欢迎语标题文案 */
  welcomeTitle?: string;
}

const ChatStartView = ({
  agent,
  comId,
  onUpload,
  placeholder = "请尽量详细描述您的需求，或者上传图片作为补充。完成后您可以导出源码或者Figma设计稿。",
  welcomeTitle = "在这里，开始您的需求",
}: ChatStartViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const agentKey = agent?.key ?? "";
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [empty, setEmpty] = useState(true);

  const { syncAgent, subscribeSession } = useSession(agent);

  useEffect(() => {
    if (!agent) return;
    syncAgent(agent).catch(console.error);
    subscribeSession(agent);
  }, [agent]);

  // 与 ChatPanel 保持同步：通过 aiQueue 事件驱动 loading，而非本地管理
  useEffect(() => {
    if (!agentKey) return;
    const un = context.aiQueue.events.on("loading", (d) => {
      if (d.key === agentKey) setLoading(d.loading);
    });
    return un;
  }, [agentKey]);

  const onSend = (params: Parameters<SenderProps["onSend"]>[0]) => {
    if (loading || !agent || !comId) return;
    setEmpty(false);

    ensureAIPanelOpen(comId).then(() => {
      context.aiQueue.send(
        agentKey,
        async () => {
          context.aiQueue.registerAbort(agentKey, () => agent.abort());
          await agent.requestAI(params);
        },
        { message: params.message, attachments: params.attachments }
      );
    });
  };

  useEffect(() => {
    // 如果宿主应用在组件初始化前通过 window.__vibePendingMessage__ 预置了消息，
    // 则在 StartView 挂载后立即触发发送，实现自动开始对话的效果。
    const pendingMessage = (window as any).__vibePendingMessage__;
    (window as any).__vibePendingMessage__ = null;
    if (pendingMessage) {
      setTimeout(() => onSend(pendingMessage), 300);
    }
  }, []);

  return (
    <div className={classNames(css["start-view"], { [css["empty"]]: empty && !loading })}>
      {empty && !loading && (
        <div className={css["welcome-header"]}>
          <div className={css["welcome-title"]}>{welcomeTitle}</div>
        </div>
      )}
      {loading && (
        <LoadingView tip="正在思考中..." />
      )}
      {!loading && (
        <Sender
          ref={senderRef}
          loading={loading}
          disabled={loading}
          onSend={onSend}
          variant="loose"
          placeholder={placeholder}
          attachmentsPrompt="根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新"
          onUpload={onUpload}
        />
      )}
    </div>
  );
};

// ─── ComChatStartView ─────────────────────────────────────────────────────────

export interface ComChatStartViewProps extends Omit<ChatStartViewProps, "agent"> {
  /** sandbox 组件 ID，用于从 context 查找对应的 agent */
  comId: string;
}

const ComChatStartView = ({ comId, ...rest }: ComChatStartViewProps) => {
  const agentKey = context.getAgentKey(comId);
  const agent = context.agentMap.get(agentKey);
  return <ChatStartView agent={agent} comId={comId} onUpload={context.pluginParams.onUpload} {...rest} />;
};

export { ChatStartView, ComChatStartView, LoadingView };
