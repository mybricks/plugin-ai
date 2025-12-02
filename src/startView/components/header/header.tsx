import React from "react"
import classNames from "classnames"
import css from "./header.less"

const Header = () => {
  return (
    <div className={classNames(css.header)}>
      <img src="https://my.mybricks.world/image/icon.png"/>
      MyBricks.ai
    </div>
  )
}

export { Header }
