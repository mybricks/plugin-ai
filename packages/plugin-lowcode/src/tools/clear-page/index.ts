import type { Tool } from "../../../../agent/src";
import { ToolValidationError } from "../../../../agent/src/types";
import { executeClearPageWithParams, summarizeToolResult } from "../../designer/execution";
import { LOWCODE_CLEAR_PAGE_TOOL_NAME } from "../constants";
import type { LowCodeClearPageParams, LowCodeToolOptions } from "../types";

export function createLowCodeClearPageTool(runtime: LowCodeToolOptions["runtime"]): Tool {
  return {
    name: LOWCODE_CLEAR_PAGE_TOOL_NAME,
    title: "清空页面",
    description: "清空指定页面的内容。不会删除页面记录。",
    parameters: {
      type: "object",
      properties: { targetId: { type: "string", description: "必须传入要清空的页面 id。" } },
      required: ["targetId"],
    },
    validate(params: LowCodeClearPageParams = {}) {
      if (typeof params.targetId !== "string" || !params.targetId.trim()) {
        throw new ToolValidationError("lowcode_clear_page requires a non-empty targetId.");
      }
    },
    async execute(params: LowCodeClearPageParams = {}) {
      return summarizeToolResult(await executeClearPageWithParams(runtime, params));
    },
  };
}
