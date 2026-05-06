import type { TestCase } from "./types";
import type { Tool } from "@agent/types";
import { ToolValidationError } from "@agent/types";
import { makeScriptedRequest } from "../lib/scripted-request";

/** 与 mock LLM 的 tool_calls.name 一致 */
export const PLAYGROUND_SLOW_TOOL_NAME = "playground_slow_action";

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
