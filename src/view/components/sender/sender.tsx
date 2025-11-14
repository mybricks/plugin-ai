import React, { useState } from "react"
import classNames from "classnames"
import { ArrowUpOutlined } from "@ant-design/icons"
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
        />
        <button
          className={classNames(css.button)}
          disabled={!message}
          onClick={() => {
            console.log("按钮点击 获取message", message)
          }}
        >
          <ArrowUpOutlined className={classNames(css.icon)}/>
        </button>
      </div>
    </div>
  )
}

export { Sender }