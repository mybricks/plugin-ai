import type { Tool } from "../../../agent/src";
import type { ToolExecutionContext } from "../../../agent/src/agent";
import { getComponentDoc } from "../designer";
import { buildLowCodeRetrievedContext } from "../outline";
import {
  LOWCODE_CLEAR_PAGE_TOOL_NAME,
  LOWCODE_CREATE_PAGE_TOOL_NAME,
  LOWCODE_GET_COMPONENT_DOC_TOOL_NAME,
  LOWCODE_GET_PROJECT_CONTEXT_TOOL_NAME,
  LOWCODE_UPDATE_PAGE_TOOL_NAME,
} from "./constants";
import {
  createUpdatePageActionSession,
  executeClearPageWithParams,
  executeCreatePageWithParams,
  summarizeToolError,
  summarizeToolResult,
} from "./execution";
import { generateActionsWithSubAgent } from "./update-page-sub-agent";
import type {
  LowCodeClearPageParams,
  LowCodeCreatePageParams,
  LowCodeToolOptions,
  LowCodeUpdatePageParams,
} from "./types";

export function createLowCodeComponentDocTool(runtime: LowCodeToolOptions["runtime"]): Tool {
  return {
    name: LOWCODE_GET_COMPONENT_DOC_TOOL_NAME,
    title: "读取组件规范",
    description: "根据组件 namespace 读取 MyBricks 组件编辑文档，用于生成 doConfig/addChild actions。",
    parameters: {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "组件 namespace。",
        },
      },
      required: ["namespace"],
    },
    async execute(params: { namespace: string }) {
      const doc = getComponentDoc(runtime.api, params.namespace);
      return {
        output: doc || `未找到组件 ${params.namespace} 的编辑文档。`,
      };
    },
  };
}

export function createLowCodeTools(options: LowCodeToolOptions): Tool[] {
  const { runtime, onOperatorActions } = options;

  return [
    {
      name: LOWCODE_GET_PROJECT_CONTEXT_TOOL_NAME,
      title: "检索低代码上下文",
      description: "按页面 id 或 UI 组件 id 检索相关低代码上下文片段。全局页面摘要、可用组件和组件编辑文档已注入稳定上下文，不通过该工具返回。",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "页面 id 或 UI 组件 id。",
          },
          type: {
            type: "string",
            enum: ["page", "uiCom"],
            description: "可选，目标类型。不传时自动推断。",
          },
        },
        required: ["id"],
      },
      async execute(params: { id: string; type?: "page" | "uiCom" }) {
        return {
          output: buildLowCodeRetrievedContext(runtime.api, runtime.focus, params),
        };
      },
    },
    {
      name: LOWCODE_UPDATE_PAGE_TOOL_NAME,
      title: "生成并更新页面",
      limits: { maxToken: false },
      description: "根据当前用户需求生成完整 MyBricks 页面更新 actions 并执行。该工具内部使用专用 subAgent 一次性生成完整 actions，调用时只需传目标，不要手写 actions。",
      parameters: {
        type: "object",
        properties: {
          targetId: {
            type: "string",
            description: "目标页面 id 或 UI 组件 id。没有可靠 focus 时必填；更新页面根内容时传页面 id。",
          },
        },
      },
      async execute(params: LowCodeUpdatePageParams, toolContext: ToolExecutionContext) {
        console.log("[plugin-lowcode] lowcode_update_page", params);
        let session: Awaited<ReturnType<typeof createUpdatePageActionSession>> | undefined;
        try {
          session = await createUpdatePageActionSession(runtime, params.targetId);
          const { actions } = await generateActionsWithSubAgent(runtime, params, toolContext, (action) => session.execute(action));
          onOperatorActions?.({ kind: "updatePage", targetId: params.targetId, actions });
          const summary = await session.complete();
          return summarizeToolResult(summary);
        } catch (error) {
          console.error("[plugin-lowcode] lowcode_update_page error", error);
          await session?.error();
          return summarizeToolError("updatePage", params.targetId, error);
        }
      },
    },
    {
      name: LOWCODE_CREATE_PAGE_TOOL_NAME,
      title: "创建页面",
      description: "创建一个新的 MyBricks 页面。仅负责 createPage，不生成页面内容。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "页面标题。可选，缺省为未命名页面。",
          },
        },
      },
      async execute(params: LowCodeCreatePageParams) {
        console.log("[plugin-lowcode] lowcode_create_page", params);
        try {
          const summary = await executeCreatePageWithParams(runtime, params);
          return summarizeToolResult(summary);
        } catch (error) {
          console.error("[plugin-lowcode] lowcode_create_page error", error);
          return summarizeToolError("createPage", undefined, error);
        }
      },
    },
    {
      name: LOWCODE_CLEAR_PAGE_TOOL_NAME,
      title: "清空页面",
      description: "清空目标页面内容。仅调用 clearPageContent，不删除页面记录。",
      parameters: {
        type: "object",
        properties: {
          targetId: {
            type: "string",
            description: "目标页面 id。可选，缺省时使用当前 focus 页面。",
          },
        },
      },
      async execute(params: LowCodeClearPageParams) {
        console.log("[plugin-lowcode] lowcode_clear_page", params);
        try {
          const summary = await executeClearPageWithParams(runtime, params);
          return summarizeToolResult(summary);
        } catch (error) {
          console.error("[plugin-lowcode] lowcode_clear_page error", error);
          return summarizeToolError("clearPage", params.targetId, error);
        }
      },
    },
  ];
}
