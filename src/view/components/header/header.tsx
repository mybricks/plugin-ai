import React from "react"
import classNames from "classnames"
import css from "./header.less"

const Header = () => {
  return (
    <div className={classNames(css.header)}>
      <span className={classNames(css.title)}>
        MyBricks.ai
      </span>
    </div>
  )
}

export { Header }
