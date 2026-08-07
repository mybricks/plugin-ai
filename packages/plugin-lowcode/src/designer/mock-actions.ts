import type { LowCodeDesignerAPI, LowCodeDesignerRuntime } from "../designer";
import { normalizeDesignerActions } from "./action-normalizer";
import { getComlibsDocs } from "../project";
import { activeDSL, canonicalToExecutionAction } from "../dsl";

type MockActionsInput = any[] | string;

function parseMockActions(actions: MockActionsInput): any[] {
  if (typeof actions !== "string") return actions;

  const raw = actions.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [parsed];
    return Array.isArray(parsed[0]) || typeof parsed[0] === "object" ? parsed : [parsed];
  } catch {
    return activeDSL.parseContent(raw).map(canonicalToExecutionAction);
  }
}

async function executePageActionsWithDelay(
  api: LowCodeDesignerAPI,
  pageId: string,
  actions: any[],
  delay = 5,
) {
  const updatePage = api.page?.api?.updatePage;
  if (!updatePage) {
    throw new Error("Designer api.page.api.updatePage is not available.");
  }

  await updatePage(pageId, [], "start");

  try {
    for (const action of actions) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      await updatePage(pageId, [action], "ing");
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await updatePage(pageId, [], "complete");
  } catch (error) {
    await updatePage(pageId, [], "error");
    throw error;
  }
}

export function registerLowCodeMockActions(runtime: LowCodeDesignerRuntime): void {
  if (typeof window === "undefined") return;
  const api = runtime.api;
  if (!api) return;

  (window as any).forPageCreate = async (pageId: string, actions: MockActionsInput, delay = 5) => {
    if (!pageId || typeof pageId !== "string") {
      throw new Error("window.forPageCreate(pageId, actions, delay?) requires a pageId string.");
    }
    if (!actions) {
      throw new Error("window.forPageCreate(pageId, actions, delay?) requires actions.");
    }

    const parsedActions = parseMockActions(actions);
    const normalizedActions = normalizeDesignerActions(parsedActions, { pageId });
    console.log("[plugin-lowcode] window.forPageCreate actions", normalizedActions);
    await executePageActionsWithDelay(api, pageId, normalizedActions, delay);
    return {
      ok: true,
      pageId,
      actionCount: normalizedActions.length,
    };
  };

  (window as any).getLowCodeComponentPrompts = () => {
    const prompts = getComlibsDocs(runtime);
    console.log("[plugin-lowcode] window.getLowCodeComponentPrompts", prompts);
    return prompts;
  };

  console.log("[plugin-lowcode] window.getLowCodeComponentPrompts() registered");
}
