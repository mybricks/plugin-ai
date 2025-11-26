import React, { useEffect, useRef, useState } from "react"
import { message } from "antd";
import { Agents } from "../agents";
import { Messages } from "../components/messages";
import { Sender } from "../components/sender";
import css from "./index.less"
import { context } from "../context";

const StartView = ({ user, copilot }: any) => {
  const senderRef = useRef<{ focus: () => void; }>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      senderRef.current!.focus();
    }
  }, [loading])

  const onSend = (sendMessage: {
    message: string;
    attachments: {
      type: "image";
      content: string;
    }[];
  }) => {
    if (!loading) {
      setLoading(true);
      Agents.requestGenerateCanvasAgent(sendMessage).then(() => {

      }).catch((e) => {
        message.error(e)
      }).finally(() => {
        setLoading(false);
      });
    }
  }

  return (
    <>
      <div className={css['messages']} style={{ display: loading ? "flex" : "none" }}>
        <Messages user={user} rxai={context.rxai} copilot={copilot} />
      </div>
      <div className={css['start-view']}>
        <div className={css['editor']} style={{ display: !loading ? "block" : "none" }}>
          <Sender ref={senderRef} onSend={onSend} placeholder={"您好，我是智能助手，请详细描述您要搭建的应用内容"}/>
        </div>
      </div>
    </>
  )
}

export { StartView }
