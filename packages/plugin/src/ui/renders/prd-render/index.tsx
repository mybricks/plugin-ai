import React, { useEffect, useRef } from "react";
import markdownit from "markdown-it";
import css from "./index.less";
import prdSkinCss from "../../markdown/skin-prd.less";
import { renderMermaidInContainer } from "../../markdown/mermaid";
import classNames from "classnames";

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
});

export interface PrdRenderProps {
  /** Markdown 字符串内容 */
  content: string;
  /** 额外的 className */
  className?: string;
  /** 额外的 style */
  style?: React.CSSProperties;
  /** 最大高度，超出时滚动，默认不限制 */
  maxHeight?: number | string;
  /** 是否显示标题栏 */
  showTitle?: boolean;
  /** 标题文字，showTitle 为 true 时生效 */
  title?: string;
  /** 是否启用暗黑模式 */
  darkMode?: boolean;
}

const PrdRender = ({
  content = "",
  className,
  style,
  maxHeight,
  showTitle = false,
  title = "需求文档",
  darkMode = false,
}: PrdRenderProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.innerHTML = md.render(content);
    renderMermaidInContainer(bodyRef.current, { darkMode }).catch(() => {});
  }, [content, darkMode]);

  return (
    <div
      className={classNames(css["prd-render"], className)}
      style={{
        ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
        ...style,
      }}
    >
      {showTitle && (
        <div className={css["prd-render-title"]}>{title}</div>
      )}
      <div
        ref={bodyRef}
        className={classNames(prdSkinCss["markdown-skin-prd"], "markdown-body")}
      />
    </div>
  );
};

export { PrdRender };
