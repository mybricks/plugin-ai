import React, { useEffect, useRef, useState } from "react"
import classNames from "classnames";
import { Header } from "./components";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import { context } from "../context";
import { Agents } from '../agents'
import css from "./index.less";

interface ViewProps {
  api: AiViewApi;
  user: any;
  copilot: any;
}
const PLACEHOLDER_MAP = {
  normal: "您好，我是智能助手，请详细描述您的需求",
  disabled: "您好，我是智能助手，请先从画布中选择页面或组件，再开始对话",
  loading: "处理中，请稍后..."
}
const View = ({ user, copilot, api }: ViewProps) => {
  const senderRef = useRef<SenderRef>(null);
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
      } else {
        const type = focus.type;
        const id = type === "page" ? focus.pageId : focus.comId;
        senderRef.current!.setMentions([{
          id,
          type,
          name: focus.title,
        }]);
        focusID.current = id;
        const status = context.requestStatusTracker.getStatus(id);
        statusChange(status.state === "pending" ? "loading" : "normal");
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

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, ...extension } = sendMessage;

    if (!focusID.current) {
      return;
    }

    context.requestStatusTracker.track(focusID.current, Agents.requestCommonAgent({
      message,
      attachments,
      extension,
      onProgress: context.currentFocus?.onProgress
    }));
  }

  const onMentionClick: NonNullable<SenderProps["onMentionClick"]> = (mention) => {
    const { id, type } = mention;
    api[type === "page" ? "focusPage" : "focusCom"](id);
  }

  return (
    <div className={classNames(css.view)}>
      <Header />
      <Messages
        user={user}
        copilot={copilot}
        rxai={context.rxai}
        onMentionClick={onMentionClick}
      />
      <Sender
        ref={senderRef}
        loading={senderStateProps.loading}
        placeholder={senderStateProps.placeholder}
        disabled={senderStateProps.disabled}
        onSend={onSend}
        onMentionClick={onMentionClick}
      />
    </div>
  )
}

export { View }
