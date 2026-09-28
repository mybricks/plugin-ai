import React, { useEffect, useMemo, useRef } from "react";
import classNames from "classnames";
import markdownit from "markdown-it";
import css from "./index.less";
import reviewSkinCss from "../../markdown/skin-review.less";
import { alertsPlugin } from "../../markdown/alerts";
import { renderMermaidInContainer } from "../../markdown/mermaid";

const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
}).use(alertsPlugin);

export interface ReviewRenderProps {
  /** 完整的影响评估 Markdown，支持 YAML frontmatter。 */
  content: string;
  /** 额外的 className。 */
  className?: string;
  /** 额外的 style。 */
  style?: React.CSSProperties;
  /** 最大高度，超出时滚动，默认占满父容器。 */
  maxHeight?: number | string;
  /** 是否启用暗黑模式，会同步影响 Mermaid。 */
  darkMode?: boolean;
  /** 是否展示评估结果和更新时间，默认展示。 */
  showMeta?: boolean;
}

type ReviewDocument = {
  body: string;
  status?: string;
  updateTime?: string;
};

function parseReviewDocument(content: string): ReviewDocument {
  const frontmatter = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*(?:[\r\n]+|$)/);
  const updateTime = frontmatter?.[1]?.match(/^updateTime\s*[：:]\s*(.+)$/m)?.[1]?.trim();
  const rawBody = frontmatter ? content.slice(frontmatter[0].length) : content;
  const statusLine = rawBody.match(/^[ \t]*-[ \t]*\*{1,2}[ \t]*状态[ \t]*\*{0,2}[ \t]*[：:][ \t]*(.+?)[ \t]*\r?$/m);
  const status = statusLine?.[1]?.replace(/[*_`]/g, "").trim();

  return {
    body: (statusLine ? rawBody.replace(statusLine[0], "") : rawBody).trim(),
    status,
    updateTime,
  };
}

function getStatusTone(status: string): "pass" | "warning" | "critical" {
  if (status === "通过") return "pass";
  if (status === "严重问题") return "critical";
  return "warning";
}

/**
 * 影响评估文档阅读器。
 *
 * 与 PrdRender 共用 Markdown、Alert 和 Mermaid 能力；同时识别 REVIEW.md
 * 的 frontmatter、总体状态以及「影响范围」结构，避免业务侧重复实现解析逻辑。
 */
const ReviewRender = ({
  content = "",
  className,
  style,
  maxHeight,
  darkMode = false,
  showMeta = true,
}: ReviewRenderProps) => {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { body, status, updateTime } = useMemo(() => parseReviewDocument(content), [content]);

  useEffect(() => {
    if (!bodyRef.current) return;

    bodyRef.current.innerHTML = md.render(body);
    bodyRef.current.querySelectorAll("h1").forEach((heading) => heading.remove());
    bodyRef.current.querySelectorAll("h2").forEach((heading) => {
      if (heading.textContent?.trim() === "影响范围") heading.remove();
    });
    renderMermaidInContainer(bodyRef.current, { darkMode }).catch(() => {});
  }, [body, darkMode]);

  return (
    <section
      className={classNames(css["review-render"], className)}
      style={{
        ...(maxHeight ? { maxHeight } : {}),
        ...style,
      }}
    >
      {showMeta && (status || updateTime) && (
        <header className={css["review-render-meta"]}>
          {status && (
            <div className={css["review-render-result"]}>
              <span className={css["review-status-label"]}>评估结果</span>
              <span className={css["review-status-value"]} data-status={getStatusTone(status)}>
                <span className={css["review-status-dot"]} />
                {status}
              </span>
            </div>
          )}
          {updateTime && <time className={css["review-render-updated-at"]}>更新于 {updateTime}</time>}
        </header>
      )}
      <div className={css["review-render-scroll"]}>
        <article
          ref={bodyRef}
          className={classNames(reviewSkinCss["markdown-skin-review"], "markdown-body")}
        />
      </div>
    </section>
  );
};

export { ReviewRender };
