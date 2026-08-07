import type { Tool } from "../../../../agent/src";
import { readLowCodeContext } from "../../project";
import { LOWCODE_READ_TOOL_NAME } from "../constants";
import type { LowCodeToolOptions } from "../types";

export function createLowCodeReadTool(runtime: LowCodeToolOptions["runtime"]): Tool {
  return {
    name: LOWCODE_READ_TOOL_NAME,
    title: "读取上下文",
    description: "按 lowcode_grep 或 focus-info 给出的 pageId 和逻辑行号，读取当前页面 JSON 的按需渲染片段。",
    parameters: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "页面 id。" },
        startLine: { type: "number", description: "起始行号（含）。" },
        endLine: { type: "number", description: "结束行号（含）。" },
      },
      required: ["pageId", "startLine", "endLine"],
    },
    async execute(params: { pageId: string; startLine: number; endLine: number }) {
      return { output: readLowCodeContext(runtime.api, params) };
    },
  };
}
