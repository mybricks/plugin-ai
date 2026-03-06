import React, { useEffect, useRef, useState } from "react"
import classNames from "classnames";
import { Header } from "./components";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import type { ChatModeType } from "../components/chatMode";
import { context } from "../context";
import { Agents } from '../agents'
import { AbstractAgent } from "../agents/utils/config";
import css from "./index.less";

interface ViewProps {
  api: AiViewApi;
  user: any;
  copilot: any;
}

const View = ({ user, copilot, api }: ViewProps) => {
  const senderRef = useRef<SenderRef>(null);
  const [rxai, setRxai] = useState(context.rxai);
  // const [vibeCoding, setVibeCoding] = useState(false);
  const [chatMode, setChatMode] = useState<ChatModeType>(null);

  const PLACEHOLDER_MAP = {
    normal: `您好，我是${context.name}，请详细描述您的需求`,
    disabled: `您好，我是${context.name}，请先从画布中选择场景或组件，再开始对话`,
    loading: "处理中，请稍后..."
  }

  const [senderStateProps, setSenderStateProps] = useState(() => {
    return {
      loading: false,
      disabled: true,
      placeholder: PLACEHOLDER_MAP["disabled"]
    }
  })
  const focusID = useRef<string>(null);

  useEffect(() => {
    const statusChange = (state: "loading" | "normal" | "disabled") => {
      if (state === "disabled") {
        setSenderStateProps({
          disabled: true,
          loading: false,
          placeholder: PLACEHOLDER_MAP["disabled"]
        })
      } else {
        const bool = state === "loading";
        setSenderStateProps({
          disabled: bool,
          loading: bool,
          placeholder: PLACEHOLDER_MAP[state]
        })
      }
    }

    const disconnectAiViewDisplay = context.events.on("aiViewDisplay", () => {
      setTimeout(() => {
        senderRef.current!.focus();
      })
    }, true)
    const disconnectFocus = context.events.on("focus", (focus) => {
      if (!focus) {
        senderRef.current!.setMentions([]);
        focusID.current = null;
        statusChange("disabled");
        // setRxai(context.rxai);
        setChatMode(null);
        changeRxai(null);
      } else {
        const type = focus.type;
        const id = ["page", "section"].includes(type) ? focus.pageId : focus.comId;
        const { onProgress, ...other } = focus;
        senderRef.current!.setMentions([other] as any);
        // setVibeCoding(other.vibeCoding || false);

        let chatMode = null;
        // let hasVibeCofing = false;
        let focusArea = "";

        if ('vibeCoding' in other) {
          const agent = context.agents!.find((agent) => agent instanceof AbstractAgent && agent.type === "vibeCoding");
          focusArea = agent?.getFocusArea?.({ focus }) || "";

          // hasVibeCofing = true;
          if (!context.vibeStatus[id]) {
            context.vibeStatus[id] = 'vibe';
          }
          chatMode = context.vibeStatus[id];
          setChatMode(chatMode);
        } else {
          setChatMode(null);
        }
        focusID.current = id;
        const status = context.requestStatusTracker.getStatus(id + focusArea);
        statusChange(status.state === "pending" ? "loading" : "normal");
        // setTimeout(() => {
        //   senderRef.current!.focus();
        // })
        changeRxai(chatMode);
        // if (vibeCoding) {
        //   setTimeout(() => {
        //     // TODO: ai组件库里注册agents的时机不对
        //     const agent = context.agents!.find((agent) => {
        //       return agent instanceof AbstractAgent && agent.type === "vibeCoding"
        //     });
        //     if (agent) {
        //       const rxai = (agent as AbstractAgent).getRxai({
        //         key: `${context.pluginParams.key}_${focus.pageId}_${focus.comId}`,
        //       })
        //       setRxai(rxai);
        //     } else {
        //       setRxai(context.rxai);
        //     }
        //   })
        // } else {
        //   setRxai(context.rxai);
        // }
      }
    }, true)
    const disconnectPromiseStatusTracker = context.requestStatusTracker.events.on("promise", (promise) => {
      if (promise.id === focusID.current) {
        statusChange(promise.status.state === "pending" ? "loading" : "normal");
      }
    })
    return () => {
      disconnectAiViewDisplay()
      disconnectFocus()
      disconnectPromiseStatusTracker()
    }
  }, [])

  const changeRxai = (chatMode: ChatModeType) => {
    if (chatMode === "vibe") {
      console.log('focusArea', context.currentFocus?.comId)
      setTimeout(() => {
        // TODO: ai组件库里注册agents的时机不对
        const agent = context.agents!.find((agent) => {
          return agent instanceof AbstractAgent && agent.type === "vibeCoding"
        });
        if (agent) {
          const rxai = (agent as AbstractAgent).getRxai({
            key: `${context.pluginParams.key}_${context.currentFocus?.pageId}_${context.currentFocus?.comId}`,
          })
          setRxai(rxai);
        } else {
          setRxai(context.rxai);
        }
      })
    } else {
      setRxai(context.rxai);
    }
  }

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, ...extension } = sendMessage;

    if (!focusID.current) {
      return;
    }

    // 聚焦到页面或者组件时使用这个方法请求agent
    const agentType = context.vibeStatus[focusID.current] === "vibe" ? 'vibe' : 'common';
    context.requestStatusTracker.track(focusID.current, Agents.requestAgent(agentType, {
      message,
      attachments,
      extension,
      onProgress: context.currentFocus?.onProgress,
    }));
  }

  const onMentionClick: NonNullable<SenderProps["onMentionClick"]> = (mention) => {
    const { id, type, comId, pageId } = mention;
    api[type === "page" ? "focusPage" : "focusCom"]((type === "page" ? pageId : comId) || id as string);
  }

  const onMessagesSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, insertAfter,  ...extension } = sendMessage;
    const { mentions } = extension
    const mention = sendMessage.mentions[0];

    // 聚焦到页面或者组件时使用这个方法请求agent
    const agentType = context.vibeStatus[focusID.current] === "vibe" ? 'vibe' : 'common';
    context.requestStatusTracker.track(mention.type === "page" ? mention.pageId : mention.comId, Agents.requestAgent(agentType, {
      message,
      attachments,
      insertAfter,
      extension,
      focus: mentions[0],
      onProgress: context.currentFocus?.onProgress,
    }));
  }

  const onChatModeChange = (mode: ChatModeType) => {
    setChatMode(mode);
    const id = focusID.current;
    if (id) {
      context.vibeStatus[id] = mode;
      changeRxai(mode);
    }
  }

  return (
    <div className={classNames(css.view)} style={chatMode === "vibe" ? ({ '--mybricks-color-primary': '#16A157' } as React.CSSProperties) : undefined}>
      <Header rxai={rxai}/>
      <Messages
        key={rxai.key}
        user={user}
        copilot={copilot}
        rxai={rxai}
        onSend={onMessagesSend}
        onMentionClick={onMentionClick}
      />
      <Sender
        ref={senderRef}
        loading={senderStateProps.loading}
        placeholder={senderStateProps.placeholder}
        disabled={senderStateProps.disabled}
        mode="mention"
        chatMode={chatMode}
        onSend={onSend}
        onMentionClick={onMentionClick}
        onChatModeChange={onChatModeChange}
      />
    </div>
  )
}

export { View }
