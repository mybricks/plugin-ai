import type { LowCodeDesignerRuntime, LowCodeOperatorParams } from "../designer";
import { getFocusTarget } from "../designer";
import { normalizeDesignerActions } from "../action-normalizer";
import type {
  LowCodeClearPageParams,
  LowCodeCreatePageParams,
  LowCodeOperatorSummary,
} from "./types";

interface UpdatePageActionSession {
  execute(action: any): Promise<any>;
  complete(): Promise<LowCodeOperatorSummary>;
  error(): Promise<void>;
  readonly actionCount: number;
}

export function requireApi(runtime: LowCodeDesignerRuntime) {
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

async function executeDesignerActions(
  kind: "updatePage" | "updateCom",
  update: (actions: any[], status: "start" | "ing" | "complete" | "error") => Promise<any> | any,
  targetId: string,
  actions: any[],
): Promise<LowCodeOperatorSummary> {
  printDesignerAction(kind, [targetId, [], "start"]);
  await update([], "start");
  try {
    for (const action of actions) {
      printDesignerAction(kind, [targetId, [action], "ing"]);
      await update([action], "ing");
    }
    printDesignerAction(kind, [targetId, [], "complete"]);
    await update([], "complete");
    return {
      ok: true,
      kind,
      targetId,
      actionCount: actions.length,
    };
  } catch (error) {
    printDesignerAction(kind, [targetId, [], "error"]);
    await update([], "error");
    throw error;
  }
}

export async function executeCreatePageWithParams(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeCreatePageParams = {},
): Promise<LowCodeOperatorSummary> {
  const api = requireApi(runtime);
  const pageId = createPageId();
  const title = params.title?.trim() || "未命名页面";
  printDesignerAction("createPage", [pageId, title, undefined]);
  await api.page?.api?.createPage?.(pageId, title);
  return {
    ok: true,
    kind: "createPage",
    pageId,
    title,
  };
}

export async function executeClearPageWithParams(
  runtime: LowCodeDesignerRuntime,
  params: LowCodeClearPageParams = {},
): Promise<LowCodeOperatorSummary> {
  const api = requireApi(runtime);
  const target = getTargetById(runtime, params.targetId);
  const pageId = target?.pageId ?? target?.id;
  if (!pageId) throw new Error("lowcode_clear_page requires targetId or focused page.");

  const clearPageContent = api.page?.api?.clearPageContent;
  if (!clearPageContent) {
    throw new Error("Designer api.page.api.clearPageContent is not available.");
  }

  printDesignerAction("clearPageContent", [pageId]);
  await clearPageContent(pageId);
  return {
    ok: true,
    kind: "clearPage",
    pageId,
  };
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

export function getTargetById(runtime: LowCodeDesignerRuntime, targetId?: string) {
  return getTarget(runtime, { kind: "updatePage", targetId, actions: [] });
}

export async function executeUpdatePageActions(
  runtime: LowCodeDesignerRuntime,
  targetId: string | undefined,
  actions: any[],
): Promise<LowCodeOperatorSummary> {
  const session = await createUpdatePageActionSession(runtime, targetId);
  try {
    for (const action of actions) {
      await session.execute(action);
    }
    return session.complete();
  } catch (error) {
    await session.error();
    throw error;
  }
}

export async function createUpdatePageActionSession(
  runtime: LowCodeDesignerRuntime,
  targetId: string | undefined,
  enableRenderingOptimization = false,
): Promise<UpdatePageActionSession> {
  const api = requireApi(runtime);
  const target = getTargetById(runtime, targetId);
  const targetPageId = target?.type === "uiCom" ? target.pageId : target?.pageId ?? target?.id;

  let kind: "updatePage" | "updateCom";
  let resolvedTargetId: string;
  let update: (actions: any[], status: "start" | "ing" | "complete" | "error") => Promise<any> | any;

  if (target?.type === "uiCom" && target.id) {
    const comId = target.id;
    const updateCom = api.uiCom?.api?.updateCom;
    if (!updateCom) {
      throw new Error("Designer api.uiCom.api.updateCom is not available.");
    }
    kind = "updateCom";
    resolvedTargetId = comId;
    update = (nextActions, status) => updateCom(comId, nextActions, status);
  } else {
    const pageId = targetPageId;
    if (!pageId) {
      throw new Error("lowcode_update_page requires targetId or focused page/UI component.");
    }
    const updatePage = api.page?.api?.updatePage;
    if (!updatePage) {
      throw new Error("Designer api.page.api.updatePage is not available.");
    }
    kind = "updatePage";
    resolvedTargetId = pageId;
    update = (nextActions, status) => updatePage(pageId, nextActions, status);
  }

  let actionCount = 0;
  let closed = false;
  const componentParamsMap = new Map<string, any>();

  printDesignerAction(kind, [resolvedTargetId, [], "start"]);
  await update([], "start");

  return {
    get actionCount() {
      return actionCount;
    },
    async execute(action: any) {
      if (closed) return;
      const [designerAction] = normalizeDesignerActions([action], {
        pageId: targetPageId,
        componentParamsMap,
        enableRenderingOptimization,
      });
      printDesignerAction(kind, [resolvedTargetId, [designerAction], "ing"]);
      await update([designerAction], "ing");
      actionCount += 1;
      return designerAction;
    },
    async complete() {
      if (!closed) {
        closed = true;
        printDesignerAction(kind, [resolvedTargetId, [], "complete"]);
        await update([], "complete");
        runtime.focus?.onProgress?.("complete");
      }
      return {
        ok: true,
        kind,
        targetId: resolvedTargetId,
        actionCount,
      };
    },
    async error() {
      if (closed) return;
      closed = true;
      printDesignerAction(kind, [resolvedTargetId, [], "error"]);
      await update([], "error");
    },
  };
}

export function summarizeToolResult(summary: LowCodeOperatorSummary) {
  return {
    output: JSON.stringify(summary, null, 2),
    metadata: {
      ok: true,
      kind: summary.kind,
      targetId: summary.targetId,
      pageId: summary.pageId,
      actionCount: summary.actionCount,
      title: summary.title,
    },
  };
}

export function summarizeToolError(kind: string, targetId: string | undefined, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    output: JSON.stringify({
      ok: false,
      kind,
      targetId,
      error: message,
    }, null, 2),
    metadata: {
      ok: false,
      kind,
      targetId,
      error: message,
    },
  };
}
