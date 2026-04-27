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
