import React, { useRef, useState, useEffect, useLayoutEffect } from "react"
import classNames from "classnames"
import { Rxai } from "@mybricks/rxai"
import { marked } from "marked";
import { Loading, Success, Close } from "../icons";
import css from "./index.less"

const renderer = new marked.Renderer();
renderer.paragraph = (paragraph) => {
  return `<p>${paragraph.text}</p>`;
};
marked.use({ renderer });

interface User {
  /** 名称 */
  name: string;
  /** 头像地址 */
  avatar: string;
}

interface MessagesParams {
  /** 用户信息 */
  user: User;
  /** ai助手信息 */
  copilot: User;

  rxai: Rxai;
}

type Plans = Rxai['cacheMessages'];

const Messages = (params: MessagesParams) => {
  const { user, rxai, copilot } = params;

  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<Plans>([]);

  useLayoutEffect(() => {
    destroysRef.current.push(rxai.events.on('plan', (plans) => {
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
    <main className={css['ai-chat-messages']}>
      {plans.map((plan, index) => {
        return <Bubble key={index} user={user} plan={plan} copilot={copilot} />
      })}
      <div className={css['anchor']} />
    </main>
  )
}

type Plan = Rxai['cacheMessages'][number];

type UserFriendlyMessages = Plan['userFriendlyMessages'];

interface BubbleParams {
  user: User;
  copilot: User;
  plan: Plan;
}
const Bubble = (params: BubbleParams) => {
  const { user, plan, copilot } = params;

  const [messages, setMessages] = useState<UserFriendlyMessages>([])
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)

  const destroysRef = useRef<(() => void)[]>([]);

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
      plan.events.on('userFriendlyMessages', (messages: UserFriendlyMessages) => {
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
      {messages[0] && <BubbleUser user={user} message={messages[0]} />}
      {messages[0] && <BubbleCopilot messages={messages.slice(1)} copilot={copilot} message={message} loading={loading} />}
    </>
  )
}

interface BubbleMessageParams {
  message: string;
}
const BubbleMessage = (params: BubbleMessageParams) => {
  const { message } = params;
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageRef.current!.innerHTML = marked.parse(message) as string;
  }, [message])

  return <span ref={messageRef} />
}

interface BubbleUserParams {
  user: User;
  message: UserFriendlyMessages[number]
}

const BubbleUser = (params: BubbleUserParams) => {
  const { user, message } = params;

  return (
    <article className={css['chat-bubble']}>
      <header className={css['chat-bubble-header']}>
        <span className={css['chat-bubble-header-avatar']}>
          <img className={css['user-avatar']} src={user.avatar} />
        </span>
        <span className={css['chat-bubble-header-name']}>{user.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['user-message'])}>
        <div className={css['ai-chat-markdown']}>
          <span>{typeof message.content === "string" ? message.content : message.content.find((content: any) => {
            if (content.type === "text") {
              return content
            }
          }).text}</span>
        </div>
      </section>
    </article>
  )
}

interface BubbleCopilotParams {
  copilot: User;
  messages: UserFriendlyMessages;
  message: string;
  loading: boolean;
}
const BubbleCopilot = (params: BubbleCopilotParams) => {
  const { messages, copilot, message, loading } = params;

  return (
    <article className={css['chat-bubble']}>
      <header className={css['chat-bubble-header']}>
        <span className={css['chat-bubble-header-avatar']}>
          <img className={css['copilot-avatar']} src={copilot.avatar} />
        </span>
        <span className={css['chat-bubble-header-name']}>{copilot.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['ai-message'])}>
        <div className={css['ai-chat-markdown']}>
          {messages.map((message, index) => {
            if (message.role === "tool") {
              return <BubbleCopilotTool key={index + message.status} message={message} />
            }
            return <BubbleMessage message={message.content} />
          })}
          {message && <BubbleMessage message={message} />}
          {!message && loading && (
            <div className={css['think']}>
              <span>正在思考</span>
              <Loading />
            </div>
          )}
        </div>
      </section>
    </article>
  )
}

interface BubbleCopilotToolParams {
  message: {
    type: "tool";
    status: "pending" | "success" | "error" | "aborted";
    content: {
      name: string;
      displayName: string;
    }
  }
}
const BubbleCopilotTool = (params: BubbleCopilotToolParams) => {
  const { message } = params;

  return (
    <div className={classNames(css['ai-chat-collapsible-code-block'], css['collapsed'])}>
      <span className={classNames(css['code-header'], css['collapsed'])}>
        <span className={classNames(css['code-title'], css['collapsed'])}>{message.content.displayName || message.content.name}</span>
        {message.status === "pending" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['pending'])}>
            <Loading />
          </span>
        )}
        {message.status === "success" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['success'])}>
            <Success />
          </span>
        )}
        {message.status === "error" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['error'])}>
            <Close />
          </span>
        )}
        {message.status === "aborted" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['aborted'])}>
            取消
          </span>
        )}
      </span>
    </div>
  )
}

export { Messages }
