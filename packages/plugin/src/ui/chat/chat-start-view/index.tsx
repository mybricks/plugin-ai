import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import type { CodeAgent } from "../../../../agent/src";
import { useSession } from "../use-session";
import { MessageList } from "../messages";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatStartViewProps {
  user?: User;
  copilot?: User;
  /** agent 实例 */
  agent?: CodeAgent;
  /** 上传文件回调，不传时回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** 占位符文案 */
  placeholder?: string;
  /** 欢迎语标题文案 */
  welcomeTitle?: string;
}

// ─── ChatStartView ────────────────────────────────────────────────────────────

const ChatStartView = ({
  user,
  copilot,
  agent,
  onUpload,
  placeholder = "请尽量详细描述您的需求，或者上传图片作为补充。完成后您可以导出源码或者Figma设计稿。",
  welcomeTitle = "在这里，开始您的需求",
}: ChatStartViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const agentKey = agent?.key ?? "";
  const [loading, setLoading] = useState(() => context.aiQueue.isLoading(agentKey));
  const [empty, setEmpty] = useState(true);

  const { messages, syncAgent, addMessage, subscribeAgent } = useSession(agent);

  useEffect(() => {
    if (agent) syncAgent(agent).catch(console.error);
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
    if (loading || !agent) return;
    setEmpty(false);

    const userAttachments = (params.attachments ?? []).map((a: any) => ({
      type: a.type ?? "image",
      content: a.content ?? a.url ?? "",
    }));

    const id = addMessage(params.message ?? "", userAttachments);
    subscribeAgent(agent, id);

    const sandbox = context.sandboxMap.get(agentKey);
    (window as any)._showAIDialog_?.(agentKey);

    context.aiQueue.send(
      agentKey,
      async () => {
        const contextPrompt = (sandbox as any)?.pluginContext?.getFocusArea?.();
        context.aiQueue.registerAbort(agentKey, () => agent.abort());
        await agent.requestAI({ ...params, contextPrompt });
      },
      { message: params.message, attachments: params.attachments }
    );
  };

  useEffect(() => {
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
      {messages.length > 0 && (
        <MessageList messages={messages} user={user} copilot={copilot} />
      )}
      {loading && messages.length === 0 && (
        <div className={css["loading-view"]}>
          <div className={css["loading-dots"]}>
            <span className={css["dot"]} />
            <span className={css["dot"]} />
            <span className={css["dot"]} />
          </div>
          <span className={css["loading-text"]}>正在思考中...</span>
        </div>
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
          onUpload={onUpload ?? context.pluginParams.onUpload}
        />
      )}
    </div>
  );
};

export { ChatStartView };
