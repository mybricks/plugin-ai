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
  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<Plans>([]);

  const [styleTag] = useState(() => {
    const styleTag = document.createElement('style')
    document.head.appendChild(styleTag)
    const prefix = `.${css['ai-chat-messages']} .${css['chat-bubble-container']}:nth-last-child(1)`;
    return {
      setStyle: (height: number) => {
        styleTag.innerHTML = `${prefix} {
          min-height: ${height - 1}px;
        }`
      },
      remove: () => {
        document.head.removeChild(styleTag);
      }
    };
  })

  useLayoutEffect(() => {
    destroysRef.current.push(rxai.events.on('plan', (plans) => {
      setPlans([...plans])
    }, true))

    styleTag.setStyle(mainRef.current!.clientHeight);
  }, [])

  useEffect(() => {
    const autoScroller = new AutoScroller(mainRef.current!, {
      resizeObserverCallback: () => {
        const height = mainRef.current?.clientHeight;
        if (height && height > 0) {
          styleTag.setStyle(height)
        }
      },
      mutationCallback: (mutations) => {
        const mutationRecord = mutations[0];

        if (mutationRecord.target === mainRef.current && mutationRecord.addedNodes.length) {
          mainRef.current!.scrollTop = mainRef.current!.scrollHeight;
        }
      }
    });
  
    return () => {
      autoScroller.destroy();

      for (const destroy of destroysRef.current) {
        destroy()
      }
    }
  }, [])

  return (
    <main ref={mainRef} className={css['ai-chat-messages']}>
      {plans.map((plan) => {
        return <Bubble key={plan.id} user={user} plan={plan} copilot={copilot} onMentionClick={onMentionClick}/>
      })}
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
    <div className={css['chat-bubble-container']}>
      <BubbleUser user={user} message={userMessage} plan={plan} onMentionClick={onMentionClick}/>
      <BubbleCopilot copilot={copilot} plan={plan}/>
    </div>
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
      plan.events.on('streamMessage2', (streamMessage) => {
        setStreamMessage(streamMessage);
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
            return <BubbleCopilotTool key={index + command.status} command={command} last={index === commands.length - 1}/>
          })}
          {error && <BubbleError message={error} plan={plan}/>}
          {summary && <BubbleMessage message={summary} />}
          {/* {streamMessage && <BubbleMessage message={streamMessage} />} */}
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
  last: boolean;
}
const BubbleCopilotTool = (params: BubbleCopilotToolParams) => {
  const { command, last } = params;
  const [message, setMessage] = useState("");
  const [expand, setExpand] = useState(false);

  useEffect(() => {
    if (command.status === "success") {
      setMessage(command.content.display || command.content.llm)
      if (last) {
        setExpand(true)
      }
    }
    const destory = command.events?.on("streamMessage", ({ message, status }) => {
      setMessage(message)
      if (status === "start") {
        setExpand(true)
      } else if (status === "complete") {
        if (!last) {
          setExpand(false)
        }
      }
    })

    return () => {
      destory?.();
    }
  }, [])

  return (
    <>
      <div
        className={classNames(css['ai-chat-collapsible-code-block'], css['collapsed'])}
        onClick={() => {
          if (command.status !== "pending") {
            setExpand((expand) => !expand);
          }
        }}
      >
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
      {message ? <div className={css['.ai-chat-collapsible-response']} style={{ display: expand ? "block" : "none" }}><BubbleMessage message={message} /></div> : null}
    </>
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

class AutoScroller {
  private isLockedToBottom: boolean = true;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  constructor(private container: HTMLElement, private options: { resizeObserverCallback: ResizeObserverCallback, mutationCallback: MutationCallback }) {
    this.isLockedToBottom = true;
    
    this.init();
  }
  
  init() {
    // 监听滚动事件
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    
    // 使用ResizeObserver监听内容大小变化
    this.resizeObserver = new ResizeObserver((entries, observer) => {
      if (this.isLockedToBottom) {
        this.scrollToBottom();
      }
      this.options.resizeObserverCallback(entries, observer);
    });
    
    // 监听容器内部元素大小变化
    this.resizeObserver.observe(this.container);
    
    // 同时监听DOM变化
    this.mutationObserver = new MutationObserver((mutations, observer) => {
      if (this.isLockedToBottom) {
        Promise.resolve().then(() => {
          this.scrollToBottom();
        });
      }
      this.options.mutationCallback(mutations, observer);
    });
    
    this.mutationObserver.observe(this.container, {
      childList: true,
      subtree: true,
    });
  }
  
  handleScroll() {
    const isAtBottom = this.isAtBottom();
    this.isLockedToBottom = isAtBottom;
  }
  
  isAtBottom(threshold = 5) {
    const { scrollTop, scrollHeight, clientHeight } = this.container;
    return Math.abs(scrollHeight - scrollTop - clientHeight) <= threshold;
  }
  
  scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }
  
  destroy() {
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.container.removeEventListener('scroll', this.handleScroll);
  }
}
