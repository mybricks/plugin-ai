import React from "react"
import classNames from "classnames";
import { Header, Messages, Sender } from "./components";
import css from "./index.less";

const View = () => {
  return (
    <div className={classNames(css.view)}>
      <Header />
      <Messages />
      <Sender />
    </div>
  )
}

export { View }