import React from "react";
import type MarkdownIt from "markdown-it";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTurn } from "../lib/fixtures";

const baseTime = Date.now() - 14 * 60 * 1000;

function configurePlaygroundFootnoteMarkdown(md: MarkdownIt) {
  md.core.ruler.after("inline", "pg_collect_alert_footnotes", (state) => {
    const footnotes: Record<string, string> = {};
    const tokens = state.tokens;

    for (let idx = 0; idx < tokens.length - 2; idx += 1) {
      const openToken = tokens[idx];
      const inlineToken = tokens[idx + 1];
      const closeToken = tokens[idx + 2];

      if (openToken.type !== "paragraph_open" || inlineToken.type !== "inline" || closeToken.type !== "paragraph_close") {
        continue;
      }

      const match = inlineToken.content.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
      if (!match) continue;

      footnotes[match[1]!] = match[2]!.trim();
      openToken.hidden = true;
      inlineToken.hidden = true;
      closeToken.hidden = true;
      inlineToken.children = [];
    }

    state.env.pgAlertFootnotes = {
      ...(state.env.pgAlertFootnotes ?? {}),
      ...footnotes,
    };
  });

  md.inline.ruler.before("emphasis", "pg_alert_footnote", (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x5b /* [ */ || state.src.charCodeAt(start + 1) !== 0x5e /* ^ */) {
      return false;
    }

    const end = state.src.indexOf("]", start + 2);
    if (end === -1) return false;

    const label = state.src.slice(start + 2, end).trim();
    if (!label) return false;

    if (!silent) {
      const token = state.push("pg_alert_footnote", "", 0);
      token.content = label;
      token.meta = { label };
    }

    state.pos = end + 1;
    return true;
  });

  md.renderer.rules.pg_alert_footnote = (tokens, idx, _options, env) => {
    const token = tokens[idx];
    const label = String(token.meta?.label ?? token.content);
    const detail = env.pgAlertFootnotes?.[label] ?? `未找到脚注定义：[^${label}]`;
    const safeLabel = md.utils.escapeHtml(label);
    const safeDetail = md.utils.escapeHtml(detail);
    return `<sup class="pg-alert-footnote" role="button" tabindex="0" title="点击查看脚注" data-footnote-detail="${safeDetail}" onclick="alert(this.getAttribute('data-footnote-detail'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();alert(this.getAttribute('data-footnote-detail'))}">${safeLabel}</sup>`;
  };
}

const RICH_MARKDOWN = `我把 ChatPanel 的 **large 模式 + 自定义变量** 检查点整理成一份完整预览，方便你直接看右侧 UI。

## 覆盖范围

- **消息基础结构**：用户气泡、AI 文本、时间、头像和消息组间距。
- **工具调用样式**：历史记录里包含 \`read_file\`、\`use_skill\` 和 \`bash mv\`，用于检查 \`messagesRenderVariant="line"\` 的行式工具展示。
- **Markdown 富文本**：包含标题、列表、表格、引用、代码块和链接。
- **large 模式**：通过 \`size="large"\` 放大字号、间距、Sender 和工具卡密度。
- **自定义变量注入**：不新增内部变量，只从 \`ChatPanel\` 根节点注入现有 \`--mybricks-*\`。
- **外部 Markdown 扩展**：这里有一个脚注引用[^skin-note]，会渲染成右上角标记，点击后展示脚注定义里的详细信息。

[^skin-note]: 这条信息来自 Markdown 正文中的脚注定义，playground 通过注入 markdown-it rule 读取 \`[^skin-note]\` 和 \`[^skin-note]: ...\`，并只作用于 ChatPanel messages。

## 检查顺序

1. 先看用户气泡和 Sender 是否继承主背景、边框和主色。
2. 再看工具卡片是否继承淡灰蓝的卡片底色。
3. 最后看代码块、表格和引用块在窄宽度下是否仍然稳定。

## 嵌套列表示例

- 一级项 A
    - 二级项 A-1
    - 二级项 A-2
        - 三级项 A-2-a
        - 三级项 A-2-b
- 一级项 B
    - 二级项 B-1

1. 第一步：确认变量生效
    1. 检查主色是否为蓝色
    2. 检查背景是否为白色
2. 第二步：验证 Markdown 渲染
    - 标题层级正确
    - 列表缩进正确
3. 第三步：提交代码

## 配置示例

| 配置 | 用途 | Demo 值 |
| --- | --- | --- |
| \`size\` | 尺寸模式 | \`large\` |
| \`--mybricks-color-primary\` | 链接、hover、主操作 | \`#2563eb\` |
| \`--mybricks-bg-color-main\` | 主背景、用户气泡 | \`#ffffff\` |
| \`--mybricks-bg-color-secondary\` | 工具卡、代码块 | \`#FFF\` |
| \`--mybricks-border-color-main\` | 气泡和卡片边框 | \`#D9D9D9\` |

## 链接示例

访问 [Mybricks 官网](https://mybricks.world) 了解更多，或者查看 [GitHub 仓库](https://github.com/mybricks/plugin-ai) 获取源码。也可以直接打开 [本地 playground](http://localhost:3100) 调试。

## 引用示例

> 这里故意只演示外层变量覆盖。内部依旧是 CSS Modules，结构样式不从外部穿透。

> 当你在一个地方做好了设计，就要在多个地方复用它。这正是抽象的意义所在。

## 行内格式

文本中可以有 **粗体**、*斜体*、~~删除线~~、\`inline code\` 以及 **粗体加 \`code\`** 的组合。

## 分割线

---

## 流程图示例

\`\`\`mermaid
flowchart TD
    A[用户输入] --> B{是否有 agent?}
    B -- 是 --> C[发送请求]
    B -- 否 --> D[禁用状态]
    C --> E[LLM 响应]
    E --> F{是否需要工具?}
    F -- 是 --> G[执行工具调用]
    G --> E
    F -- 否 --> H[输出消息]
\`\`\`

## 代码块示例

\`\`\`tsx
<ChatPanel
  agent={agent}
  header={false}
  size="large"
  messagesRenderVariant="line"
  className="pg-chat-panel-skin"
  style={{
    "--mybricks-color-primary": "#2563eb",
    "--mybricks-bg-color-main": "#ffffff",
    "--mybricks-bg-color-secondary": "#F5F5F5",
    "--mybricks-border-color-main": "#D9D9D9",
  } as React.CSSProperties}
  markdownSkin={{
    message: specialSkin["pg-markdown-skin-special"],
  }}
/>
\`\`\`

\`\`\`json
{
  "name": "plugin-ai",
  "version": "2.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "markdown-it": "^14.0.0"
  }
}
\`\`\`

最后放一段较长正文来观察换行：如果这里没有和耗时文本挤在一起，表格可以横向滚动，代码块不会撑破右侧面板，那这个 large + 自定义变量案例就能覆盖主要消息 UI 风险。`;


export const chatPanelSkinHistoryCase: TestCase = {
  id: "chat-panel-skin-history",
  name: "ChatPanel 皮肤：large + 自定义变量",
  group: "特殊皮肤",
  priority: "P1",
  description: "专门预览 ChatPanel 右侧 UI：header=false、size=large、自定义 CSS 变量、历史工具调用和丰富 Markdown。",
  expectedBehavior: "主区域不显示 Request Inspector / MemFS，右侧只展示 large 模式 + 自定义变量的 ChatPanel，read、use_skill 和 bash/mv 工具使用 line 模式渲染。",
  playgroundLayout: "chat-panel-skin",
  chatPanelSkin: "custom",
  messagesRenderVariant: "line",
  markdownit: {
    configure: configurePlaygroundFootnoteMarkdown,
  },
  scrollWithSender: true,
  renderSenderFooter: () => (
    <div className="pg-chat-skin-sender-footer">
      AI 生成的内容可能不准确，请结合上下文谨慎确认后再使用。
    </div>
  ),
  initialTurns: [
    makeTurn({
      userText: "帮我看一下 messages 这块换皮肤时应该重点检查什么？",
      startTime: baseTime,
      endTime: baseTime + 5200,
      iterations: [
        {
          content: "我先读取消息和工具渲染相关样式，确认当前可以通过外层变量覆盖哪些视觉点。",
          toolCalls: [
            {
              name: "read_file",
              args: {
                path: "packages/plugin/src/ui/chat/messages/index.less",
                startLine: 1,
                endLine: 180,
              },
              result: ".message-list { font-size: var(--chat-font-size, 12px); }\n.user-message { background: var(--chat-user-message-bg, var(--mybricks-bg-color-main, #FFF)); }",
              durationMs: 360,
            },
            {
              name: "read_file",
              args: {
                path: "packages/plugin/src/ui/chat/messages/tool-renders/render.less",
                startLine: 1,
                endLine: 90,
              },
              result: ".tool-card { background: var(--mybricks-bg-color-secondary, #F5F5F5); }",
              durationMs: 410,
            },
            {
              name: "use_skill",
              args: {
                skill: "chat-panel-skin-review",
              },
              result: "<skill name=\"chat-panel-skin-review\">\n# ChatPanel Skin Review\n\n检查 line 模式工具展示、Markdown 皮肤和外部 CSS 变量注入是否一致。\n</skill>",
              durationMs: 330,
            },
          ],
        },
        {
          content: RICH_MARKDOWN,
          toolCalls: [
            {
              name: "bash",
              args: {
                command: "mv packages/playground/src/old-chat-panel-skin.tsx packages/playground/src/chat-panel-skin.tsx",
                description: "移动皮肤预览文件",
              },
              result: "renamed packages/playground/src/old-chat-panel-skin.tsx -> packages/playground/src/chat-panel-skin.tsx",
              durationMs: 520,
            },
            {
              name: "multi_edit",
              args: {
                edits: [
                  {
                    path: "packages/plugin/src/ui/chat/messages/index.less",
                    old_str: ".user-message {\n  background: var(--mybricks-bg-color-main, #FFF);\n  border: 1px solid var(--mybricks-border-color-main, #E6E6E6);\n}",
                    new_str: ".user-message {\n  background: var(--chat-user-message-bg, var(--mybricks-bg-color-main, #FFF));\n  border: 1px solid var(--chat-user-message-border-color, var(--mybricks-border-color-main, #E6E6E6));\n}",
                  },
                  {
                    path: "packages/plugin/src/ui/components/sender/index.less",
                    old_str: ".editor {\n  border-radius: 12px;\n  border: solid 1px var(--mybricks-border-color-main, #E6E6E6);\n}",
                    new_str: ".editor {\n  border-radius: var(--chat-sender-border-radius, 12px);\n  border: solid 1px var(--mybricks-border-color-main, #E6E6E6);\n}",
                  },
                ],
              },
              result: "Applied 2 edits",
              durationMs: 640,
            },
            {
              name: "check-status",
              args: {},
              result: "ChatPanel skin preview rendered. Header is hidden, variables are inherited, no inspector or MemFS is shown in this layout.",
              durationMs: 690,
            },
            {
              name: "inspect_theme_tokens",
              args: {
                scope: "chat-panel",
                includeInherited: true,
              },
              result: "Resolved 21 skin variables from ChatPanel root.",
              durationMs: 280,
            },
          ],
        },
      ],
    }),
  ],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "收到。发送后的消息也会继续使用 large 模式和同一套自定义变量。\n\n",
        "- Header 仍然隐藏\n",
        "- ChatPanel 仍然是 large 模式\n",
        "- 右侧仍然只展示 ChatPanel\n",
        "- Inspector 和 MemFS 不会出现在这个案例布局里",
      ],
      ttftMs: 160,
      chunkDelayMs: 24,
    },
  ]),
};

export const chatPanelDefaultSkinCase: TestCase = {
  id: "chat-panel-default-skin",
  name: "ChatPanel 皮肤：默认",
  group: "特殊皮肤",
  priority: "P1",
  description: "同一套 ChatPanel 皮肤预览布局，但不传 className/style，不做任何 CSS 变量注入。",
  expectedBehavior: "主区域不显示 Request Inspector / MemFS，右侧展示 ChatPanel 默认 fallback 皮肤。",
  playgroundLayout: "chat-panel-skin",
  chatPanelSkin: "default",
  initialTurns: chatPanelSkinHistoryCase.initialTurns,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "这是默认皮肤下发送后的回复。\n\n",
        "- 不传 `className`\n",
        "- 不传 `style` CSS 变量\n",
        "- 只看 ChatPanel 自身 fallback 视觉",
      ],
      ttftMs: 140,
      chunkDelayMs: 24,
    },
  ]),
};

export const chatPanelSkinEmptyCase: TestCase = {
  id: "chat-panel-skin-empty",
  name: "ChatPanel 皮肤：Empty",
  group: "特殊皮肤",
  priority: "P1",
  description: "空历史场景，验证同一套 large + 自定义变量配置下 header=false 和 renderEmpty。",
  expectedBehavior: "右侧 ChatPanel 居中展示 empty 内容，底部 Sender 仍继承外部自定义变量。",
  playgroundLayout: "chat-panel-skin",
  chatPanelSkin: "custom",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "这是从 empty 态发送后的第一条回复。\n\n",
        "可以继续观察消息进入历史后的气泡、Markdown 和 Sender 视觉是否一致。",
      ],
      ttftMs: 140,
      chunkDelayMs: 26,
    },
  ]),
  renderEmpty: () => (
    <div className="pg-chat-skin-empty">
      <div className="pg-chat-skin-empty-mark">AI</div>
      <div className="pg-chat-skin-empty-title">ChatPanel Empty</div>
      <div className="pg-chat-skin-empty-desc">
        这里来自 <code>renderEmpty</code>，用于检查空消息时的居中布局、变量继承和底部 Sender。
      </div>
      <div className="pg-chat-skin-empty-tags">
        <span>header=false</span>
        <span>CSS variables</span>
        <span>empty state</span>
      </div>
    </div>
  ),
};
