import type { Tool } from "../../../../agent/src";
import { getComponentsDocs } from "../../project";
import { LOWCODE_GET_COMPONENT_DOC_TOOL_NAME } from "../constants";
import type { LowCodeToolOptions } from "../types";

export function createLowCodeComponentDocTool(runtime: LowCodeToolOptions["runtime"]): Tool {
  return {
    name: LOWCODE_GET_COMPONENT_DOC_TOOL_NAME,
    title: "读取组件规范",
    description: "根据组件 namespace 读取 MyBricks 组件编辑文档，用于生成 doConfig/addChild actions。",
    parameters: { type: "object", properties: { namespace: { type: "string", description: "组件 namespace。" } }, required: ["namespace"] },
    async execute(params: { namespace: string }) {
      const doc = getComponentsDocs(runtime, params.namespace);
      return { output: doc || `未找到组件 ${params.namespace} 的编辑文档。` };
    },
  };
}
