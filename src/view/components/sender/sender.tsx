import React, { useState } from "react"
import classNames from "classnames"
import { ArrowUpOutlined } from "@ant-design/icons"
import { context } from "../../../context"
import css from "./sender.less"

const Sender = () => {
  const [message, setMessage] = useState('');

  const send = () => {
    console.log("[send - focus]", context.currentFocus)
    console.log("[send - api]", context.api)
    context.rxai.requestAI({
      message,
      emits: {
        write: () => { },
        complete: () => { },
        error: () => { },
        cancel: () => { }
      },
      key: ""
    })
    setMessage("");
  }

  return (
    <div className={classNames(css.sender)}>
      <div className={classNames(css.content)}>
        <textarea
          className={classNames(css.textarea)}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (message) {
                send()
              }
            }
          }}
        />
        <button
          className={classNames(css.button)}
          disabled={!message}
          onClick={send}
        >
          <ArrowUpOutlined className={classNames(css.icon)} />
        </button>
      </div>
    </div>
  )
}

export { Sender }