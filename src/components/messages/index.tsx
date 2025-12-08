import React, { useRef, useState, useEffect, useLayoutEffect } from "react"
import classNames from "classnames"
import { Rxai } from "@mybricks/rxai"
import markdownit from 'markdown-it'
import { Extension } from "../types";
import { Loading, Success } from "../icons";
import { AttachmentsList } from "../attachments";
import { MentionTag } from "../mention";
import { Mention } from "../types";
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

  onMentionClick?: (mention: Mention) => void;
}

type Plans = Rxai['cacheMessages'];

const Messages = (params: MessagesParams) => {
  const { user, rxai, copilot, onMentionClick } = params;

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
        return <Bubble key={index} user={user} plan={plan} copilot={copilot} onMentionClick={onMentionClick}/>
      })}
      <div ref={anchorRef} className={classNames(css['anchor'], {
        [css['scroll-snap']]: scrollSnap
      })}/>
    </main>
  )
}

type Plan = Rxai['cacheMessages'][number];

interface BubbleParams {
  user: User;
  copilot: User;
  plan: Plan;
  onMentionClick?: (mention: Mention) => void;
}
const Bubble = (params: BubbleParams) => {
  const { user, plan, copilot, onMentionClick } = params;
  const [userMessage, setUserMessage] = useState<ReturnType<Plan['getUserMessage']>>();
  const destroysRef = useRef<(() => void)[]>([]);

  useLayoutEffect(() => {
    destroysRef.current.push(
      plan.events.on('userMessage', (userMessage) => {
        setUserMessage(userMessage);
      }),
    )
  }, [])

  useEffect(() => {
    return () => {
      for (const destroy of destroysRef.current) {
        destroy()
      }
    }
  }, [])

  return userMessage && (
    <>
      <BubbleUser user={user} message={userMessage} plan={plan} onMentionClick={onMentionClick}/>
      <BubbleCopilot copilot={copilot} plan={plan}/>
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
  message: ReturnType<Plan['getUserMessage']>
  plan: Plan;
  onMentionClick?: (mention: Mention) => void;
}

const BubbleUser = (params: BubbleUserParams) => {
  const { user, message, plan, onMentionClick } = params;
  const mentions = (plan.extension as Extension)?.mentions || [];
  let content = "";
  let attachments: Plan["options"]["attachments"] = [];

  if (typeof message.content === "string") {
    content = message.content
  } else {
    message.content.forEach((item: any) => {
      if (item.type === "text") {
        content = item.text
      } else if (item.type === "image_url") {
        attachments.push({
          type: "image",
          content: item.image_url.url
        });
      }
    })
  }

  return (
    <article className={css['chat-bubble']}>
      <header className={css['chat-bubble-header']}>
        <span className={css['chat-bubble-header-avatar']}>
          <img className={css['user-avatar']} src={user.avatar} />
        </span>
        <span className={css['chat-bubble-header-name']}>{user.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['user-message'], {
        [css['mention']]: mentions.length
      })}>
        {mentions.length ? (
          <MentionTag mention={mentions[0]} onClick={onMentionClick}/>
        ) : null}
        <span>
          {content}
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
  plan: Plan;
}
const BubbleCopilot = (params: BubbleCopilotParams) => {
  const { copilot, plan } = params;
  const destroysRef = useRef<(() => void)[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamMessage, setStreamMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [commands, setCommands] = useState<Plan['commands']>([]);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    destroysRef.current.push(
      plan.events.on('loading', (loading) => {
        setLoading(loading);
      }),
      plan.events.on('streamMessage', (chunk) => {
        setStreamMessage((streamMessage) => {
          return streamMessage + chunk
        });
      }),
      plan.events.on('summary', (summary) => {
        setSummary(summary);
      }),
      plan.events.on('commands', (commands) => {
        setCommands([...commands]);
        setStreamMessage("");
      }),
      plan.events.on('error', (error) => {
        setError(error);
      }),
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
    <article className={css['chat-bubble']}>
      <header className={css['chat-bubble-header']}>
        <span className={css['chat-bubble-header-avatar']}>
          <img className={css['copilot-avatar']} src={copilot.avatar} />
        </span>
        <span className={css['chat-bubble-header-name']}>{copilot.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['ai-message'])}>
        <div className={css['markdown-body']}>
          {commands.map((command, index) => {
            if (!command.status || command.status === "error") {
              return null;
            }
            return <BubbleCopilotTool key={index + command.status} command={command} />
          })}
          {error && <BubbleError message={error} plan={plan}/>}
          {summary && <BubbleMessage message={summary} />}
          {streamMessage && <BubbleMessage message={streamMessage} />}
          {!streamMessage && loading && (
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
  command: Plan['commands'][number];
}
const BubbleCopilotTool = (params: BubbleCopilotToolParams) => {
  const { command } = params;

  return (
    <div className={classNames(css['ai-chat-collapsible-code-block'], css['collapsed'])}>
      <span className={classNames(css['code-header'], css['collapsed'])}>
        <span className={classNames(css['code-title'], css['collapsed'])}>{command.tool.displayName || command.tool.name}</span>
        {command.status === "pending" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['pending'])}>
            <Loading />
          </span>
        )}
         {command.status === "success" && (
          <span className={classNames(css['code-title-status'], css['collapsed'], css['success'])}>
            <Success />
          </span>
        )}
      </span>
    </div>
  )
}

interface BubbleErrorParams {
  message: string;
  plan: Plan;
}
const BubbleError = (params: BubbleErrorParams) => {
  const { message, plan } = params;

  return (
    <div className={css['ai-chat-error-code-block']}>
      <div className={css['ai-chat-error-code-block-message']}>
        <span>{message}</span>
      </div>
      {!plan.enableRetry ? null : (
        <div
          className={css['ai-chat-error-code-block-retry']}
          onClick={() => plan.retry()}
        >重试</div>
      )}
    </div>
  )
}

export { Messages }
