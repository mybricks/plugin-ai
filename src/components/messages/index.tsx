import React, { useEffect } from "react"
import classNames from "classnames"
import css from "./index.less"

const Messages = () => {
  useEffect(() => {
    console.log("这里应该接收参数，消息列表等")
  }, [])
  return (
    <div className={css.messages}>消息列表</div>
  )
}

export { Messages }
