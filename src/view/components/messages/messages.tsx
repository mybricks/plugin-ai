import React, { useEffect, useLayoutEffect, useState } from "react"
import classNames from "classnames"
import { context } from "../../../context"
import css from "./messages.less"

const Messages = () => {
  const [plans, setPlans] = useState<ReturnType<typeof context.rxai.getMessages>>([]);

  useLayoutEffect(() => {
    console.log("注册")
    context.rxai.onPlanCallback((plans: any[]) => {
      // console.log("[plans]", plans);
      setPlans([...plans])
    })
  }, [])

  useEffect(() => {
    return () => {
      console.log("销毁")
      context.rxai.offPlanCallback()
    }
  }, [])

  return (
    <div className={classNames(css.messages)}>
      {plans.map((plan) => {
        return <Plan plan={plan} />
      })}
    </div>
  )
}

export { Messages }

const Plan = ({ plan }: { plan: ReturnType<typeof context.rxai.getMessages>[0] }) => {
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  useLayoutEffect(() => {
    plan.onLoadingCallback((loading: boolean) => {
      setLoading(loading);
    })
    plan.onMessageStreamCallBack((message: string) => {
      setMessage((pre) => {
        return pre + message;
      })
    })
    plan.onMessagesCallback((messages: any) => {
      setMessages(messages)
      setMessage("")
    })
  }, [])

  useEffect(() => {
    return () => {
      plan.offLoadingCallback()
      plan.offMessageStreamCallBack()
      plan.offMessagesCallback()
    }
  }, [])

  return (
    <>
      {messages.map((message: any) => {
        return (
          <div className={classNames(css.message, {
            [css.messgaeEnd]: message.role === "user",
          })}>
            <div className={classNames(css.bubble)}>
              {message.content}
            </div>
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
          {loading ? "..." : ""}
        </div>
      </div> : null}
    </>
  )
}

