import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory, makeToolHistory } from "../lib/fixtures";

// ─── 预设历史：5 轮纯文本，1 小时前 ─────────────────────────────────────────

const oldTextHistory = makeTextHistory(
  [
    { user: "帮我分析一下组件的性能问题", assistant: "好的，我来分析一下。组件渲染性能主要受以下因素影响：1. 频繁的 state 更新；2. 未使用 React.memo；3. 重复计算的派生值。建议先用 React DevTools Profiler 录制一下渲染瀑布图。" },
    { user: "我用了 useEffect 依赖数组为空，会有问题吗", assistant: "useEffect 空依赖数组意味着只在组件 mount 时执行一次。如果里面引用了 state 或 props，会产生闭包陷阱——它们永远是初始值，不会跟随更新。这通常是 bug 的来源。" },
    { user: "怎么修复闭包陷阱", assistant: "修复方式有三种：1. 将相关变量加入依赖数组；2. 使用 useRef 保存最新值；3. 使用 useCallback 包裹函数并正确声明依赖。推荐第一种，最直观。" },
    { user: "好的，我按照你说的改完了，还有其他优化建议吗", assistant: "改完后可以进一步考虑：1. 将大列表渲染改用虚拟滚动（react-window）；2. 懒加载非首屏组件；3. 减少 Context re-render 范围。" },
    { user: "谢谢，问题都解决了", assistant: "不客气！如果后续遇到新问题随时可以继续讨论。" },
  ],
  Date.now() - 70 * 60 * 1000 // 70 分钟前（超过默认 60 分钟阈值）
);

// ─── 预设历史：3 轮含工具调用 ────────────────────────────────────────────────

const toolHistory = makeToolHistory(
  [
    {
      user: "读一下 App.tsx 的内容",
      assistant: "已读取文件，内容如上。文件主要包含一个 App 组件，引用了 Button 和 Header。",
      toolCalls: [
        {
          name: "read_file",
          args: { path: "src/App.tsx" },
          result: `1: import React from 'react';
2: import { Button } from './components/Button';
3: import { Header } from './components/Header';
4: import { useEffect, useState } from 'react';
5:
6: interface AppProps {
7:   title?: string;
8: }
9:
10: export default function App({ title = 'My App' }: AppProps) {
11:   const [count, setCount] = useState(0);
12:
13:   useEffect(() => {
14:     document.title = title;
15:   }, [title]);
16:
17:   return (
18:     <div className="app">
19:       <Header title={title} />
20:       <main>
21:         <p>Count: {count}</p>
22:         <Button label="Increment" onClick={() => setCount(c => c + 1)} />
23:         <Button label="Reset" variant="secondary" onClick={() => setCount(0)} />
24:       </main>
25:     </div>
26:   );
27: }

(Lines 1-27 of 27)`,
        },
      ],
    },
    {
      user: "修改一下，加个 footer，点击 Reset 时弹窗确认",
      assistant: "已更新 App.tsx，添加了 Footer 组件，并在 Reset 按钮点击时加入 window.confirm 确认弹窗。",
      toolCalls: [
        {
          name: "write_file",
          args: {
            path: "src/App.tsx",
            content: `import React from 'react';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { useEffect, useState } from 'react';

interface AppProps {
  title?: string;
}

export default function App({ title = 'My App' }: AppProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = title;
  }, [title]);

  const handleReset = () => {
    if (window.confirm('确认重置计数器？')) {
      setCount(0);
    }
  };

  return (
    <div className="app">
      <Header title={title} />
      <main>
        <p>Count: {count}</p>
        <Button label="Increment" onClick={() => setCount(c => c + 1)} />
        <Button label="Reset" variant="secondary" onClick={handleReset} />
      </main>
      <Footer />
    </div>
  );
}`,
          },
          result: "文件写入成功",
        },
      ],
    },
    {
      user: "再读一下确认一下最终内容",
      assistant: "确认文件已正确更新，包含了 Footer 组件和 Reset 确认弹窗逻辑。",
      toolCalls: [
        {
          name: "read_file",
          args: { path: "src/App.tsx" },
          result: `1: import React from 'react';
2: import { Button } from './components/Button';
3: import { Header } from './components/Header';
4: import { Footer } from './components/Footer';
5: import { useEffect, useState } from 'react';
6:
7: interface AppProps {
8:   title?: string;
9: }
10:
11: export default function App({ title = 'My App' }: AppProps) {
12:   const [count, setCount] = useState(0);
13:
14:   useEffect(() => {
15:     document.title = title;
16:   }, [title]);
17:
18:   const handleReset = () => {
19:     if (window.confirm('确认重置计数器？')) {
20:       setCount(0);
21:     }
22:   };
23:
24:   return (
25:     <div className="app">
26:       <Header title={title} />
27:       <main>
28:         <p>Count: {count}</p>
29:         <Button label="Increment" onClick={() => setCount(c => c + 1)} />
30:         <Button label="Reset" variant="secondary" onClick={handleReset} />
31:       </main>
32:       <Footer />
33:     </div>
34:   );
35: }

(Lines 1-35 of 35)`,
        },
      ],
    },
  ],
  Date.now() - 90 * 60 * 1000 // 90 分钟前
);

// ─── Cases ────────────────────────────────────────────────────────────────────

export const maskByTurnsCase: TestCase = {
  id: "mask-by-turns",
  name: "按轮次触发 mask（maxTurns=2）",
  group: "消息遮蔽",
  description:
    "预设 5 轮历史，mask.maxTurns=2。发消息时前 3 轮工具结果会被遮蔽，只保留最近 2 轮完整内容。",
  expectedBehavior:
    "查看发给 LLM 的 messages（console），第 3 轮及之前的 tool 消息 content 替换为占位符。",
  initialTurns: oldTextHistory,
  maskOptions: { maxTurns: 2 },
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，基于我们之前的对话，我来继续帮你。"],
      ttftMs: 500,
      chunkDelayMs: 50,
    },
  ]),
};

export const maskByAgeCase: TestCase = {
  id: "mask-by-age",
  name: "按时间触发 mask（70 分钟前历史）",
  group: "消息遮蔽",
  description:
    "预设 5 轮历史，时间戳为 70 分钟前。默认 maxAgeMinutes=60，所有历史轮次都超过阈值被遮蔽。",
  expectedBehavior: "所有旧轮次的工具结果被替换为 '[Old tool result content cleared]'。",
  initialTurns: oldTextHistory,
  maskOptions: { maxAgeMinutes: 60 },
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["当然，让我继续为您解答。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};

export const maskToolHistoryCase: TestCase = {
  id: "mask-tool-history",
  name: "工具调用历史遮蔽",
  group: "消息遮蔽",
  description:
    "预设 3 轮含工具调用的历史（90 分钟前），发新消息时工具结果消息被遮蔽。",
  expectedBehavior:
    "tool 消息 content 超过 200 字符时替换为占位符，短确认消息保留。",
  initialTurns: toolHistory,
  maskOptions: { maxAgeMinutes: 60 },
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，基于之前的修改，我来继续帮你完善代码。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};
