import React, { useEffect, useRef } from "react";
import markdownit from "markdown-it";
import css from "./index.less";
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

    const mermaid = (window as any).mermaid;
    if (!mermaid) return;

    const codeBlocks = bodyRef.current.querySelectorAll<HTMLElement>("code.language-mermaid");
    if (!codeBlocks.length) return;

    mermaid.initialize({ 
      startOnLoad: false, 
      theme: "base",
      themeVariables: darkMode ? {
        primaryColor: '#1f1f1f',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#e0e0e0',
        lineColor: '#e0e0e0',
        secondaryColor: '#2a2a2a',
        tertiaryColor: '#2a2a2a',
        edgeLabelBackground: '#1f1f1f',
        textColor: '#e0e0e0',
        mainBkg: '#1a1a1a',
        nodeBorder: '#e0e0e0',
        clusterBkg: '#2a2a2a',
        clusterBorder: '#e0e0e0',
      } : {
        primaryColor: '#f6f8fa',
        primaryTextColor: '#333',
        primaryBorderColor: '#333',
        lineColor: '#333',
        secondaryColor: '#f6f8fa',
        tertiaryColor: '#f6f8fa',
        edgeLabelBackground: '#f6f8fa',
        textColor: '#333',
        mainBkg: '#fff',
        nodeBorder: '#333',
        clusterBkg: '#f6f8fa',
        clusterBorder: '#333',
      }
    });

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
