import React from "react"
import classNames from "classnames"
import css from "./messages.less"

const messages = [
  {
    role: "user",
    content: "经过我动手动脚啊丽江大理圣诞节撒辣椒的撒搭建拉萨的撒的撒的撒的撒打算大撒的空间撒老大收到啦收到啦，1 + 1 等于几"
  },
  {
    role: "assistant",
    content: "经过我动手动脚啊丽江大理圣诞节撒辣椒的撒搭建拉萨的撒的撒的撒的撒打算大撒的空间撒老大收到啦收到啦，等于2"
  }
]

for (let i = 0; i < 4; i++) {
  messages.push(...messages)
}

const Messages = () => {
  return (
    <div className={classNames(css.messages)}>
      {messages.map((message) => {
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
    </div>
  )
}

export { Messages }