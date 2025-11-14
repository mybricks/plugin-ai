import React, { useState } from "react"
import classNames from "classnames"
import { ArrowUpOutlined } from "@ant-design/icons"
import { context } from "../../../context"
import css from "./sender.less"

const Sender = () => {
  const [message, setMessage] = useState('');

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
            }
          }}
        />
        <button
          className={classNames(css.button)}
          disabled={!message}
          onClick={() => {
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
          }}
        >
          <ArrowUpOutlined className={classNames(css.icon)} />
        </button>
      </div>
    </div>
  )
}

export { Sender }