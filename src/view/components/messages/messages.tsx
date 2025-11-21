import React, { useEffect, useLayoutEffect, useState, useRef } from "react"
import classNames from "classnames"
import { Loading3QuartersOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons"
import { marked } from "marked";
import { context } from "../../../context"
import css from "./messages.less"

const Messages = ({ user }: any) => {
  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<any>([]);

  useLayoutEffect(() => {
    // @ts-ignore TODO
    destroysRef.current.push(context.rxai.events.on('plan', (plans: any) => {
      setPlans([...plans])
    }, true))
  }, [])

  useEffect(() => {
    return () => {
      for (const destroy of destroysRef.current) {
        destroy()
      }
    }
  }, [])

  return (
    <div className={classNames(css.messages)}>
      {plans.map((plan: any, index: number) => {
        return <Plan key={index} plan={plan} user={user} />
      })}
      <div className={classNames(css.anchor)} />
    </div>
  )
}

export { Messages }

const Plan = ({ plan, user }: { plan: any, user: any }) => {
  const [messages, setMessages] = useState<any[]>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const destroysRef = useRef<any[]>([]);
  const messageRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    destroysRef.current.push(
      plan.events.on('loading', (loading: boolean) => {
        setLoading(loading);
      }, true),
      plan.events.on('messageStream', (messageStream: string) => {
        setMessage((pre) => {
          return pre + messageStream;
        })
      }, true),
      plan.events.on('userFriendlyMessages', (messages: any[]) => {
        setMessages([...messages])
        setMessage("")
      }, true),
    )
  }, [])

  useEffect(() => {
    return () => {
      for (const destroy of destroysRef.current) {
        destroy()
      }
    }
  }, [])

  useEffect(() => {
    if (message) {
      messageRef.current!.innerHTML = marked.parse(message) as string;
    }
  }, [message])

  useEffect(() => {
    console.log("[消息列表]", messages)
  }, [messages])

  return (
    <>
      {messages[0] && (
        <div className={css.bubbleContainer}>
          <div className={css.bubbleHeader}>
            <span className={css.bubbleHeaderAvatar}>
              <img className={css.userAvatar} src={user.avatar} />
            </span>
            <span className={css.bubbleHeaderName}>{user.name}</span>
          </div>
          <BubbleUser message={messages[0]} />
        </div>
      )}
      {messages[0] && (
        <div className={css.bubbleContainer}>
          <div className={css.bubbleHeader}>
            <span className={css.bubbleHeaderAvatar}>
              <img className={css.aiAvatar} src={"https://my.mybricks.world/image/icon.png"} />
            </span>
            <span className={css.bubbleHeaderName}>MyBricks.ai</span>
          </div>
          <div className={classNames(css.messageContainer)}>
            <div className={css.markDown}>
              {messages.slice(1).map((message, index) => {
                return message.role === "tool" ? <BubbleAITool key={index + message.status} message={message} /> : <BubbleAI key={index} message={message} />
              })}
              {message ? (
                <div ref={messageRef}>
                </div>
              ) : null}
              {!message && loading ? (
                <>
                  <span>正在思考</span>
                  <Loading3QuartersOutlined className={css.spinIcon} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
      {/* {messages.slice(1).map((message: any, index) => {
        return (
          <div key={index} className={classNames(css.message, {
            [css.messgaeEnd]: message.role === "user",
          })}>
            {message.role === "tool" ? (
              <div className={classNames(css.bubble, css.plan)}>
                <div>{message.content.displayName}</div>
                {message.status === "pending" && <Loading3QuartersOutlined className={css.spinIcon} />}
                {message.status === "success" && <CheckCircleOutlined style={{ color: "green" }} />}
                {message.status === "error" && <CloseCircleOutlined style={{ color: "red" }} />}
              </div>
            ) : (
              <Bubble message={message} user={user} />
            )}
          </div>
        )
      })} */}
    </>
  )
}

const BubbleAITool = ({ message }: any) => {
  console.log("[message]", message)
  return (
    <div className={css.collapsibleCodeBlock}>
      <div className={css.codeHeader}>
        <span className={css.codeTitle}>{message.content.displayName}</span>
        <span className={css.codeTitleStatus}>
          {message.status === "pending" && <Loading3QuartersOutlined className={css.spinIcon} />}
          {message.status === "success" && <CheckCircleOutlined style={{ color: "green" }} />}
          {message.status === "error" && <CloseCircleOutlined style={{ color: "red" }} />}
        </span>
      </div>
    </div>
  )
}

const BubbleAI = ({ message }: any) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = typeof message.content === "string" ?
      message.content :
      message.content.find((content: any) => {
        if (content.type === "text") {
          return content
        }
      })?.text
    bubbleRef.current!.innerHTML = marked.parse(content) as string;
  }, [])

  return <span ref={bubbleRef}></span>
}

const BubbleUser = ({ message }: any) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = typeof message.content === "string" ?
      message.content :
      message.content.find((content: any) => {
        if (content.type === "text") {
          return content
        }
      })?.text
    bubbleRef.current!.innerHTML = marked.parse(content) as string;
  }, [])

  return (
    <div className={classNames(css.messageContainer, css.userMessage)}>
      <div ref={bubbleRef} className={css.markDown}></div>
    </div>
  )
}

const Bubble = ({ message }: any) => {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const content = typeof message.content === "string" ?
      message.content :
      message.content.find((content: any) => {
        if (content.type === "text") {
          return content
        }
      })?.text
    bubbleRef.current!.innerHTML = marked.parse(content) as string;
  }, [])

  return (
    <div ref={bubbleRef} className={classNames(css.bubble)}></div>
  )
}
