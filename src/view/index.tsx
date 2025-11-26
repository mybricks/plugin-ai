import React, { useEffect, useRef } from "react"
import classNames from "classnames";
import { Header } from "./components";
import { Messages } from "../components/messages";
import { Sender } from "../components/sender";
import { context } from "../context";
import { Agents } from '../agents'
import css from "./index.less";

const View = ({ user, copilot }: any) => {
  const senderRef = useRef<{ focus: () => void }>(null);

  useEffect(() => {
    senderRef.current!.focus();
    const destroy = context.events.on("aiViewDisplay", () => {
      setTimeout(() => {
        senderRef.current!.focus();
      })
    })
    return () => {
      destroy()
    }
  }, [])

  const onSend = (sendMessage: {
    message: string;
    attachments: {
      type: "image";
      content: string;
    }[];
  }) => {
    Agents.requestCommonAgent({
      ...sendMessage,
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