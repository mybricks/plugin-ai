import React, { useEffect, useRef } from "react";
import markdownit from "markdown-it";
import css from "./prdRender.less";
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
}

const PrdRender = ({
  content = "",
  className,
  style,
  maxHeight,
  showTitle = false,
  title = "需求文档",
}: PrdRenderProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.innerHTML = md.render(content);

    const mermaid = (window as any).mermaid;
    if (!mermaid) return;

    const codeBlocks = bodyRef.current.querySelectorAll<HTMLElement>("code.language-mermaid");
    if (!codeBlocks.length) return;

    mermaid.initialize({ startOnLoad: false, theme: "default" });

    codeBlocks.forEach(async (codeEl, index) => {
      const graphDefinition = codeEl.textContent || "";
      const pre = codeEl.parentElement;
      if (!pre) return;

      try {
        const id = `mermaid-diagram-${Date.now()}-${index}`;
        const { svg } = await mermaid.render(id, graphDefinition);
        const container = document.createElement("div");
        container.className = "mermaid-diagram";
        container.innerHTML = svg;
        pre.replaceWith(container);
      } catch (e) {
        // keep original code block on error
      }
    });
  }, [content]);

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
        className={classNames(css["prd-render-body"], "markdown-body")}
      />
    </div>
  );
};

export { PrdRender };
