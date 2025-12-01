import React, { useEffect, useRef, useState } from "react"
import { Agents } from "../agents";
import { Messages } from "../components/messages";
import { Sender, SenderRef, SenderProps } from "../components/sender";
import css from "./index.less"
import { context } from "../context";
import classNames from "classnames";

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
        onProgress: api.onProgress,
        rxai: context.globalRxai
      }).then(() => {

      }).catch((e) => {
        // message.error(e)
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
      <Messages user={user} rxai={context.globalRxai} copilot={copilot} />
      <Sender
        ref={senderRef}
        loading={loading}
        onSend={onSend}
        placeholder={"您好，我是智能助手，请详细描述您要搭建的应用内容"}
      />
    </div>
  )
}

export { StartView }
