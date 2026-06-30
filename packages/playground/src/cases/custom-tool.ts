import React from "react";
import type { TestCase } from "./types";
import type { Tool } from "@agent/types";
import { ToolValidationError } from "@agent/types";
import { makeScriptedRequest } from "../lib/scripted-request";

/** 与 mock LLM 的 tool_calls.name 一致 */
export const PLAYGROUND_SLOW_TOOL_NAME = "playground_slow_action";
export const PLAYGROUND_RENDER_ERROR_TEXT_TOOL_NAME = "playground_render_error_text";
export const PLAYGROUND_RENDER_THROW_TOOL_NAME = "playground_render_throw";
export const PLAYGROUND_LARGE_OUTPUT_TOOL_NAME = "playground_large_output";

/**
 * Playground 注入的自定义工具：execute 内延迟，Tool.title 用于工具卡片标题展示。
 */
export function createPlaygroundSlowTool(delayMs = 2500): Tool {
  return {
    name: PLAYGROUND_SLOW_TOOL_NAME,
    title: "Playground 慢任务",
    description: `Playground 专用：模拟耗时操作。执行会阻塞约 ${delayMs}ms，用于观察工具卡片的 loading 与完成态；title 会展示在工具卡片上。`,
    parameters: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "任务标签，会拼进返回的 metadata",
        },
      },
      required: ["label"],
    },
    validate(params: { label?: string }) {
      if (!params.label || typeof params.label !== "string" || !params.label.trim()) {
        throw new ToolValidationError("label is required");
      }
    },
    async execute(params: { label: string }) {
      await new Promise((r) => setTimeout(r, delayMs));
      return {
        output: `[${PLAYGROUND_SLOW_TOOL_NAME}] 已完成：${params.label}（模拟耗时 ${delayMs}ms）`,
        metadata: { label: params.label, delayMs },
      };
    },
  };
}

/**
 * 自定义 renderer 直接消费 tool.error，用来验证实时态和历史态 error 都是字符串。
 */
export function createPlaygroundRenderErrorTextTool(): Tool {
  return {
    name: PLAYGROUND_RENDER_ERROR_TEXT_TOOL_NAME,
    title: "自定义错误展示",
    description: "Playground 专用：execute 抛错，自定义 render 直接展示 tool.error。",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "用于拼接错误文案",
        },
      },
      required: ["reason"],
    },
    async execute(params: { reason: string }) {
      throw new Error(`自定义工具执行失败：${params.reason}`);
    },
    render(tool) {
      return React.createElement(
        "div",
        {
          style: {
            display: "flex",
            gap: 8,
            alignItems: "center",
            color: tool.status === "error" ? "#c0392b" : undefined,
          },
        },
        React.createElement("span", null, tool.status === "pending" ? "自定义错误展示执行中..." : "自定义错误展示"),
        tool.error ? React.createElement("code", null, String(tool.error)) : null
      );
    },
  };
}

/**
 * 自定义 renderer 故意把 tool 对象作为 React child 渲染，触发 React render error。
 * 预期由 ToolRendererErrorBoundary 兜底为 DefaultToolRenderer。
 */
export function createPlaygroundRenderThrowTool(): Tool {
  return {
    name: PLAYGROUND_RENDER_THROW_TOOL_NAME,
    title: "自定义渲染报错",
    description: "Playground 专用：execute 成功，但自定义 render 故意渲染对象触发 React 错误。",
    parameters: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "任务标签",
        },
      },
      required: ["label"],
    },
    async execute(params: { label: string }) {
      return {
        output: `[${PLAYGROUND_RENDER_THROW_TOOL_NAME}] 已完成：${params.label}`,
        metadata: { label: params.label },
      };
    },
    render(tool) {
      return React.createElement("div", null, tool as any);
    },
  };
}

/**
 * 返回指定长度的 ASCII output，用于验证 agent 层通用工具输出 token 限制。
 */
export function createPlaygroundLargeOutputTool(): Tool {
  return {
    name: PLAYGROUND_LARGE_OUTPUT_TOOL_NAME,
    title: "大输出工具",
    description: "Playground 专用：返回指定长度的 ASCII 内容，用于测试通用工具输出限制。",
    parameters: {
      type: "object",
      properties: {
        length: {
          type: "number",
          description: "返回内容长度",
        },
      },
      required: ["length"],
    },
    validate(params: { length?: number }) {
      if (typeof params.length !== "number" || params.length < 0) {
        throw new ToolValidationError("length must be a non-negative number");
      }
    },
    async execute(params: { length: number }) {
      return {
        output: "x".repeat(params.length),
        metadata: { length: params.length },
      };
    },
  };
}

export const customToolRendererErrorBoundaryCase: TestCase = {
  id: "custom-tool-renderer-error-boundary",
  name: "自定义工具渲染容错",
  group: "工具调用",
  priority: "P0",
  description:
    "验证自定义工具 render 的错误链路：一个工具 execute 抛错并由 render 直接展示 tool.error，另一个工具 render 自己抛 React 渲染错误并降级到默认工具卡片。",
  expectedBehavior:
    "第一个工具卡片展示字符串错误 '自定义工具执行失败：render-visible-error'；第二个自定义 renderer 抛错后不影响消息列表，降级显示默认工具卡片「自定义渲染报错」；控制台有 ToolRenderer fallback warning，最终 AI 正常继续回复。",
  initialTurns: [],
  tools: [
    createPlaygroundRenderErrorTextTool(),
    createPlaygroundRenderThrowTool(),
  ],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_render_error_text",
            name: PLAYGROUND_RENDER_ERROR_TEXT_TOOL_NAME,
            args: { reason: "render-visible-error" },
          },
        ],
        delayMs: 300,
      },
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_render_throw",
            name: PLAYGROUND_RENDER_THROW_TOOL_NAME,
            args: { label: "fallback-check" },
          },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: [
          "自定义工具渲染容错验证完成。",
          "错误展示工具已把 tool.error 渲染出来，渲染报错工具已走默认兜底。",
        ],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

export const customToolOutputLimitPassCase: TestCase = {
  id: "custom-tool-output-limit-pass",
  name: "通用工具输出限制（未超出）",
  group: "工具调用",
  description:
    "自定义工具返回 99996 个 ASCII 字符，粗略估算约 24999 tokens，低于 25000 的通用工具输出限制。",
  expectedBehavior:
    "大输出工具卡片为成功状态；下一轮 LLM 正常回复「未超出限制」。",
  initialTurns: [],
  tools: [createPlaygroundLargeOutputTool()],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_large_output_pass",
            name: PLAYGROUND_LARGE_OUTPUT_TOOL_NAME,
            args: { length: 99_996 },
          },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: ["未超出通用工具输出限制，工具结果已正常传递。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

export const customToolOutputLimitExceededCase: TestCase = {
  id: "custom-tool-output-limit-exceeded",
  name: "通用工具输出限制（超出）",
  group: "工具调用",
  description:
    "自定义工具返回 100004 个 ASCII 字符，粗略估算约 25001 tokens，超过 25000 的通用工具输出限制。",
  expectedBehavior:
    "大输出工具卡片为 error 状态，错误信息包含 'exceeds the 25000 token limit' 和 estimated token 数；下一轮 LLM 基于错误继续回复。",
  initialTurns: [],
  tools: [createPlaygroundLargeOutputTool()],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_large_output_exceeded",
            name: PLAYGROUND_LARGE_OUTPUT_TOOL_NAME,
            args: { length: 100_004 },
          },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: ["工具输出已被通用限制拦截，请缩小返回范围。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/**
 * 工具参数校验失败 → LLM 重试 → 第二轮接口返回极慢（等待工具参数流式传输）。
 *
 * 流程：
 *  1. 第一次调用 playground_slow_action，label 为空字符串 → validate 抛出 ToolValidationError
 *  2. LLM 收到错误后发起第二次请求，但接口响应极慢：工具参数 argsChunk 逐字符缓慢流出，
 *     模拟 LLM 接口长时间才返回完整工具调用参数的场景。
 *  3. 此期间用户可在 UI 上测试取消操作
 */
export const customToolValidationErrorThenSlowStreamCase: TestCase = {
  id: "custom-tool-validation-error-then-slow-stream",
  name: "参数校验失败 → 重试 → 接口返回极慢",
  group: "工具调用",
  description:
    "第一次调用参数校验失败（label 为空），LLM 重试时接口返回极慢（工具参数逐字符缓慢流出约 15s），用于测试 loading 期间是否可取消。",
  expectedBehavior:
    "第一个工具卡片红色，显示 'label is required' 错误；第二轮请求进入长时间等待（约 15s），工具参数缓慢流式传输，期间可点击取消按钮中断。",
  initialTurns: [],
  tools: [createPlaygroundSlowTool(2500)],
  request: async (params) => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    // 使用外部 callIndex 计数器区分每次请求
    // 这里无法用闭包变量，因为 request 函数每次调用都是独立的
    // 但 TestCase 的 request 是 RequestAsStreamFn，会被 agent 按轮次调用
    // 需要用 static 变量来计数
    customToolValidationErrorThenSlowStreamCase_callIndex++;
    const idx = customToolValidationErrorThenSlowStreamCase_callIndex;
    // 循环：奇数次→参数校验失败，偶数次→接口返回极慢
    const stepIdx = (idx - 1) % 2;

    if (stepIdx === 0) {
      // 第一次请求：参数校验失败（label 为空）
      await delay(400);
      const argsObj = { label: "" };
      const argsStr = JSON.stringify(argsObj);
      params.emits.onToolCallStream?.({
        index: 0,
        id: "c_slow_err",
        name: PLAYGROUND_SLOW_TOOL_NAME,
        argsChunk: "",
      });
      for (let i = 0; i < argsStr.length; i += 4) {
        await delay(20);
        params.emits.onToolCallStream?.({
          index: 0,
          argsChunk: argsStr.slice(i, i + 4),
        });
      }
      params.emits.onToolCalls?.([
        { id: "c_slow_err", name: PLAYGROUND_SLOW_TOOL_NAME, args: argsObj },
      ]);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }

    if (stepIdx === 1) {
      // 第二次请求：接口返回极慢，工具参数逐字符缓慢流出（约 15s）
      const argsObj = { label: "长时间等待重试" };
      const argsStr = JSON.stringify(argsObj);

      // 模拟 LLM 接口极慢：每个 4 字符 chunk 间隔约 1s，总耗时 ≈ 15s
      await delay(300);
      params.emits.onToolCallStream?.({
        index: 0,
        id: "c_slow_retry",
        name: PLAYGROUND_SLOW_TOOL_NAME,
        argsChunk: "",
      });
      for (let i = 0; i < argsStr.length; i += 4) {
        await delay(1000); // 每个字符块间隔 1s，模拟接口极慢
        params.emits.onToolCallStream?.({
          index: 0,
          argsChunk: argsStr.slice(i, i + 4),
        });
      }
      params.emits.onToolCalls?.([
        { id: "c_slow_retry", name: PLAYGROUND_SLOW_TOOL_NAME, args: argsObj },
      ]);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }
  },
};

/** 静态计数器，用于 customToolValidationErrorThenSlowStreamCase 区分请求轮次 */
let customToolValidationErrorThenSlowStreamCase_callIndex = 0;

export const customSlowToolCase: TestCase = {
  id: "custom-tool-slow-loading",
  name: "自定义工具（loading / 完成）",
  group: "工具调用",
  description:
    "注入 playground_slow_action：execute 内延迟约 2.5s，Tool.title 设为「Playground 慢任务」，可观察工具卡片 loading 与成功结束。",
  expectedBehavior:
    "工具卡片先显示执行中（loading），标题为「Playground 慢任务」，约 2.5s 后变绿成功结束，随后 LLM 继续流式回复。",
  initialTurns: [],
  tools: [createPlaygroundSlowTool(2500)],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_slow_1",
            name: PLAYGROUND_SLOW_TOOL_NAME,
            args: { label: "预热检查" },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: [
          "自定义工具已执行完毕。",
          "工具卡片标题为「Playground 慢任务」，可见 loading 到完成的过渡。",
        ],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};
