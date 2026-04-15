import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

// doom loop：连续 3 次相同工具+相同参数 → 触发 turn:doom → 循环中断
const doomRequest = makeScriptedRequest(
  [
    {
      type: "tool_calls",
      calls: [
        {
          id: "doom_call",
          name: "write_file",
          args: { path: "src/loop.ts", content: "// same content" },
        },
      ],
      delayMs: 300,
    },
  ],
  { loop: true } // 每次 LLM 都返回同一个工具调用
);

export const doomLoopCase: TestCase = {
  id: "doom-loop",
  name: "Doom Loop 检测（阈值 3）",
  group: "异常检测",
  description:
    "LLM 每次都返回完全相同的 write_file 调用（相同路径+内容），触发 doom loop 检测。默认阈值为 3 次。",
  expectedBehavior:
    "第 3 次相同调用时，turn:doom 事件触发，循环中断，turn 以当前状态完成（turn:complete）。",
  initialTurns: [],
  request: doomRequest,
};

export const doomLoopThreshold5Case: TestCase = {
  id: "doom-loop-threshold-5",
  name: "Doom Loop（阈值 5）",
  group: "异常检测",
  description: "与上一个 case 相同，但将 doomLoopThreshold 设置为 5。",
  expectedBehavior: "第 5 次相同调用时才中断，前 4 次正常执行。",
  initialTurns: [],
  request: doomRequest,
  agentOptions: { doomLoopThreshold: 5 },
};

export const abortCase: TestCase = {
  id: "abort-during-stream",
  name: "流式输出中 abort",
  group: "异常检测",
  description:
    "LLM 正在流式输出内容时，点击停止按钮（abort）。",
  expectedBehavior:
    "turn:abort 事件触发，消息气泡停在当前内容，显示已中止状态。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      // 每个 chunk 间隔 500ms，给用户充足时间点 abort
      chunks: Array.from({ length: 20 }, (_, i) => `第 ${i + 1} 段内容... `),
      ttftMs: 200,
      chunkDelayMs: 500,
    },
  ]),
};

export const retrySuccessCase: TestCase = {
  id: "retry-success",
  name: "重试成功",
  group: "异常检测",
  description:
    "第 1 次请求立即报错，点击重试后第 2 次成功返回内容。",
  expectedBehavior:
    "初始 error 气泡 → 点重试 → 成功气泡，历史中保留重试前的 error turn（retried=true）。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "error",
      error: new Error("Rate limit exceeded: too many requests"),
      delayMs: 500,
    },
    {
      type: "content",
      chunks: ["（重试成功）这是重试后的正常回复内容。"],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
  ]),
};

/**
 * maxSteps case：设 maxSteps=3，LLM 永远返回 tool_calls（read_file）。
 *
 * 预期行为：
 * - step 1~3：每轮 LLM → read_file → 工具执行成功 → 再次调用 LLM（循环）
 * - step 3 执行完工具后，循环计数 >= maxSteps，跳出循环
 * - turn.status = "success"，finishReason = "length"（非 stop，也非 error）
 * - 消息气泡正常完成，无错误提示
 * - Inspector 可见 3 个 Step（每次 LLM 请求对应一个快照）
 */
export const maxStepsCase: TestCase = {
  id: "max-steps",
  name: "maxSteps 限制（3 步）",
  group: "异常检测",
  description:
    "LLM 每次都返回 read_file 工具调用（永不停止），maxSteps=3 限制循环轮数。",
  expectedBehavior:
    "Inspector 出现 3 个 Step，第 3 步工具执行后循环停止，turn 正常完成（finishReason=length，无报错）。",
  initialTurns: [],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [{ id: "c_ms", name: "read_file", args: { path: "src/App.tsx" } }],
        delayMs: 300,
      },
    ],
    { loop: true }
  ),
  agentOptions: { maxSteps: 3 },
};
