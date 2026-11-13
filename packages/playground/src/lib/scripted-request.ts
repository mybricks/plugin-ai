import type { RequestAsStreamFn } from "@request/types";
import type { ToolCallSpec } from "@request/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Step 类型 ────────────────────────────────────────────────────────────────

export type MockStep =
  | {
      type: "content";
      /** 流式 chunk 列表，逐条 write 给 LLM */
      chunks: string[];
      /** 每个 chunk 之间的延迟（ms），模拟流速，默认 40 */
      chunkDelayMs?: number;
      /** 首个 chunk 前的延迟（ms），模拟 TTFT，默认 0 */
      ttftMs?: number;
    }
  | {
      type: "tool_calls";
      calls: ToolCallSpec[];
      /** 返回前的延迟（ms） */
      delayMs?: number;
      /** 单次工具参数流的字符数，默认 4；设为 1 可模拟逐字/逐字符输出。 */
      streamChunkSize?: number;
      /** 工具参数流每个 chunk 的间隔（ms），默认 20。 */
      streamChunkDelayMs?: number;
    }
  | {
      /**
       * 同一轮 LLM 调用里，先输出一段文本，紧接着（不结束 turn）触发工具调用。
       * 对应真实场景里"模型说明要做什么，然后紧接着调用工具"——
       * 这种 iter 会同时携带 content 和 toolCalls。
       * 注意：纯 "content" step 不会调用 onToolCalls，turn 会直接结束；
       * 想让 ReAct 循环继续，必须用这个类型（或 "tool_calls"）。
       */
      type: "content_then_tool_calls";
      chunks: string[];
      calls: ToolCallSpec[];
      chunkDelayMs?: number;
      ttftMs?: number;
      /** 文本输出完毕到开始触发工具调用之间的延迟（ms） */
      toolDelayMs?: number;
      streamChunkSize?: number;
      streamChunkDelayMs?: number;
    }
  | {
      type: "error";
      error: Error | string;
      /** 报错前的延迟（ms），模拟网络超时后断开 */
      delayMs?: number;
    }
  | {
      type: "thinking";
      thinkingChunks: string[];
      /** 思考结束后还有正文 chunks（可选） */
      contentChunks?: string[];
      chunkDelayMs?: number;
      ttftMs?: number;
    }
  | {
      /** 既不 complete 也不 error，Promise 永不 resolve（mock 无限 pending） */
      type: "pending";
      delayMs?: number;
    }
  | {
      /** 动态 tool_calls：从请求参数中解析 tool call（如从用户消息提取 URL） */
      type: "dynamic_tool_calls";
      /** 解析函数，返回要调用的 tool calls 列表 */
      resolve: (params: { messages: any[] }) => ToolCallSpec[];
      /** 返回前的延迟（ms） */
      delayMs?: number;
    };

// ─── 脚本化 request ───────────────────────────────────────────────────────────

/**
 * 根据 steps 脚本，按顺序响应每次 LLM 调用。
 *
 * 用法：
 *   const req = makeScriptedRequest([
 *     { type: "tool_calls", calls: [...] },   // 第 1 次调用 → 返回工具
 *     { type: "error", error: new Error("Network error"), delayMs: 500 }, // 第 2 次 → 报错
 *     { type: "pending" }, // 第 3 次 → 流挂起（如重试后的下一请求）
 *   ]);
 *
 * steps 耗尽后，默认循环最后一步（可通过 loop 参数控制）。
 */
export function makeScriptedRequest(
  steps: MockStep[],
  options: { loop?: boolean } = {}
): RequestAsStreamFn {
  const { loop = false } = options;
  let callIndex = 0;

  return async (params) => {
    const idx = loop ? callIndex % steps.length : Math.min(callIndex, steps.length - 1);
    callIndex++;
    const step = steps[idx];

    if (step.type === "error") {
      await delay(step.delayMs ?? 0);
      params.emits.error(
        typeof step.error === "string" ? new Error(step.error) : step.error
      );
      return;
    }

    if (step.type === "pending") {
      await delay(step.delayMs ?? 0);
      await new Promise<void>(() => {
        /* 永不 resolve，模拟 SSE 不结束 */
      });
      return;
    }

    if (step.type === "content") {
      await delay(step.ttftMs ?? 0);
      for (const chunk of step.chunks) {
        await delay(step.chunkDelayMs ?? 40);
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    if (step.type === "thinking") {
      await delay(step.ttftMs ?? 0);
      for (const chunk of step.thinkingChunks) {
        await delay(step.chunkDelayMs ?? 40);
        params.emits.onThinking?.(chunk);
      }
      for (const chunk of step.contentChunks ?? []) {
        await delay(step.chunkDelayMs ?? 40);
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    if (step.type === "content_then_tool_calls") {
      await delay(step.ttftMs ?? 0);
      for (const chunk of step.chunks) {
        await delay(step.chunkDelayMs ?? 40);
        params.emits.write(chunk);
      }
      await delay(step.toolDelayMs ?? 0);

      const streamChunkSize = step.streamChunkSize ?? 4;
      const streamChunkDelayMs = step.streamChunkDelayMs ?? 20;
      for (const call of step.calls) {
        const argsStr = JSON.stringify(call.args);
        params.emits.onToolCallStream?.({ index: 0, id: call.id, name: call.name, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += streamChunkSize) {
          await delay(streamChunkDelayMs);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + streamChunkSize) });
        }
      }

      params.emits.onToolCalls?.(step.calls);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }

    if (step.type === "tool_calls") {
      await delay(step.delayMs ?? 0);
      const streamChunkSize = step.streamChunkSize ?? 4;
      const streamChunkDelayMs = step.streamChunkDelayMs ?? 20;

      // 模拟流式 tool_call 输出（逐字符展示参数）
      for (const call of step.calls) {
        const argsStr = JSON.stringify(call.args);
        params.emits.onToolCallStream?.({ index: 0, id: call.id, name: call.name, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += streamChunkSize) {
          await delay(streamChunkDelayMs);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + streamChunkSize) });
        }
      }

      params.emits.onToolCalls?.(step.calls);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }

    if (step.type === "dynamic_tool_calls") {
      await delay(step.delayMs ?? 0);

      // 从请求参数中动态解析 tool calls
      const calls = step.resolve({ messages: params.messages ?? [] });
      if (calls.length === 0) {
        // 如果解析失败，返回空回复
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      // 模拟流式 tool_call 输出（逐字符展示参数）
      for (const call of calls) {
        const argsStr = JSON.stringify(call.args);
        params.emits.onToolCallStream?.({ index: 0, id: call.id, name: call.name, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 4) {
          await delay(20);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 4) });
        }
      }

      params.emits.onToolCalls?.(calls);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }
  };
}

/**
 * 永远只返回同一个 content 的简单 mock（方便快速调试）
 */
export function makeSimpleRequest(content: string, delayMs = 800): RequestAsStreamFn {
  return makeScriptedRequest([
    {
      type: "content",
      chunks: content.match(/.{1,10}/g) ?? [content],
      ttftMs: delayMs,
      chunkDelayMs: 30,
    },
  ]);
}
