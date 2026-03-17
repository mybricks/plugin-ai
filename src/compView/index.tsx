import React, { useEffect, useRef, useState } from "react"
import { Agents } from "../agents";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import css from "./index.less"
import { context } from "../context";
import classNames from "classnames";
import { AbstractAgent } from "../agents/utils/config";
import { Rxai } from "@mybricks/rxai";

interface CompViewProps {
  user?: any;
  copilot?: any;
  /** 当前聚焦的组件信息，预填到 Sender 的 mentions */
  mentions?: any[];
  onProgress?: (status: string) => void;
  [key: string]: any;
}

const CompView = ({ user, copilot, mentions: initialMentions, onProgress }: CompViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [rxai, setRxai] = useState<Rxai>(context.rxai);

  useEffect(() => {
    // 初始化 vibe rxai（使用 vibeCoding agent 独立的消息记录）
    const agent = context.agents?.find(
      (a) => a instanceof AbstractAgent && (a as AbstractAgent).type === 'vibeCoding'
    ) as AbstractAgent | undefined;

    if (agent) {
      const vibeRxai = agent.getRxai({
        key: `${context.pluginParams.key}_comp_${context.currentFocus?.comId ?? Date.now()}`,
      });
      setRxai(vibeRxai);
    }

    if (!loading) {
      senderRef.current?.focus();
    }
  }, []);

  // 外部传入 mentions 时预填到 Sender
  useEffect(() => {
    if (initialMentions?.length) {
      senderRef.current?.setMentions(initialMentions);
    }
  }, [initialMentions]);

  const onSend = (params: Parameters<SenderProps['onSend']>[0]) => {
    setEmpty(false);
    if (!loading) {
      setLoading(true);
      const promise = Agents.requestAgent('vibe', {
        ...params,
        onProgress,
      });
      promise?.then(() => {
      }).catch((e) => {
        console.error("[pluginAI - compView - onSend]", e);
      }).finally(() => {
        setLoading(false);
      });
    }
  };

  return (
    <div className={classNames(css['view'], {
      [css['empty']]: empty
    })}>
      <Messages user={user} rxai={rxai} copilot={copilot} />
      <Sender
        ref={senderRef}
        loading={loading}
        onSend={onSend}
        placeholder={`您好，我是${context.name}，请描述您的需求`}
        attachmentsPrompt={"根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新"}
      />
    </div>
  );
};

export { CompView };
export type { CompViewProps };
