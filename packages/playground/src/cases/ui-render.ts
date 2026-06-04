import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory, makeTurn } from "../lib/fixtures";

// ─── 富文本 markdown 内容 ──────────────────────────────────────────────────────

const RICH_MARKDOWN = `以下是一份完整的 React 性能优化报告，包含列表、表格和代码示例。

## 常见性能问题

主要分为以下几类：

- **不必要的重渲染**：父组件 state 变化导致所有子组件重渲染
- **昂贵的计算未缓存**：每次渲染都执行高复杂度计算
- **列表缺少 key**：影响 diff 算法效率
- **图片/资源未优化**：首屏加载体积过大
- **useEffect 依赖错误**：闭包陷阱或过度触发副作用

---

## 多级列表（嵌套）

无序列表多级缩进：

- **渲染层**
  - 组件级：\`React.memo\`、\`useMemo\`
  - 列表级：固定高度 + \`key\`、虚拟滚动
    - \`react-window\` / \`react-virtualized\`
    - 自研分片渲染
- **数据层**
  - 全局状态：拆分 store、按路由懒加载
  - 服务端：分页、游标、SWR / React Query

有序列表嵌套：

1. **测量**
   1. 打开 React DevTools Profiler
   2. 录制一次典型交互
2. **优化**
   - 先消除明显无效渲染
   - 再考虑算法与数据结构
3. **回归验证**
   1. 对比优化前后 commit 次数
   2. 关注 LCP / INP 等核心指标

混合列表（有序内含无序）：

1. 首屏路径
   - 关键路径 CSS
   - 字体 \`font-display: swap\`
2. 运行时路径
   1. 事件委托
   2. 防抖与节流

---

## 优化方案对比

| 问题 | 方案 | 收益 | 难度 |
|------|------|------|------|
| 子组件重渲染 | \`React.memo\` | 减少 60%+ 渲染次数 | ⭐ |
| 派生值重算 | \`useMemo\` | CPU 密集场景提升明显 | ⭐ |
| 函数引用变化 | \`useCallback\` | 配合 memo 使用 | ⭐ |
| 大列表渲染 | \`react-window\` | DOM 节点减少 90% | ⭐⭐ |
| 懒加载组件 | \`React.lazy + Suspense\` | 减小首屏 bundle | ⭐⭐ |
| Context 范围 | 拆分 Context | 减少无关组件订阅 | ⭐⭐⭐ |

---

## 代码示例

### 使用 React.memo 避免不必要渲染

\`\`\`tsx
import React, { memo, useCallback, useState } from 'react';

interface ListItemProps {
  id: number;
  label: string;
  onDelete: (id: number) => void;
}

// ✅ 用 memo 包裹，只在 props 变化时重渲染
const ListItem = memo(function ListItem({ id, label, onDelete }: ListItemProps) {
  console.log('render:', id);
  return (
    <div className="item">
      <span>{label}</span>
      <button onClick={() => onDelete(id)}>删除</button>
    </div>
  );
});

export default function List() {
  const [items, setItems] = useState([
    { id: 1, label: 'Item A' },
    { id: 2, label: 'Item B' },
    { id: 3, label: 'Item C' },
  ]);

  // ✅ useCallback 稳定引用，避免 memo 失效
  const handleDelete = useCallback((id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  return (
    <div>
      {items.map(item => (
        <ListItem key={item.id} {...item} onDelete={handleDelete} />
      ))}
    </div>
  );
}
\`\`\`

### 虚拟列表（react-window）

\`\`\`tsx
import { FixedSizeList } from 'react-window';

const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
  <div style={style}>Row {index}</div>
);

function VirtualList({ data }: { data: string[] }) {
  return (
    <FixedSizeList
      height={400}
      itemCount={data.length}
      itemSize={40}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
\`\`\`

---

> 💡 **建议**：先用 React DevTools Profiler 录制实际渲染瀑布图，找出热点组件，再针对性优化。避免过早优化。
`;

// 把完整 markdown 拆成 chunk 流式输出
const RICH_CHUNKS = RICH_MARKDOWN.match(/[\s\S]{1,30}/g) ?? [RICH_MARKDOWN];

// ─── 用户消息预设历史（包含文本+链接） ────────────────────────────────────────

const historyWithLinks = makeTextHistory([
  {
    user: "参考 https://react.dev/learn/render-and-commit 和 https://react.dev/reference/react/memo，帮我总结一下 React 渲染机制",
    assistant: "好的，我来基于官方文档为你整理 React 渲染机制的核心要点。",
  },
  {
    user: "详细说说 memo 的使用场景，另外这个 StackOverflow 问题也很有帮助：https://stackoverflow.com/questions/53074551https://stackoverflow.com/questions/53074551https://stackoverflow.com/questions/53074551https://stackoverflow.com/questions/53074551",
    assistant: "memo 主要用于纯展示型的子组件，父组件频繁更新但子组件 props 不变的场景效果最明显。",
  },
]);

// ─── 用户消息预设历史（包含 10 张图片） ─────────────────────────────────────────

const makeSvgImageDataUrl = (label: string, bg: string, fg: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" rx="18" fill="${bg}"/><circle cx="56" cy="54" r="22" fill="${fg}" opacity=".9"/><path d="M24 132 82 82l38 34 28-24 68 40H24Z" fill="${fg}" opacity=".55"/><text x="120" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const tenImageAttachments = [
  { type: "image", content: makeSvgImageDataUrl("01", "#2563eb", "#93c5fd") },
  { type: "image", content: makeSvgImageDataUrl("02", "#059669", "#86efac") },
  { type: "image", content: makeSvgImageDataUrl("03", "#dc2626", "#fca5a5") },
  { type: "image", content: makeSvgImageDataUrl("04", "#7c3aed", "#c4b5fd") },
  { type: "image", content: makeSvgImageDataUrl("05", "#ea580c", "#fdba74") },
  { type: "image", content: makeSvgImageDataUrl("06", "#0891b2", "#67e8f9") },
  { type: "image", content: makeSvgImageDataUrl("07", "#be123c", "#fda4af") },
  { type: "image", content: makeSvgImageDataUrl("08", "#4d7c0f", "#bef264") },
  { type: "image", content: makeSvgImageDataUrl("09", "#4338ca", "#a5b4fc") },
  { type: "image", content: makeSvgImageDataUrl("10", "#a16207", "#fde68a") },
] satisfies Array<{ type: "image"; content: string }>;

const historyWithTenImages = [
  makeTurn({
    userText: "请根据这 10 张参考图，提炼一套页面视觉风格。",
    attachments: tenImageAttachments,
    content: "我已经收到 10 张参考图，会从色彩、构图、层次和组件质感几个方向做归纳。",
  }),
];

// ─── 助手返回 Markdown 中包含图片 ─────────────────────────────────────────────

const MARKDOWN_IMAGE_URL =
  "https://p4-ec.eckwai.com/kos/nlav12333/aicode/talkImage/2026-06-04/render-feedback.0e0d6fc91991f859.png";

// ─── Cases ────────────────────────────────────────────────────────────────────

/** Markdown 富文本渲染：一级/多级列表 + 表格 + 代码块 */
export const markdownRichCase: TestCase = {
  id: "ui-markdown-rich",
  name: "富文本渲染（列表+表格+代码块）",
  group: "UI 渲染",
  description:
    "LLM 返回包含一级列表、多级嵌套列表、Markdown 表格、多个代码块的完整回复，验证渲染效果。",
  expectedBehavior:
    "消息气泡正确渲染一级与多级缩进列表、表格、代码块；嵌套层级视觉区分清晰，表格有边框对齐。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: RICH_CHUNKS,
      ttftMs: 200,
      chunkDelayMs: 18,
    },
  ]),
};

/** 用户消息含链接：验证链接是否可点击/正确渲染 */
export const userMessageWithLinksCase: TestCase = {
  id: "ui-user-links",
  name: "用户消息含链接",
  group: "UI 渲染",
  description: "预设历史中用户消息包含 https:// 链接，验证链接渲染（可点击 / 纯文本）。",
  expectedBehavior: "用户气泡中的 URL 以可点击链接或蓝色文本展示，不作为普通字符串。",
  initialTurns: historyWithLinks,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，基于上面两个链接的内容，", "我来给你输出一份完整的性能优化报告。\n\n", ...RICH_CHUNKS],
      ttftMs: 300,
      chunkDelayMs: 18,
    },
  ]),
};

/** 用户消息含 10 张图片：验证多图片附件展示与请求消息结构 */
export const userMessageWithTenImagesCase: TestCase = {
  id: "ui-user-ten-images",
  name: "用户消息含 10 张图片",
  group: "UI 渲染",
  description: "预设历史中用户消息包含 10 个图片附件，验证多图缩略图展示、预览与请求 messages 结构。",
  expectedBehavior:
    "用户气泡下方展示 10 张图片缩略图；点击缩略图可预览；Inspector 中用户消息 content 数组包含 1 个 text 和 10 个 image_url。",
  initialTurns: historyWithTenImages,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "我会把这 10 张图作为同一组参考来分析：",
        "\n\n- 统一提取主色和辅助色",
        "\n- 对比图片里的留白、圆角和卡片层级",
        "\n- 输出可复用的页面视觉规范",
      ],
      ttftMs: 200,
      chunkDelayMs: 25,
    },
  ]),
};

/** 助手消息 Markdown 含图片：验证返回消息内图片渲染 */
export const assistantMessageWithMarkdownImageCase: TestCase = {
  id: "ui-assistant-md-image",
  name: "助手消息 Markdown 图片",
  group: "UI 渲染",
  description: "LLM 返回消息包含 Markdown 图片语法，验证图片在助手消息内容中的渲染效果。",
  expectedBehavior:
    "助手气泡正文中的 ![alt](url) 渲染为图片；Inspector 中助手消息 content 保留为包含 Markdown 图片语法的文本。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "下面是这次渲染反馈图：\n\n",
        `![render feedback](${MARKDOWN_IMAGE_URL})`,
        "\n\n我会基于这张图继续检查布局、间距和视觉层级。",
      ],
      ttftMs: 200,
      chunkDelayMs: 25,
    },
  ]),
};

/** 工具调用后 LLM 返回空内容：触发"大模型返回内容为空"错误 */
export const toolThenEmptyContentCase: TestCase = {
  id: "tool-then-empty-content",
  name: "工具后 LLM 返回空内容",
  group: "异常检测",
  description:
    "先调用 read_file（成功），下一步 LLM 报「大模型返回内容为空」；点重试后第三次请求无限 pending。",
  expectedBehavior:
    '工具卡片绿色，随后 error「大模型返回内容为空」；重试后一直处于 pending（规划/流式不结束）。',
  initialTurns: [],
  request: makeScriptedRequest([
    // Step 1: 返回工具调用
    {
      type: "tool_calls",
      calls: [{ id: "c_read_empty", name: "read_file", args: { path: "src/App.tsx" } }],
      delayMs: 400,
    },
    // Step 2: 工具执行完后，请求层报"大模型返回内容为空"
    {
      type: "error",
      error: new Error("大模型返回内容为空"),
      delayMs: 300,
    },
    // Step 3: 重试后的下一次 LLM 请求（callIndex=2）— 无限 pending
    { type: "pending" },
  ]),
};
export const streamingMarkdownCase: TestCase = {
  id: "ui-streaming-markdown",
  name: "流式 Markdown 渲染",
  group: "UI 渲染",
  description:
    "以较慢速度逐字输出 Markdown（含多级列表与代码块），验证流式渲染过程中不出现乱码或格式错乱。",
  expectedBehavior:
    "多级列表在流式追加 chunk 时缩进与嵌套结构最终正确；代码块在闭合 ``` 后高亮；表格在完整行出现后对齐。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: RICH_MARKDOWN.match(/[\s\S]{1,8}/g) ?? [RICH_MARKDOWN],
      ttftMs: 100,
      chunkDelayMs: 60, // 更慢，方便观察流式过程
    },
  ]),
};

// ─── LLM 返回超链接的 Markdown 内容 ──────────────────────────────────────────────

const LINKS_MARKDOWN = `以下是常用的技术文档和工具链接：

## 官方文档

- [React 官方文档](https://react.dev) - React 19 新特性与最佳实践
- [Vue.js 官方文档](https://vuejs.org) - Vue 3 Composition API 指南
- [TypeScript 手册](https://www.typescriptlang.org/docs/) - 类型系统详解

## 学习资源

1. [MDN Web Docs](https://developer.mozilla.org) - Web 开发权威参考
2. [JavaScript Info](https://javascript.info) - 现代 JS 教程
3. [CSS Tricks](https://css-tricks.com) - CSS 技巧与实战

## 工具平台

| 名称 | 用途 | 链接 |
|------|------|------|
| [GitHub](https://github.com) | 代码托管 | https://github.com |
| [Stack Overflow](https://stackoverflow.com) | 技术问答 | https://stackoverflow.com |
| [CodeSandbox](https://codesandbox.io) | 在线编辑器 | https://codesandbox.io |

## 推荐阅读

想深入了解 React 性能优化，可以阅读 [React 官方性能优化指南](https://react.dev/learn/render-and-commit) 和这篇 [Stack Overflow 高赞回答](https://stackoverflow.com/questions/53074551)。

> 💡 提示：点击链接即可跳转到对应页面。
`;

const LINKS_CHUNKS = LINKS_MARKDOWN.match(/[\s\S]{1,25}/g) ?? [LINKS_MARKDOWN];

/** LLM 返回超链接：验证 markdown 链接正确渲染为可点击的 <a> 标签 */
export const assistantMessageWithLinksCase: TestCase = {
  id: "ui-assistant-links",
  name: "助手消息含超链接",
  group: "UI 渲染",
  description: "LLM 返回包含 Markdown 超链接的文本，验证链接是否正确渲染为可点击元素。",
  expectedBehavior:
    "助手气泡中的 [text](url) 格式渲染为蓝色可点击链接；表格内的链接也可点击；链接 target=_blank 在新标签打开。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: LINKS_CHUNKS,
      ttftMs: 150,
      chunkDelayMs: 20,
    },
  ]),
};
