import React from "react"
import classNames from "classnames"
import { PlusOutlined, CommentOutlined } from "@ant-design/icons"
import css from "./header.less"

const Header = () => {
  return (
    <div className={classNames(css.header)}>
      <span className={classNames(css.title)}>
        MyBricks.ai
      </span>
      <div className={classNames(css.tools)}>
        <PlusOutlined className={classNames(css.icon)}/>
        <CommentOutlined className={classNames(css.icon)}/>
      </div>
    </div>
  )
}

export { Header }
