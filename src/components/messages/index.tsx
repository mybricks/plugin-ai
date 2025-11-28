import React, { useRef, useState, useEffect, useLayoutEffect } from "react"
import classNames from "classnames"
import { Rxai } from "@mybricks/rxai"
import markdownit from 'markdown-it'
import { Extension } from "../types";
import { Loading, Success, Close } from "../icons";
import { AttachmentsList } from "../attachments";
import { MentionTag } from "../mention";
import css from "./index.less"

const md = markdownit()

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

  const mainRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<Plans>([]);
  const [scrollSnap, setScrollSnap] = useState(true);

  useLayoutEffect(() => {
    destroysRef.current.push(rxai.events.on('plan', (plans) => {
      setPlans([...plans])
    }, true))
  }, [])

  useEffect(() => {
    const mutationObserver = new MutationObserver(function () {
      mainRef.current!.scrollTop = mainRef.current!.scrollHeight;
    });
    
    mutationObserver.observe(mainRef.current!, { childList: true });

    const intersectionObserver = new IntersectionObserver((entries) => {
      setScrollSnap(entries[0].intersectionRatio > 0)
    }, { root: mainRef.current })

    intersectionObserver.observe(anchorRef.current!);
  
    return () => {
      mutationObserver.disconnect();
      intersectionObserver.disconnect();

      for (const destroy of destroysRef.current) {
        destroy()
      }
    }
  }, [])

  return (
    <main ref={mainRef} className={css['ai-chat-messages']}>
      {plans.map((plan, index) => {
        return <Bubble key={index} user={user} plan={plan} copilot={copilot} />
      })}
      <div ref={anchorRef} className={classNames(css['anchor'], {
        [css['scroll-snap']]: scrollSnap
      })}/>
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
      {messages[0] && <BubbleUser user={user} message={messages[0]} plan={plan} />}
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
    messageRef.current!.innerHTML = md.render(message);
  }, [message])

  return <span ref={messageRef} />
}

interface BubbleUserParams {
  user: User;
  message: UserFriendlyMessages[number]
  plan: Plan;
}

const BubbleUser = (params: BubbleUserParams) => {
  const { user, message, plan } = params;
  const mentions = (plan.extension as Extension)?.mentions || [];
  const attachments = plan.attachments || [];

  return (
    <article className={css['chat-bubble']}>
      <header className={css['chat-bubble-header']}>
        <span className={css['chat-bubble-header-avatar']}>
          <img className={css['user-avatar']} src={user.avatar} />
        </span>
        <span className={css['chat-bubble-header-name']}>{user.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['user-message'])}>
        {mentions.length ? (
          <div className={css['mentions-container']}>
            {mentions.map((mention) => {
              return <MentionTag key={mention.id} mention={mention}/>
            })}
          </div>
        ) : null}
        <span>
          {typeof message.content === "string" ? message.content : message.content.find((content: any) => {
            if (content.type === "text") {
              return content
            }
          }).text}
        </span>
        {attachments.length ? (
          <AttachmentsList className={css['attachments-list']} attachments={attachments}/>
        ) : null}
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
        <div className={css['markdown-body']}>
          {messages.map((message, index) => {
            if (message.role === "tool") {
              return <BubbleCopilotTool key={index + message.status} message={message} />
            }
            if (message.role === "error") {
              return <BubbleError message={message} />
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

interface BubbleErrorParams {
  message: {
    role: "error",
    content: string,
    retry: () => void;
  }
}
const BubbleError = (params: BubbleErrorParams) => {
  const { message } = params;

  return (
    <div className={css['ai-chat-error-code-block']}>
      <div className={css['ai-chat-error-code-block-message']}>
        <span>{message.content}</span>
      </div>
      <div
        className={css['ai-chat-error-code-block-retry']}
        onClick={message.retry}
      >重试</div>
    </div>
  )
}

export { Messages }
