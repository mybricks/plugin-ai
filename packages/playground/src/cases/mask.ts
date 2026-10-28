import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeToolHistory } from "../lib/fixtures";

// 每轮均有超过 mask 长度阈值的工具结果，便于观察被遮蔽的轮次。
function makeMaskHistory(baseTime: number) {
  return makeToolHistory(
    Array.from({ length: 5 }, (_, index) => ({
      user: `读取第 ${index + 1} 个文件`,
      assistant: `已读取第 ${index + 1} 个文件。`,
      toolCalls: [{
        name: "read_file",
        args: { path: `src/file-${index + 1}.ts` },
        result: `MASK_TURN_${index + 1}\n${`第 ${index + 1} 轮的文件内容。\n`.repeat(30)}`,
      }],
    })),
    baseTime,
  );
}

const recentToolHistory = makeMaskHistory(Date.now() - 10 * 60 * 1000);
const oldToolHistory = makeMaskHistory(Date.now() - 70 * 60 * 1000);

/** 根据历史工具调用 ID 检查实际请求，避免依赖消息在列表中的位置。 */
function assertMaskedToolTurns(expectedMasked: number[]) {
  return {
    name: "检查每轮工具结果是否按预期遮蔽",
    run: ({ snapshots, agent }: Parameters<NonNullable<TestCase["assertions"]>[number]["run"]>[0]) => {
      if (!snapshots.length || !agent) return null;
      const toolMessages = snapshots[0].params.messages?.filter((message: any) => message.role === "tool") ?? [];
      const history = agent.getTurns().slice(0, 5);
      const results = history.map((turn, index) => {
        const callId = turn.iterations.flatMap(iter => iter.toolCalls ?? [])[0]?.callId;
        const message = toolMessages.find((item: any) => item.tool_call_id === callId);
        const shouldMask = expectedMasked.includes(index + 1);
        return !!message && (shouldMask
          ? message.content === "[Old tool result content cleared]"
          : typeof message.content === "string" && message.content.includes(`MASK_TURN_${index + 1}`));
      });
      return { pass: results.length === 5 && results.every(Boolean), message: `各轮检查：${results.map((pass, i) => `${i + 1}:${pass ? "通过" : "失败"}`).join("、")}` };
    },
  };
}

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
  initialTurns: recentToolHistory,
  maskOptions: { maxTurns: 2, maxAgeMinutes: Infinity },
  assertions: [assertMaskedToolTurns([1, 2, 3])],
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
  initialTurns: oldToolHistory,
  maskOptions: { maxTurns: Infinity, maxAgeMinutes: 60 },
  assertions: [assertMaskedToolTurns([1, 2, 3, 4, 5])],
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
  assertions: [{
    name: "长工具结果被遮蔽，短结果保留",
    run: ({ snapshots, agent }) => {
      if (!snapshots.length || !agent) return null;
      const messages = snapshots[0].params.messages ?? [];
      const turns = agent.getTurns().slice(0, 3);
      const results = turns.map(turn => {
        const call = turn.iterations.flatMap(iter => iter.toolCalls ?? [])[0];
        const message = messages.find((item: any) => item.role === "tool" && item.tool_call_id === call?.callId);
        const original = call?.result?.output ?? "";
        return !!message && message.content === (original.length > 200 ? "[Old tool result content cleared]" : original);
      });
      return { pass: results.every(Boolean), message: `各轮检查：${results.map((pass, i) => `${i + 1}:${pass ? "通过" : "失败"}`).join("、")}` };
    },
  }],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，基于之前的修改，我来继续帮你完善代码。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};

const handoffMaskHistory = (() => {
  const turns = makeToolHistory(
    [
      {
        user: "读取一个有 handoff 的旧文件",
        assistant: "已读取并总结。",
        toolCalls: [
          {
            name: "read_file",
            args: { path: "src/with-handoff.ts" },
            result: `HANDOFF_MASK_ORIGINAL_TOOL\n${"with handoff output\n".repeat(40)}`,
          },
        ],
      },
      {
        user: "读取一个没有 handoff 的旧文件",
        assistant: "已读取。",
        toolCalls: [
          {
            name: "read_file",
            args: { path: "src/no-handoff.ts" },
            result: `HANDOFF_MASK_NO_HANDOFF_TOOL\n${"no handoff output\n".repeat(40)}`,
          },
        ],
      },
    ],
    Date.now() - 90 * 60 * 1000
  );
  turns[0].handoff = "HANDOFF_MASK_SUMMARY：已读取 src/with-handoff.ts，并记录关键结论。";
  return turns;
})();

export const handoffDisabledCase: TestCase = {
  id: "handoff-disabled",
  name: "handoff 默认关闭",
  group: "消息遮蔽",
  description: "历史 turn 带 handoff 字段，但 Agent 未配置 handoff。发新消息时历史仍按原始记录展开。",
  expectedBehavior: "Inspector messages 不应出现 HANDOFF_MASK_SUMMARY，应保留原始工具结果 HANDOFF_MASK_ORIGINAL_TOOL。",
  initialTurns: handoffMaskHistory,
  // 此案例只验证默认 handoff；关闭 mask 避免旧工具结果被时间规则遮蔽。
  maskOptions: { maxTurns: Infinity, maxAgeMinutes: Infinity },
  assertions: [{
    name: "默认不使用 handoff 且保留工具结果",
    run: ({ snapshots }) => {
      if (!snapshots.length) return null;
      const serialized = JSON.stringify(snapshots[0].params.messages ?? []);
      const pass = !serialized.includes("HANDOFF_MASK_SUMMARY") && serialized.includes("HANDOFF_MASK_ORIGINAL_TOOL");
      return { pass, message: pass ? "历史工具结果可见，未使用 handoff" : "历史工具结果缺失或意外使用 handoff" };
    },
  }],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，handoff 默认关闭时继续正常回复。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};

export const handoffWithMaskCase: TestCase = {
  id: "handoff-with-mask",
  name: "handoff 与 mask 混合",
  group: "消息遮蔽",
  description: "同时启用 handoff 和 mask。带 handoff 的轮次先替换成 handoff，没有 handoff 的旧轮次继续按 mask 遮蔽。",
  expectedBehavior: "Inspector messages 应出现 HANDOFF_MASK_SUMMARY，不出现 HANDOFF_MASK_ORIGINAL_TOOL；无 handoff 的工具结果被替换为 [Old tool result content cleared]。",
  initialTurns: handoffMaskHistory,
  handoffOptions: { enabled: true },
  maskOptions: { maxAgeMinutes: 60 },
  assertions: [{
    name: "handoff 与 mask 分别处理历史轮次",
    run: ({ snapshots, agent }) => {
      if (!snapshots.length || !agent) return null;
      const messages = snapshots[0].params.messages ?? [];
      const serialized = JSON.stringify(messages);
      const callId = agent.getTurns()[1]?.iterations.flatMap(iter => iter.toolCalls ?? [])[0]?.callId;
      const maskedResult = messages.find((item: any) => item.role === "tool" && item.tool_call_id === callId);
      const pass = serialized.includes("HANDOFF_MASK_SUMMARY") && !serialized.includes("HANDOFF_MASK_ORIGINAL_TOOL") && maskedResult?.content === "[Old tool result content cleared]";
      return { pass, message: pass ? "handoff 摘要可见，另一轮工具结果已遮蔽" : "handoff 或 mask 结果不符合预期" };
    },
  }],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，handoff 和 mask 混合验证完成。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};
