import React, { useEffect, useLayoutEffect, useState, useRef } from "react"
import classNames from "classnames"
import { Loading3QuartersOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons"
import { context } from "../../../context"
import css from "./messages.less"

const Messages = () => {
  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<any>([]);

  useLayoutEffect(() => {
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
      {plans.map((plan) => {
        return <Plan plan={plan} />
      })}
      <div className={classNames(css.anchor)} />
    </div>
  )
}

export { Messages }

const Plan = ({ plan }: { plan: any }) => {
  const [messages, setMessages] = useState<any[]>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const destroysRef = useRef<any[]>([]);

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

  return (
    <>
      {messages.map((message: any) => {
        return (
          <div className={classNames(css.message, {
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
              <div className={classNames(css.bubble)}>
                {/* TODO：附件展示 */}
                {typeof message.content === "string" ?
                  message.content :
                  message.content.find((content: any) => {
                    if (content.type === "text") {
                      return content
                    }
                  })?.text}
              </div>
            )}
          </div>
        )
      })}
      {message ? <div className={classNames(css.message)}>
        <div className={classNames(css.bubble)}>
          {message}{loading ? "..." : ""}
        </div>
      </div> : null}
      {!message && loading ? <div className={classNames(css.message)}>
        <div className={classNames(css.bubble)}>
          <>
            <span>正在思考</span>
            <Loading3QuartersOutlined className={css.spinIcon} />
          </>
        </div>
      </div> : null}
    </>
  )
}

