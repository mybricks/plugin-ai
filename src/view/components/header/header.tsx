import React from "react"
import classNames from "classnames"
import { Delete } from "../../../components/icons"
import { context } from "../../../context";
import css from "./header.less"

const Header = () => {
  const clear = () => {
    context.rxai.clear();
  }

  return (
    <div className={classNames(css.header)}>
      <span className={classNames(css.title)}>
        MyBricks.ai
      </span>
      <div className={css['actions']}>
        <div className={css['action']} data-mybricks-tip={"清空对话列表"} onClick={clear}>
          <Delete />
        </div>
      </div>
    </div>
  )
}

export { Header }
