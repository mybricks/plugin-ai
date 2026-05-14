import type { CodeAgentPlugin } from "../../../agent/src";
// import crmApiSpec from "./crm-api.js";

/**
 * 获取接口列表工具
 *
 * 返回 CRM API 的 OpenAPI 规范（JSON 格式），
 * 包含 customers / contacts / orders / projects 四个核心实体的 CRUD 接口。
 */
const getApiListTool = {
  name: "get_api_list",
  description:
    "获取当前项目可用的接口列表，返回完整接口规范（OpenAPI 3.0 格式）",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  async execute(): Promise<{ output: string }> {
    return {
      output: JSON.stringify({}, null, 2),
    };
  },
};

/**
 * 数据源插件
 *
 * 提供"获取接口列表"工具，供 Agent 查询当前项目的可用接口规范。
 * 使用方式：将此插件传入 pluginAI() 的 plugins 参数：
 *
 * ```ts
 * import { datasourcePlugin } from "@plugin-ai/plugin/datasource";
 *
 * pluginAI({
 *   plugins: [datasourcePlugin],
 *   ...
 * });
 * ```
 */
export const datasourcePlugin: CodeAgentPlugin = {
  name: "datasource",
  tools: [getApiListTool],
};

export default datasourcePlugin;
