import React from "react"
import classNames from "classnames";
import { Header, Sender } from "./components";
import { Messages } from "../components/messages";
import { context } from "../context";
import css from "./index.less";

const View = ({ user, copilot }: any) => {
  return (
    <div className={classNames(css.view)}>
      <Header />
      <Messages user={user} copilot={copilot} rxai={context.rxai}/>
      <Sender />
    </div>
  )
}

export { View }