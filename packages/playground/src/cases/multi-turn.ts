import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeToolHistory } from "../lib/fixtures";

// ─── 预设历史 ─────────────────────────────────────────────────────────────────

const twoTurnHistory = makeToolHistory(
  [
    {
      user: "读一下 config.ts",
      assistant: "已读取，config.ts 包含基础配置。",
      toolCalls: [{ name: "read_file", args: { path: "/src/config.ts" }, result: "export const config = { debug: false };" }],
    },
  ],
  Date.now() - 10 * 60 * 1000
);

// ─── Cases ────────────────────────────────────────────────────────────────────

export const multiTurnNormalCase: TestCase = {
  id: "multi-turn-normal",
  name: "多步 ReAct（读 → 写 → 回复）",
  group: "多轮 ReAct",
  description: "LLM 连续调用两个工具（read_file → write_file），最后给出总结回复",
  expectedBehavior:
    "两个工具卡片依次出现，全部成功后 LLM 给出最终文本回复，turn:complete 触发。",
  initialTurns: [],
  // CodeAgent 内置 read_file / write_file，无需额外 tools
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_read_1", name: "read_file", args: { path: "src/App.tsx" } }],
      delayMs: 400,
    },
    {
      type: "tool_calls",
      calls: [
        {
          id: "c_write_1",
          name: "write_file",
          args: { path: "src/App.tsx", content: "// updated\nexport default function App() { return <div>Updated</div>; }" },
        },
      ],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["好了，我已经读取了 App.tsx 的内容，并完成了修改。", "主要更新了组件的渲染内容，现在显示 'Updated'。"],
      ttftMs: 500,
      chunkDelayMs: 60,
    },
  ]),
};

export const multiTurnMidErrorCase: TestCase = {
  id: "multi-turn-mid-error",
  name: "第 2 步 LLM 请求报错",
  group: "多轮 ReAct",
  description:
    "第 1 步 LLM → 工具调用成功。工具执行完后，第 2 步 LLM 请求时网络断开。",
  expectedBehavior:
    "第一个工具卡片显示成功，随后进入 error 状态，出现重试按钮。点击重试从第 2 步继续（不重复执行工具）。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_read_2", name: "read_file", args: { path: "src/index.ts" } }],
      delayMs: 500,
    },
    {
      type: "error",
      error: new Error("Connection lost while waiting for LLM response"),
      delayMs: 1000,
    },
    // 重试成功（第 3 次调用）
    {
      type: "content",
      chunks: ["（重试成功）文件内容已分析，主入口文件结构清晰。"],
      ttftMs: 300,
      chunkDelayMs: 50,
    },
  ]),
};

export const multiTurnWithHistoryCase: TestCase = {
  id: "multi-turn-with-history",
  name: "在历史记录基础上继续",
  group: "多轮 ReAct",
  description:
    "预设 1 轮历史（已读过 config.ts），在此基础上发新消息，验证历史上下文正确携带。",
  expectedBehavior:
    "ChatPanel 初始显示 1 条历史，发新消息后 LLM 能感知历史（对话连贯）。",
  initialTurns: twoTurnHistory,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: [
        "根据之前读取的 config.ts，",
        "我看到 debug 目前是 false。",
        "如果你需要开启调试模式，只需将 debug 改为 true。",
      ],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};

export const thinkingCase: TestCase = {
  id: "thinking-mode",
  name: "带思考内容（thinking）",
  group: "多轮 ReAct",
  description: "模型先输出 thinking 内容（推理过程），再给出正式回复",
  expectedBehavior: "思考气泡折叠展示，正文气泡正常显示。",
  initialTurns: [],
  tools: [],
  request: makeScriptedRequest([
    {
      type: "thinking",
      thinkingChunks: [
        "用户问的是性能优化问题。",
        "需要从渲染频率、Bundle 体积、网络请求三个维度分析。",
        "给出具体可操作的建议，不要泛泛而谈。",
      ],
      contentChunks: [
        "性能优化建议：",
        "1. 减少不必要的重渲染（使用 React.memo）",
        "2. 代码分割（dynamic import）",
        "3. 图片懒加载",
      ],
      chunkDelayMs: 60,
      ttftMs: 200,
    },
  ]),
};
