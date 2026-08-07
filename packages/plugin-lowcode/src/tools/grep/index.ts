import type { Tool } from "../../../../agent/src";
import { grepLowCodeContext } from "../../project";
import { LOWCODE_GREP_TOOL_NAME } from "../constants";
import type { LowCodeToolOptions } from "../types";

export function createLowCodeGrepTool(runtime: LowCodeToolOptions["runtime"]): Tool {
  return {
    name: LOWCODE_GREP_TOOL_NAME,
    title: "搜索上下文",
    description: "在当前页面 JSON 的按需行化视图中搜索节点。可用关键词或正则 query，并可叠加明确的页面、组件类型、配置和结构过滤条件；返回 pageId 与可用于 lowcode_read 的真实行号。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "要搜索的关键词或正则表达式。省略时仅按 filters 筛选。" },
        pageId: { type: "string", description: "可选，限定搜索页面。未传时搜索工作区全部页面。" },
        filters: {
          type: "object", description: "可选的明确过滤条件。所有条件同时生效。",
          properties: {
            namespace: { type: "string", description: "组件 namespace，例如 vibe.text。" },
            title: { type: "string", description: "组件标题关键词或正则。" },
            text: { type: "string", description: "在标题、配置、样式和布局中搜索的关键词或正则。" },
            configPath: { type: "string", description: "data 中配置路径的关键词或正则。" },
            configValue: { description: "data 中配置值的精确匹配。" },
            position: { type: "string", enum: ["fixed", "absolute", "relative"] },
            parentId: { type: "string", description: "直接父组件 id。" },
            slotId: { type: "string", description: "所在插槽 id。" },
          },
        },
        before: { type: "number", description: "每个命中前额外返回的行数，默认 1。" },
        after: { type: "number", description: "每个命中后额外返回的行数，默认 1。" },
        limit: { type: "number", description: "最多返回多少个命中，默认 10，最大 50。" },
      },
    },
    async execute(params: any) { return { output: grepLowCodeContext(runtime.api, params) }; },
  };
}
