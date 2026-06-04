import type { TestCase } from "./types";
import type { RequestAsStreamFn } from "@request/types";
import { makeScriptedRequest } from "../lib/scripted-request";

// doom loop：连续重复同一组 tool_calls 序列。
// 新逻辑以每个 iter 的全部工具调用序列为 key，并在工具执行完成后检测。
const doomRequest = makeScriptedRequest(
  [
    {
      type: "tool_calls",
      calls: [
        {
          id: "doom_read",
          name: "read_file",
          args: { path: "src/App.tsx" },
        },
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
  name: "Doom Loop 序列检测（阈值 3）",
  group: "异常检测",
  description:
    "LLM 每次都返回同一组 read_file + write_file 调用，覆盖按 iter 全量工具序列检测 doom loop。",
  expectedBehavior:
    "前 3 轮相同序列正常执行；第 4 轮相同序列执行完成后触发 turn:doom，turn 以 error 结束并显示“连续调用，已自动中断”。",
  initialTurns: [],
  request: doomRequest,
};

export const doomLoopThreshold5Case: TestCase = {
  id: "doom-loop-threshold-5",
  name: "Doom Loop（阈值 5）",
  group: "异常检测",
  description: "与上一个 case 相同，但将 doomLoopThreshold 设置为 5。",
  expectedBehavior: "前 5 轮相同序列正常执行；第 6 轮相同序列执行完成后才触发 doom loop 并以 error 结束。",
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

const abortThenNextTurnAwarenessRequest: RequestAsStreamFn = async (params) => {
  const hasInterruptedMessage = (params.messages ?? []).some(
    (message: any) =>
      message?.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[Request interrupted by user]")
  );

  if (hasInterruptedMessage) {
    params.emits.write("已感知上一轮被用户取消，本轮会基于取消后的上下文继续处理。");
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
    return;
  }

  let cancelled = false;
  params.emits.cancel(() => {
    cancelled = true;
  });

  for (let i = 0; i < 20; i++) {
    if (cancelled) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (cancelled) return;
    params.emits.write(`第 ${i + 1} 段长输出，点击停止后再发送下一轮消息... `);
  }

  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

export const abortThenNextTurnAwarenessCase: TestCase = {
  id: "abort-next-turn-awareness",
  name: "取消后下一轮感知",
  group: "异常检测",
  priority: "P0",
  description: "第一轮流式输出时点击停止，再发送下一轮消息，验证下一轮请求 messages 能感知上一轮被取消。",
  expectedBehavior:
    "第一轮点击停止后状态为 abort；第二轮 Inspector 的 messages 中包含 [Request interrupted by user]，助手回复“已感知上一轮被用户取消”。",
  initialTurns: [],
  request: abortThenNextTurnAwarenessRequest,
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
