import type { LowCodeDesignerRuntime, LowCodeOperatorParams } from "../designer";

export interface LowCodeToolOptions {
  runtime: LowCodeDesignerRuntime;
  onOperatorActions?: (params: LowCodeOperatorParams) => void;
  /** Whether addChild actions may pass ignore/enhance to the designer. Disabled by default. */
  enableRenderingOptimization?: boolean;
}

export interface LowCodeOperatorSummary {
  ok: true;
  kind: "createPage" | "clearPage" | "updatePage" | "updateCom";
  targetId?: string;
  pageId?: string;
  actionCount?: number;
  title?: string;
}

export interface LowCodeUpdatePageParams {
  targetId?: string;
}

export interface LowCodeCreatePageParams {
  title?: string;
}

export interface LowCodeClearPageParams {
  targetId?: string;
}
