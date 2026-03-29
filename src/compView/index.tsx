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
  /** 当前聚焦的组件 ID，用于初始化独立 rxai key 以及触发聚焦事件 */
  comId?: string;
  [key: string]: any;
}

const CompView = ({ user, copilot, comId }: CompViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [rxai, setRxai] = useState<Rxai>(null);

  const onSend = (params: Parameters<SenderProps['onSend']>[0]) => {
    // setEmpty(false);
    if (!loading) {
      setLoading(true);

      if (comId) {
        const agent = context.agents?.find(
          (a) => a instanceof AbstractAgent && (a as AbstractAgent).type === 'vibeCoding'
        ) as AbstractAgent | undefined;

        if (agent) {
          const vibeRxai = agent.getRxai({
            key: `${context.pluginParams.key}_${comId}`,
          });
          setRxai(vibeRxai);
        }
      }

      // 先触发聚焦元素的事件（让当前聚焦对象感知到对话），500ms 后再真正发送
      const sendRequest = () => {
        // 从当前聚焦对象中获取 onProgress
        const focus: any = context.currentFocus || {};
        const { onProgress, focusArea, ...other } = focus;

        const promise = Agents.requestAgent('vibe', {
          ...params,
          extension: {
            mentions: [{
              ...other,
              focusArea: focusArea && {
                selector: focusArea.selector,
                title: focusArea.title,
              }
            }],
          },
          onProgress,
        });
        promise?.then(() => {
        }).catch((e) => {
          console.error("[pluginAI - compView - onSend]", e);
        }).finally(() => {
          setLoading(false);
        });
      };

      if (comId) {
        (window as any)._showAIDialog_?.(comId);
        setTimeout(sendRequest, 500);
      } else {
        sendRequest();
      }
    }
  };

  useEffect(() => {
    const pendingMessage = (window as any).__vibePendingMessage__;
    ;(window as any).__vibePendingMessage__ = null;
    if (pendingMessage) {
      setLoading(true);
      setTimeout(() => {
        onSend(pendingMessage)
      }, 300)
    }
  }, [])

  return (
    <div className={classNames(css['view'], {
      [css['empty']]: empty && !loading
    })}>
      {empty && !loading && (
        <div className={css['welcome-header']}>
          <div className={css['welcome-title']}>一句话，开始设计新页面</div>
        </div>
      )}
      {loading && (
        <div className={css['loading-view']}>
          <div className={css['loading-dots']}>
            <span className={css['dot']} />
            <span className={css['dot']} />
            <span className={css['dot']} />
          </div>
          <span className={css['loading-text']}>正在思考中...</span>
        </div>
      )}
      {/* { rxai && <Messages user={user} rxai={rxai} copilot={copilot} /> } */}
      {!loading && (
        <Sender
          ref={senderRef}
          loading={loading}
          disabled={loading}
          onSend={onSend}
          variant="loose"
          placeholder={`从一句话或者一张图片开始，为您生成所需要的页面`}
          attachmentsPrompt={"根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新"}
          onUpload={context.pluginParams.onUpload}
        />
      )}

    </div>
  );
};

export { CompView };
export type { CompViewProps };
