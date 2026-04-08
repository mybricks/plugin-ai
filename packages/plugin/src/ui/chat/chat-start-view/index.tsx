import React, { useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { useSessions } from "../use-sessions";
import { MessageList } from "../messages";
import css from "./index.less";

interface User {
  name?: string;
  avatar?: string;
}

export interface ChatStartViewProps {
  user?: User;
  copilot?: User;
  /** comId，对应 agent.key */
  comId?: string;
}

// ─── ChatStartView ────────────────────────────────────────────────────────────

const ChatStartView = ({ user, copilot, comId }: ChatStartViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);

  const agent = comId ? context.agentMap.get(comId) : undefined;
  const sandbox = comId ? context.sandboxMap.get(comId) : undefined;

  const { getMessages, addMessage, syncAgent, subscribeAgent } = useSessions();

  useEffect(() => {
    if (!agent) return;
    syncAgent(agent);
  }, [comId, agent]);

  const messages = agent ? getMessages(agent) : [];

  const onSend = (params: Parameters<SenderProps["onSend"]>[0]) => {
    if (loading || !agent) return;
    setEmpty(false);
    setLoading(true);

    const userAttachments = (params.attachments ?? []).map((a: any) => ({
      type: a.type ?? "image",
      content: a.content ?? a.url ?? "",
    }));

    const id = addMessage(agent, params.message ?? "", userAttachments);
    subscribeAgent(agent, id);

    const doRequest = async () => {
      const contextPrompt = sandbox?.pluginContext?.getFocusArea?.();
      await agent.requestAI({ ...params });
    };

    if (comId) {
      (window as any)._showAIDialog_?.(comId);
      setTimeout(() => doRequest().finally(() => setLoading(false)), 500);
    } else {
      doRequest().finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    const pendingMessage = (window as any).__vibePendingMessage__;
    (window as any).__vibePendingMessage__ = null;
    if (pendingMessage) {
      setLoading(true);
      setTimeout(() => onSend(pendingMessage), 300);
    }
  }, []);

  return (
    <div className={classNames(css["start-view"], { [css["empty"]]: empty && !loading })}>
      {empty && !loading && (
        <div className={css["welcome-header"]}>
          <div className={css["welcome-title"]}>在这里，开始您的需求</div>
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
          placeholder="请尽量详细描述您的需求，或者上传图片作为补充。完成后您可以导出源码或者Figma设计稿。"
          attachmentsPrompt="根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新"
          onUpload={context.pluginParams.onUpload}
        />
      )}
    </div>
  );
};

export { ChatStartView };
