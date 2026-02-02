import React from "react"
import classNames from "classnames"
import { Rxai } from "@mybricks/rxai";
import { Delete, Export } from "../../../components/icons"
import { context } from "../../../context";
import css from "./header.less"

interface HeaderParams {
  rxai: Rxai;
}

const Header = (params: HeaderParams) => {
  const clear = () => {
    params.rxai.clear();
  }

  const exportRxai = async () => {
    try {
      const content = await context.rxai.export();
      console.log("[@mybricks/plugin-ai - exportRxai]", content);
      downloadToFile({
        content: content,
        name: `rxai-${new Date().getTime()}.json`
      })
    } catch (e) {
      console.error("[@mybricks/plugin-ai - exportRxai - error]", e);
    }
  }

  return (
    <div className={classNames(css.header)}>
      <span className={classNames(css.title)}>
        {/* MyBricks.ai */}
        智能助手
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
