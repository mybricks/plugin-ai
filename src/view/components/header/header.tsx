import React from "react"
import classNames from "classnames"
import { Delete, Export } from "../../../components/icons"
import { context } from "../../../context";
import css from "./header.less"

const Header = () => {
  const clear = () => {
    context.rxai.clear();
  }

  const exportRxai = () => {
    try {
      const content = context.rxai.export();
      console.log("[@mybricks/plugin-ai - exportRxai]", content);
      downloadToFile({
        content: context.rxai.export(),
        name: "rxai.json"
      })
    } catch (e) {

    }
  }

  return (
    <div className={classNames(css.header)}>
      <span className={classNames(css.title)}>
        MyBricks.ai
      </span>
      <div className={css['actions']}>
        <div className={css['action']} data-mybricks-tip={"清空对话记录"} onClick={clear}>
          <Delete />
        </div>
        <div className={classNames(css['action'], css['export'])} data-mybricks-tip={"导出对话记录"} onClick={exportRxai}>
          <Export />
        </div>
      </div>
    </div>
  )
}

export { Header }

function downloadToFile ({ content, name }: { content: any, name: string }) {
  const eleLink = document.createElement('a')
  eleLink.download = name
  eleLink.style.display = 'none'

  const blob = new Blob([JSON.stringify(content)])

  eleLink.href = URL.createObjectURL(blob)
  document.body.appendChild(eleLink)
  eleLink.click()
  document.body.removeChild(eleLink)
}
