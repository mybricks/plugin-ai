import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { RequestAsStreamParams } from "@request/types";

export const networkErrorCase: TestCase = {
  id: "network-error-immediate",
  name: "立即报错",
  group: "网络中断",
  description: "模拟发送消息后立刻收到网络错误（如接口 500 / DNS 解析失败）",
  expectedBehavior:
    "消息气泡进入 error 状态，显示错误信息，出现重试按钮。turn:error 事件触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "error",
      error: new Error("Request failed with status 500: Internal Server Error"),
      delayMs: 300,
    },
  ]),
};

export const networkErrorDelayedCase: TestCase = {
  id: "network-error-delayed",
  name: "延迟断开（2s）",
  group: "网络中断",
  description: "先有 2 秒等待，模拟请求发出后超时断开（如 TCP 超时、代理断连）",
  expectedBehavior: "loading 状态持续 2 秒，随后进入 error 状态。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "error",
      error: new Error("ERR_CONNECTION_TIMED_OUT: The connection timed out after 2000ms"),
      delayMs: 2000,
    },
  ]),
};

export const networkErrorAfterStreamCase: TestCase = {
  id: "network-error-mid-stream",
  name: "流式输出中途断开",
  group: "网络中断",
  description: "LLM 已经开始流式输出内容，但在输出中途网络断开",
  expectedBehavior:
    "消息气泡先显示部分内容，随后出现错误提示，重试按钮可见。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，我来帮你", "分析一下这个问题", "首先我们需要", "考虑以下几点"],
      chunkDelayMs: 200,
      ttftMs: 400,
    },
    {
      type: "error",
      error: new Error("Stream interrupted: connection reset by peer"),
      delayMs: 0,
    },
  ]),
};

/**
 * content + tool_call 名称已到 → 参数传输中途报错
 *
 * 流程：
 *  1. 先 stream 几个 content chunk（LLM 说了一半话）
 *  2. emit onToolCallStream（只有 name，argsChunk=""）表示工具调用开始
 *  3. 逐字符 stream args（模拟参数 JSON 慢速到达）
 *  4. args 还没传完，调用 emits.error() 模拟连接中断
 */
export const toolCallArgsMidErrorCase: TestCase = {
  id: "tool-call-args-mid-error",
  name: "工具参数传输中途断开",
  group: "网络中断",
  description:
    "LLM 先返回部分 content，再开始返回工具调用（name 已到），参数 JSON 传输过程中接口报错。",
  expectedBehavior:
    "消息气泡先显示部分文字 + 未完成的工具卡片（参数不完整），随后进入 error 状态，重试按钮可见。",
  initialTurns: [],
  request: async (params) => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // 1. 先输出几个 content chunk
    await delay(300);
    for (const chunk of ["好的，", "我来帮你修改一下 ", "App.tsx，"]) {
      await delay(80);
      params.emits.write(chunk);
    }

    // 2. 工具调用开始（只有 name，args 还没有）
    await delay(200);
    params.emits.onToolCallStream?.({
      index: 0,
      id: "c_partial_1",
      name: "write_file",
      argsChunk: "",
    });

    // 3. 逐字符 stream args，模拟慢速传输
    const fullArgs = JSON.stringify({
      path: "src/App.tsx",
      content: "import React from 'react';\nexport default function App() { return <div>Updated</div>; }",
    });
    const midpoint = Math.floor(fullArgs.length * 0.45); // 只传 45% 就断
    for (let i = 0; i < midpoint; i += 3) {
      await delay(25);
      params.emits.onToolCallStream?.({ index: 0, argsChunk: fullArgs.slice(i, i + 3) });
    }

    // 4. 参数还没传完，接口报错
    await delay(150);
    params.emits.error(new Error("Stream aborted: connection reset by peer (mid-args)"));
  },
};

// ─── 带重试的网络中断场景 ─────────────────────────────────────────────────────

/**
 * 首次请求失败，自动重试后成功
 *
 * 流程：
 *  1. 第一次请求立即报错（模拟瞬时故障）
 *  2. 自动重试（触发 llm:retry 事件）
 *  3. 第二次请求正常返回内容
 */
export const networkErrorRetrySuccessCase: TestCase = {
  id: "network-error-retry-success",
  name: "失败后重试成功",
  group: "网络中断",
  description: "首次请求失败（瞬时故障），自动重试后成功返回内容",
  expectedBehavior:
    "loading 状态后触发 llm:retry 事件，随后正常显示内容。消息气泡最终状态为 success。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "error",
      error: new Error("ECONNRESET: Connection reset by peer"),
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["好的，我明白了。", "这是一个关于重试机制的测试用例。", "重试成功后，我正常返回了内容。"],
      chunkDelayMs: 100,
      ttftMs: 400,
    },
  ]),
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 500,
      maxDelayMs: 5000,
    },
  },
};

/**
 * 多次失败后最终成功（测试多次重试）
 *
 * 流程：
 *  1. 前两次请求都失败
 *  2. 第三次请求成功返回
 */
export const networkErrorMultiRetrySuccessCase: TestCase = {
  id: "network-error-multi-retry-success",
  name: "多次重试后成功",
  group: "网络中断",
  description: "前两次请求失败，第三次自动重试后成功",
  expectedBehavior:
    "触发两次 llm:retry 事件（attempt=1, attempt=2），第三次请求成功返回内容。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "error",
      error: new Error("Request timeout (attempt 1)"),
      delayMs: 200,
    },
    {
      type: "error",
      error: new Error("Request timeout (attempt 2)"),
      delayMs: 200,
    },
    {
      type: "content",
      chunks: [
        "经历了两次失败后，",
        "终于成功了！",
        "这证明了重试机制正常工作。",
      ],
      chunkDelayMs: 80,
      ttftMs: 300,
    },
  ]),
  agentOptions: {
    retry: {
      maxRetries: 3,
      baseDelayMs: 200,
      maxDelayMs: 2000,
    },
  },
};

/**
 * 重试次数耗尽后最终失败
 *
 * 流程：
 *  1. 连续三次请求都失败（超过 maxRetries=2 的限制）
 *  2. 进入 error 状态，显示重试按钮
 */
export const networkErrorRetryExhaustedCase: TestCase = {
  id: "network-error-retry-exhausted",
  name: "重试次数耗尽",
  group: "网络中断",
  description: "连续请求失败，超过最大重试次数后最终进入 error 状态",
  expectedBehavior:
    "触发两次 llm:retry 事件后仍失败，消息气泡进入 error 状态，显示错误信息和重试按钮。",
  initialTurns: [],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 所有请求都失败
      await delay(200);
      params.emits.error?.(
        new Error(`Service Unavailable: 503 (attempt ${idx + 1}${idx === 2 ? ' - final' : ''})`)
      );
    };
  })(),
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 500,
    },
  },
};

/**
 * 流式输出中途断开，重试后成功
 *
 * 流程：
 *  1. 第一次请求开始流式输出，中途断开
 *  2. 自动重试后，完整输出内容
 */
export const networkErrorStreamInterruptRetryCase: TestCase = {
  id: "network-error-stream-interrupt-retry",
  name: "流式中断后重试",
  group: "网络中断",
  description: "首次流式输出中途断开，重试后完整输出",
  expectedBehavior:
    "先显示部分内容，触发 llm:retry 事件，随后重新显示完整内容。",
  initialTurns: [],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 第一次请求：流式输出部分内容后中断
      if (idx === 0) {
        await delay(300);
        const chunks = ["这是一段", "被打断的", "部分内容..."];
        for (const chunk of chunks) {
          params.emits.write?.(chunk);
          await delay(150);
        }
        // 中途报错
        params.emits.error?.(new Error("Stream interrupted: connection reset"));
        return;
      }

      // 第二次请求（重试后）：完整输出内容
      await delay(400);
      const chunks = [
        "重试成功！",
        "这是完整的回复内容。",
      ];
      for (const chunk of chunks) {
        params.emits.write?.(chunk);
        await delay(100);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 300,
      maxDelayMs: 3000,
    },
  },
};

/**
 * 工具调用前失败，重试后成功触发工具
 *
 * 流程：
 *  1. 第一次请求失败
 *  2. 重试后返回工具调用
 *  3. 工具执行完成后，LLM 返回最后的内容
 */
export const networkErrorBeforeToolRetryCase: TestCase = {
  id: "network-error-before-tool-retry",
  name: "工具调用前重试",
  group: "网络中断",
  description: "首次请求失败，重试后正常返回工具调用",
  expectedBehavior:
    "触发 llm:retry 事件后，显示工具调用卡片，工具执行成功，显示最后的内容。",
  initialTurns: [],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 第一次请求：失败
      if (idx === 0) {
        await delay(200);
        params.emits.error?.(new Error("Network error before tool call"));
        return;
      }

      // 第二次请求（重试后）：返回工具调用
      if (idx === 1) {
        await delay(300);
        params.emits.onToolCallStream?.({
          index: 0,
          id: "call_retry_1",
          name: "write_file",
          argsChunk: "",
        });
        const argsObj = {
          path: "src/test.ts",
          content: "// Test file created after retry\nexport const test = 'success';",
        };
        const argsStr = JSON.stringify(argsObj);
        for (let i = 0; i < argsStr.length; i += 4) {
          await delay(20);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, Math.min(i + 4, argsStr.length)) });
        }
        params.emits.onToolCalls?.([{ id: "call_retry_1", name: "write_file", args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      // 第三次请求：工具执行后的最后内容
      await delay(200);
      const chunks = ["文件已成功创建！", "重试机制确保了可靠性。"];
      for (const chunk of chunks) {
        params.emits.write?.(chunk);
        await delay(100);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 200,
      maxDelayMs: 2000,
    },
  },
};

/**
 * 长时间重试后成功
 *
 * 流程：
 *  1. 第一次请求失败
 *  2. 第二次重试失败（重试延迟约30s）
 *  3. 第三次重试成功返回内容
 */
export const networkErrorLongRetryCase: TestCase = {
  id: "network-error-long-retry",
  name: "长时间重试后成功",
  group: "网络中断",
  description: "前两次请求失败，第二次重试延迟约30秒，第三次重试成功",
  expectedBehavior:
    "触发两次 llm:retry 事件，第二次重试等待约30秒，最后成功返回内容。重试信息显示在思考中右边。",
  initialTurns: [],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 第一次请求：失败
      if (idx === 0) {
        await delay(300);
        params.emits.error?.(new Error("Network timeout (attempt 1)"));
        return;
      }

      // 第二次请求（重试1）：失败
      // 这次重试后会等待约 15000 * 2 = 30s
      if (idx === 1) {
        await delay(300);
        params.emits.error?.(new Error("Network timeout (attempt 2)"));
        return;
      }

      // 第三次请求（重试2）：成功
      await delay(500);
      const chunks = [
        "终于成功了！",
        "经历了两次失败和长时间等待，",
        "重试机制最终确保了请求成功。",
      ];
      for (const chunk of chunks) {
        params.emits.write?.(chunk);
        await delay(100);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 15000, // 第二次重试延迟约 15s * 2 = 30s
      maxDelayMs: 60000,
    },
  },
};
