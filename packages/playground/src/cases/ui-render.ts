import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory } from "../lib/fixtures";

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

// ─── Cases ────────────────────────────────────────────────────────────────────

/** Markdown 富文本渲染：列表 + 表格 + 代码块 */
export const markdownRichCase: TestCase = {
  id: "ui-markdown-rich",
  name: "富文本渲染（列表+表格+代码块）",
  group: "UI 渲染",
  description: "LLM 返回包含列表、Markdown 表格、多个代码块的完整回复，验证渲染效果。",
  expectedBehavior: "消息气泡正确渲染列表、表格、代码块，代码有高亮，表格有边框对齐。",
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
  description: "以较慢速度逐字输出 Markdown（含代码块），验证流式渲染过程中不出现乱码或格式错乱。",
  expectedBehavior: "代码块在输出到 ``` 时正确开始高亮，表格在输出完整行后正确对齐。",
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
