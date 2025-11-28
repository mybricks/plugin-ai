import React, { useEffect, useRef } from "react"
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
const View = ({ user, copilot, api }: ViewProps) => {
  const senderRef = useRef<SenderRef>(null);

  useEffect(() => {
    const disconnectAiViewDisplay = context.events.on("aiViewDisplay", () => {
      setTimeout(() => {
        senderRef.current!.focus();
      })
    }, true)
    const disconnectFocus = context.events.on("focus", (focus) => {
      if (!focus) {
        senderRef.current!.setMentions([]);
      } else {
        const type = focus.type;
        const id = type === "page" ? focus.pageId : focus.comId;
        senderRef.current!.setMentions([{
          id,
          name: focus.title,
          onClick() {
            api[type === "page" ? "focusPage" : "focusCom"](id);
          },
        }]);
      }
    }, true)
    return () => {
      disconnectAiViewDisplay()
      disconnectFocus()
    }
  }, [])

  const onSend = (sendMessage: Parameters<SenderProps["onSend"]>[0]) => {
    const { message, attachments, ...extension } = sendMessage;
    Agents.requestCommonAgent({
      message,
      attachments,
      extension,
      onProgress: context.currentFocus?.onProgress
    });
  }

  return (
    <div className={classNames(css.view)}>
      <Header />
      <Messages user={user} copilot={copilot} rxai={context.rxai} />
      <Sender ref={senderRef} onSend={onSend} placeholder="您好，我是智能助手，请详细描述您的需求" />
    </div>
  )
}

export { View }