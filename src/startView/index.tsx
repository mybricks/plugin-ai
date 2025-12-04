import React, { useEffect, useRef, useState } from "react"
import { Agents } from "../agents";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import css from "./index.less"
import { context } from "../context";
import classNames from "classnames";
import { Header } from "./components";

const StartView = ({ api, user, copilot }: any) => {
  const senderRef = useRef<SenderRef>(null);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    if (!loading) {
      senderRef.current!.focus();
    }
  }, [loading])

  const onSend = (params: Parameters<SenderProps['onSend']>[0]) => {
    setEmpty(false);
    if (!loading) {
      setLoading(true);
      Agents.requestGenerateCanvasAgent({
        ...params,
        onProgress: (status: string) => {
          if (status === "ing") {
            api.onProgress?.(status);
          }
        },
        rxai: context.globalRxai
      }).then(() => {

      }).catch((e) => {
        console.error("[pluginAI - startView - onSend]", e);
      }).finally(() => {
        setLoading(false);
      });
    }
  }

  return (
    <div className={classNames(css['view'], {
      [css['empty']]: empty
    })}
    >
      {empty && <Header />}
      <Messages user={user} rxai={context.globalRxai} copilot={copilot} />
      <Sender
        ref={senderRef}
        loading={loading}
        onSend={onSend}
        placeholder={"您好，我是智能助手，请详细描述您要搭建的应用内容"}
        attachmentsPrompt={"根据附件中的图片内容进行设计开发，要求尽可能还原其中的各类设计细节以及功能，在此基础上可做调整优化创新"}
      />
    </div>
  )
}

export { StartView }
