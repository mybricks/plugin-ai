export type LowCodeActionStatus = "start" | "ing" | "complete" | "error" | string;

export interface LowCodeFocusParams {
  pageId?: string;
  comId?: string;
  title?: string;
  type?: "page" | "uiCom" | "section" | string;
  focusArea?: {
    selector?: string;
    title?: string;
    ele?: HTMLElement;
  };
  onProgress?: (status: LowCodeActionStatus) => void;
  [key: string]: any;
}

export interface LowCodeRequestParams {
  message?: string;
  attachments?: Array<{
    type: string;
    content?: string;
    url?: string;
    title?: string;
    size?: number;
    [key: string]: any;
  }>;
  onProgress?: (status: LowCodeActionStatus) => void;
  meta?: Record<string, any>;
  [key: string]: any;
}

export interface LowCodeDesignerAPI {
  global?: {
    title?: string;
    api?: {
      getAllPageInfo?: () => any;
      getAllComDefPrompts?: () => string;
      getComEditorPrompts?: (...params: any[]) => string;
    };
  };
  page?: {
    title?: string;
    api?: {
      createCanvas?: () => Promise<any> | any;
      createPage?: (id: string | null, title: string, config?: any) => Promise<any> | any;
      updatePage?: (pageId: string, actions: any[], status?: LowCodeActionStatus) => Promise<any> | any;
      clearPageContent?: (pageId: string) => Promise<any> | any;
      getOutlineInfo?: (...params: any[]) => any;
      getPageDSLPrompts?: (...params: any[]) => string;
      getPageContainerPrompts?: (...params: any[]) => string;
      getPageOnProcess?: (...params: any[]) => any;
    };
  };
  uiCom?: {
    title?: string;
    api?: {
      updateCom?: (comId: string, actions: any[], status?: LowCodeActionStatus) => Promise<any> | any;
      getOutlineInfo?: (...params: any[]) => any;
      getComPrompts?: (...params: any[]) => string;
      getComDSLPrompts?: (...params: any[]) => string;
      getComEditorPrompts?: (...params: any[]) => string;
      getComOnProcess?: (...params: any[]) => any;
    };
  };
}

export interface LowCodeDesignerRuntime {
  api?: LowCodeDesignerAPI;
  focus?: LowCodeFocusParams;
}

export interface LowCodeOperatorParams {
  /**
   * UI designer update params.
   * - kind is a page-level intention exposed to the model.
   * - targetId is the page id or UI component id to operate on.
   * - updatePage actions should be MyBricks object actions: { comId, type, target, params }
   * - legacy tuple actions [comId, target, type, params] are accepted and normalized before execution.
   * - status is managed internally by pluginLowCodeAI.
   */
  kind: "updatePage" | "createPage" | "clearPage";
  targetId?: string;
  actions?: any[];
}

export function getFocusTarget(focus?: LowCodeFocusParams): { type: string; id: string; pageId?: string; title?: string } | null {
  if (!focus) return null;
  const type = focus.type ?? (focus.comId ? "uiCom" : "page");
  const id = type === "page" || type === "section"
    ? focus.pageId
    : focus.comId ?? focus.pageId;
  if (!id) return null;
  return { type, id, pageId: focus.pageId, title: focus.title };
}
