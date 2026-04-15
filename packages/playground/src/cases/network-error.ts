import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

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
    // 第二次（retry 后）正常返回
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
