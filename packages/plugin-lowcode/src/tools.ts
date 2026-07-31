import type { Tool } from "../../agent/src";
import type { LowCodeDesignerRuntime, LowCodeOperatorParams } from "./designer";
import { getComponentDoc, getFocusTarget } from "./designer";
import { buildLowCodeRetrievedContext } from "./outline";
import { normalizeDesignerActions } from "./action-normalizer";

export const LOWCODE_GET_PROJECT_CONTEXT_TOOL_NAME = "lowcode_get_project_context";
export const LOWCODE_GET_COMPONENT_DOC_TOOL_NAME = "lowcode_get_component_doc";
export const LOWCODE_OPERATOR_TOOL_NAME = "lowcode_operator";

export interface LowCodeToolOptions {
  runtime: LowCodeDesignerRuntime;
  onOperatorActions?: (params: LowCodeOperatorParams) => void;
}

function requireApi(runtime: LowCodeDesignerRuntime) {
  if (!runtime.api) {
    throw new Error("LowCode designer api is not ready. It should be provided by contributes.aiService.init(api).");
  }
  return runtime.api;
}

function printDesignerAction(kind: string, params: any[]): void {
  console.log(`[plugin-lowcode] designer.${kind}`, {
    params,
  });
}

function createPageId(): string {
  return `page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function executeCreatePage(runtime: LowCodeDesignerRuntime): Promise<any> {
  const api = requireApi(runtime);
  const pageId = createPageId();
  const title = "未命名页面";
  printDesignerAction("createPage", [pageId, title, undefined]);
  return api.page?.api?.createPage?.(pageId, title);
}

async function executeDeletePage(runtime: LowCodeDesignerRuntime): Promise<any> {
  const api = requireApi(runtime);
  const focusTarget = getFocusTarget(runtime.focus);
  const pageId = focusTarget?.pageId ?? focusTarget?.id;
  if (!pageId) throw new Error("clearPage requires focused page.");

  const clearPageContent = api.page?.api?.clearPageContent;
  if (!clearPageContent) {
    throw new Error("Designer api.page.api.clearPageContent is not available.");
  }

  printDesignerAction("clearPageContent", [pageId]);
  return clearPageContent(pageId);
}

function getTarget(runtime: LowCodeDesignerRuntime, params: LowCodeOperatorParams) {
  const focusTarget = getFocusTarget(runtime.focus);
  const targetId = params.targetId?.trim();
  if (!targetId) return focusTarget;

  const targetType = focusTarget?.id === targetId
    ? focusTarget.type
    : runtime.focus?.comId === targetId
      ? "uiCom"
      : "page";

  return {
    type: targetType,
    id: targetId,
    pageId: targetType === "page" ? targetId : focusTarget?.pageId,
    title: focusTarget?.id === targetId ? focusTarget.title : undefined,
  };
}

async function executeOperator(runtime: LowCodeDesignerRuntime, params: LowCodeOperatorParams): Promise<any> {
  const api = requireApi(runtime);
  const target = getTarget(runtime, params);
  const targetPageId = target?.type === "uiCom" ? target.pageId : target?.pageId ?? target?.id;
  const designerActions = normalizeDesignerActions(params.actions ?? [], { pageId: targetPageId });

  if (params.kind === "createPage") {
    return executeCreatePage(runtime);
  }

  if (params.kind === "clearPage") {
    if (target?.id) {
      const pageId = target.pageId ?? target.id;
      const clearPageContent = api.page?.api?.clearPageContent;
      if (!clearPageContent) {
        throw new Error("Designer api.page.api.clearPageContent is not available.");
      }
      printDesignerAction("clearPageContent", [pageId]);
      return clearPageContent(pageId);
    }
    return executeDeletePage(runtime);
  }

  if (params.kind !== "updatePage") {
    throw new Error(`Unsupported lowcode operator kind: ${params.kind}`);
  }

  if (target?.type === "uiCom" && target.id) {
    const comId = target.id;
    printDesignerAction("updateCom", [comId, [], "start"]);
    await api.uiCom?.api?.updateCom?.(comId, [], "start");
    try {
      printDesignerAction("updateCom", [comId, designerActions, "ing"]);
      const result = await api.uiCom?.api?.updateCom?.(comId, designerActions, "ing");
      printDesignerAction("updateCom", [comId, [], "complete"]);
      await api.uiCom?.api?.updateCom?.(comId, [], "complete");
      runtime.focus?.onProgress?.("complete");
      return result;
    } catch (error) {
      printDesignerAction("updateCom", [comId, [], "error"]);
      await api.uiCom?.api?.updateCom?.(comId, [], "error");
      throw error;
    }
  }

  const pageId = targetPageId;
  if (pageId) {
    printDesignerAction("updatePage", [pageId, [], "start"]);
    await api.page?.api?.updatePage?.(pageId, [], "start");
    try {
      printDesignerAction("updatePage", [pageId, designerActions, "ing"]);
      const result = await api.page?.api?.updatePage?.(pageId, designerActions, "ing");
      printDesignerAction("updatePage", [pageId, [], "complete"]);
      await api.page?.api?.updatePage?.(pageId, [], "complete");
      runtime.focus?.onProgress?.("complete");
      return result;
    } catch (error) {
      printDesignerAction("updatePage", [pageId, [], "error"]);
      await api.page?.api?.updatePage?.(pageId, [], "error");
      throw error;
    }
  }

  throw new Error("lowcode_operator requires targetId or focused page/UI component.");
}

export function createLowCodeComponentDocTool(runtime: LowCodeDesignerRuntime): Tool {
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
      name: LOWCODE_OPERATOR_TOOL_NAME,
      title: "执行低代码操作",
      description: "执行 MyBricks UI 页面操作。kind 只包含 updatePage/createPage/clearPage；clearPage 会在内部调用 clearPageContent，status、title 和具体底层 API 由工具内部处理。",
      parameters: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["updatePage", "createPage", "clearPage"],
            description: "页面操作类型。updatePage 会根据 targetId/current focus 在内部选择 updatePage 或 updateCom。",
          },
          targetId: {
            type: "string",
            description: "目标页面 id 或 UI 组件 id。没有可靠 focus 时必填；更新页面根内容时传页面 id。",
          },
          actions: {
            type: "array",
            description: "设计器 actions 列表。仅 updatePage 需要。推荐对象格式 {comId,type,target,params}；也兼容旧 tuple 格式 [comId,target,type,params] 或 JSON 字符串，执行前会自动格式化和 jsonrepair。",
            items: {
              anyOf: [
                { type: "object" },
                { type: "array" },
                { type: "string" },
              ],
            },
          },
        },
        required: ["kind"],
      },
      async execute(params: LowCodeOperatorParams) {
        console.log("[plugin-lowcode] lowcode_operator", params);
        onOperatorActions?.(params);
        const result = await executeOperator(runtime, params);
        return {
          output: JSON.stringify({ ok: true, result: result ?? null }, null, 2),
          metadata: { params, result },
        };
      },
    },
  ];
}
