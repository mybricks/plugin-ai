// 项目未安装 @types/markdown-it，这里统一以 any 对接 markdown-it 的 token/state
type MarkdownItLike = any;
type Token = any;

export type AlertType = "note" | "tip" | "important" | "warning" | "caution";

const ALERT_TITLES: Record<AlertType, string> = {
  note: "说明",
  tip: "建议",
  important: "重点",
  warning: "注意",
  caution: "警告",
};

const ALERT_RE = /^\[!(note|tip|important|warning|caution)\]\s*(.*)$/i;

function matchAlertMarker(tokens: Token[], start: number) {
  const inline = tokens[start + 2];
  if (!tokens[start + 1] || tokens[start + 1].type !== "paragraph_open") return null;
  if (!inline || inline.type !== "inline") return null;

  const firstLine = inline.content.split("\n", 1)[0];
  const matched = ALERT_RE.exec(firstLine.trim());
  if (!matched) return null;

  return {
    type: matched[1].toLowerCase() as AlertType,
    customTitle: matched[2].trim(),
    inline,
    firstLineLength: firstLine.length,
  };
}

/**
 * 支持 GitHub Alerts 语法：
 *
 *   > [!NOTE]
 *   > 正文
 *
 * markdown-it 原生不认这个扩展，这里在 core 链路后置一条 rule，
 * 识别 blockquote 首段行首的 [!TYPE] 标记，剥掉标记文本、
 * 给 blockquote 打上 class，并注入一个标题节点。
 */
export function alertsPlugin(md: MarkdownItLike): void {
  md.core.ruler.push("mybricks_alerts", (state: any) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;

      const matched = matchAlertMarker(tokens, i);
      if (!matched) continue;

      const { type, customTitle, inline, firstLineLength } = matched;

      tokens[i].attrJoin("class", `md-alert md-alert-${type}`);

      // 剥掉 [!TYPE] 所在的首行，只保留正文
      const rest = inline.content.slice(firstLineLength).replace(/^\n/, "");
      inline.content = rest;
      inline.children = rest ? md.parseInline(rest, state.env)[0].children : [];

      // 正文为空时移除空段落，避免渲染出空行
      if (!rest) {
        tokens.splice(i + 1, 3);
      }

      const titleOpen = new state.Token("html_block", "", 0);
      titleOpen.content =
        `<div class="md-alert-title">${md.utils.escapeHtml(customTitle || ALERT_TITLES[type])}</div>`;
      tokens.splice(i + 1, 0, titleOpen);
    }

    return true;
  });
}
