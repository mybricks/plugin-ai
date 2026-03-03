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
      const content = await params.rxai.export();
      const name = `rxai-${new Date().getTime()}.json`;
      await context.pluginParams.onDownload({ name, content: JSON.stringify(content) });
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
        <div className={classNames(css['action'], css['export'])} data-mybricks-tip={"导出对话记录"} onClick={exportRxai}>
          <Export />
        </div>
        <div className={css['action']} data-mybricks-tip={"清空对话记录"} onClick={clear}>
          <Delete />
        </div>
      </div>
    </div>
  )
}

export { Header }
