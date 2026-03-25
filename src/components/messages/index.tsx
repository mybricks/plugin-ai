import React, { useRef, useState, useEffect, useLayoutEffect } from "react"
import classNames from "classnames"
import { Rxai } from "@mybricks/rxai"
import markdownit from 'markdown-it'
import { Extension } from "../types";
import { Loading, Success, Chat } from "../icons";
import { AttachmentsList } from "../attachments";
import { MentionTag } from "../mention";
import { Mention } from "../types";
import { Sender, SenderRef, SenderProps } from "../sender";
import { context } from "../../context";
import { formatTime } from "../../utils";
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

  onSend?: SenderProps['onSend'];
}

type Plans = Rxai['cacheMessages'];

const Messages = (params: MessagesParams) => {
  const { user, rxai, copilot, onSend, onMentionClick } = params;

  const mainRef = useRef<HTMLElement>(null);
  const destroysRef = useRef<(() => void)[]>([]);
  const [plans, setPlans] = useState<Plans>([]);

  const setLastBubbleMinHeight = (height: number) => {
    const all = mainRef.current?.querySelectorAll(
      `.${css['chat-bubble-container']}`
    ) as NodeListOf<HTMLElement> | undefined;
    if (all) {
      all.forEach((el, i) => {
        if (i < all.length - 1) {
          el.style.minHeight = '';
        }
      });
    }

    const last = mainRef.current?.querySelector(
      `.${css['chat-bubble-container']}:last-child`
    ) as HTMLElement | null;
    if (last) {
      last.style.minHeight = `${height - 1}px`;
    }
  };

  useLayoutEffect(() => {
    destroysRef.current.push(rxai.events.on('plan', (plans) => {
      setPlans([...plans])
    }, true))

    setLastBubbleMinHeight(mainRef.current!.clientHeight);
  }, [])

  useEffect(() => {
    const autoScroller = new AutoScroller(mainRef.current!, {
      resizeObserverCallback: () => {
        const height = mainRef.current?.clientHeight;
        if (height && height > 0) {
          setLastBubbleMinHeight(height)
        }
      },
      mutationCallback: (mutations) => {
        const mutationRecord = mutations[0];

        if (mutationRecord.target === mainRef.current && mutationRecord.addedNodes.length) {
          mainRef.current!.scrollTop = mainRef.current!.scrollHeight;
          // 新的 .chat-bubble-container 刚插入 DOM，此时 last-child 才是正确的新节点
          // 必须在这里重新计算，避免 ResizeObserver 在新气泡 DOM 出现前就触发导致 last-child 指向错误
          const height = mainRef.current?.clientHeight;
          if (height && height > 0) {
            setLastBubbleMinHeight(height);
          }
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
      {plans.map((plan, index) => {
        return (
          <Bubble
            key={plan.id}
            user={user}
            plan={plan}
            copilot={copilot}
            onSend={onSend}
            onMentionClick={onMentionClick}
          />
        )
      })}
    </main>
  )
}

type Plan = Rxai['cacheMessages'][number];

interface BubbleParams {
  user: User;
  copilot: User;
  plan: Plan;
  onSend?: SenderProps['onSend'];
  onMentionClick?: (mention: Mention) => void;
}
const Bubble = (params: BubbleParams) => {
  const { user, plan, copilot, onSend, onMentionClick } = params;
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
      <BubbleAction plan={plan} onSend={onSend}/>
    </div>
  )
}

const BubbleAction = (props: { plan: Plan, onSend?: SenderProps['onSend']; }) => {
  const { plan, onSend } = props;

  const destroysRef = useRef<(() => void)[]>([]);
  const [status, setStatus] = useState<Plan['status']>();
  const [showRender, setShowRender] = useState(false);
  const senderRef = useRef<SenderRef>(null);

  useLayoutEffect(() => {
    destroysRef.current.push(
      plan.events.on('status', (status) => {
        setStatus(status)
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
    if (showRender) {
      senderRef.current!.setMentions((plan.extension as any).mentions || []);
      senderRef.current!.focus();
    }
  }, [showRender])

  return (
    <>
      <div className={css['chat-bubble-action']}>
        {/* TODO 兼容处理，没有pageId，不允许追加 */}
        {status !== "pending" && onSend && (plan?.extension as any)?.mentions?.[0]?.pageId &&  <div
          className={classNames(css['chat-bubble-action-chat'], {
            [css['focus']]: showRender
          })}
          data-mybricks-tip={"基于本次回答继续对话"}
          onClick={() => {
            setShowRender(!showRender);
          }}
        >
          <Chat />
        </div>}
      </div>
      {showRender && (
        <Sender
          ref={senderRef}
          placeholder={`您好，我是${context.name}，请详细描述您的需求`}
          onSend={(params) => {
            onSend!({...params, insertAfter: plan});
            setShowRender(false);
          }}
        />
      )}
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
      <div className={css['chat-bubble-time']}>{formatTime(plan.startTime)}</div>
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
          <MentionTag mention={mentions[0]} focusarea={true} onClick={onMentionClick}/>
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
  const [planningMessage, setPlanningMessage] = useState("");

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
      plan.events.on('planningMessage', (planningMessage) => {
        setPlanningMessage(planningMessage);
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
        {/* <span className={css['chat-bubble-header-avatar']}>
          <img className={css['copilot-avatar']} src={copilot.avatar} />
        </span> */}
        <span className={css['chat-bubble-header-name']}>{copilot.name}</span>
      </header>
      <section className={classNames(css['chat-message-container'], css['ai-message'])}>
        <div className={css['markdown-body']}>
          <div className={css['think']}>
            {planningMessage ? <BubbleMessage message={`${planningMessage}${loading ? "..." : ""}`} /> : (loading ? <span>正在思考</span> : null)}
            {loading && !planningMessage && <Loading />}
          </div>
          {commands.map((command, index) => {
            if ((command as any).type === 'continue') {
              if (!command.status) return null;
              return <BubbleContinueTool key={`continue-${index}`} command={command as any} />;
            }
            if (!command.status || command.status === "error") {
              return null;
            }
            return <BubbleCopilotTool key={index + command.status} command={command} last={index === commands.length - 1}/>
          })}
          {error && <BubbleError message={error} plan={plan}/>}
          {summary && <BubbleMessage message={summary} />}
          {/* {streamMessage && <BubbleMessage message={streamMessage} />} */}
          {/* {!streamMessage && loading && (
            <div className={css['think']}>
              <span>正在思考</span>
              <Loading />
            </div>
          )} */}
        </div>
      </section>
    </article>
  )
}

type ContinueCommand = {
  type: 'continue';
  status: 'pending' | 'success' | 'error' | 'aborted' | null;
  startTime: number;
  endTime: number;
  content: { display: string; llm: string; response: string };
  tool: { name: string; displayName: string };
};

const BubbleContinueTool = ({ command }: { command: ContinueCommand }) => {
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (command.status !== 'pending' || !command.startTime) return;
    setElapsed(Date.now() - command.startTime);
    const timer = setInterval(() => {
      setElapsed(Date.now() - command.startTime);
    }, 100);
    return () => clearInterval(timer);
  }, [command.status, command.startTime]);

  const formatDuration = (ms: number): string => {
    const s = ms / 1000;
    return s >= 60 ? (s / 60).toFixed(1) + 'm' : Math.floor(s) + 's';
  };

  const rawMs = command.endTime > 0 ? command.endTime - command.startTime : elapsed;
  const duration: string | null =
    command.startTime > 0 && rawMs > 0 && !isNaN(rawMs)
      ? formatDuration(rawMs)
      : null;

  const isPending = command.status === 'pending';
  const title = command.tool?.displayName || command.tool?.name || '总结';
  const displayText = command.content?.display;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 }}>
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {duration && <span style={{ fontSize: 11, opacity: 0.7 }}>{duration}</span>}
          {isPending && (
            <span className={classNames(css['code-title-status'], css['pending'])}>
              <Loading />
            </span>
          )}
        </span>
      </div>
      {displayText && (
        <div className={css['ai-chat-collapsible-response']}>
          <BubbleMessage message={displayText} />
        </div>
      )}
    </div>
  );
};

interface BubbleCopilotToolParams {
  command: Plan['commands'][number];
  last: boolean;
}
const BubbleCopilotTool = (params: BubbleCopilotToolParams) => {
  const { command, last } = params;
  const [message, setMessage] = useState("");
  const [expand, setExpand] = useState(false);

  const retriesCount: number = (command as any).retries?.length ?? 0;
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (command.status !== 'pending' || !command.startTime) return;
    setElapsed(Date.now() - command.startTime);
    const timer = setInterval(() => {
      setElapsed(Date.now() - command.startTime);
    }, 100);
    return () => clearInterval(timer);
  }, [command.status, command.startTime]);

  const formatDuration = (ms: number): string => {
    const s = ms / 1000;
    return s >= 60 ? (s / 60).toFixed(1) + 'm' : Math.floor(s) + 's';
  };

  const rawMs = command.endTime > 0 && command.startTime > 0
    ? command.endTime - command.startTime
    : command.status === 'pending' && command.startTime > 0
      ? elapsed
      : -1;
  const duration: string | null = rawMs > 0 && !isNaN(rawMs) ? formatDuration(rawMs) : null;

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

  const renderMessage = (shouldRender: boolean) =>
    shouldRender && message ? (
      <div
        className={css['ai-chat-collapsible-response']}
        style={{ display: expand ? "block" : "none" }}
      >
        <BubbleMessage message={message} />
      </div>
    ) : null;

  return (
    <>
      {renderMessage(command.status === "pending")}
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {retriesCount > 0 && (
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                第{retriesCount}次重试
              </span>
            )}
            {duration && (
              <span style={{ fontSize: 11, opacity: 0.7 }}>{duration}</span>
            )}
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
        </span>
      </div>
      {renderMessage(command.status === "success")}
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
