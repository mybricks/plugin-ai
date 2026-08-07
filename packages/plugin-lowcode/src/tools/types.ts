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

/** A self-contained page generation or update task. */
export interface LowCodeGeneratePageTask {
  /** Optional caller-provided identifier used to correlate the result. */
  id?: string;
  /** Optional human-readable task name shown in the task result. */
  name?: string;
  mode: "create" | "update";
  /** Complete task requirement; never inferred from the parent conversation. */
  prompt: string;
  /** Required for update when there is no reliable designer focus. */
  targetId?: string;
  /** Page title used when mode is create. */
  title?: string;
}

/** A batch of independent page tasks executed in parallel. */
export interface LowCodeGeneratePageParams {
  tasks: LowCodeGeneratePageTask[];
}

/** Internal params for the designer create-page API. */
export interface LowCodeCreatePageParams {
  title?: string;
}

export interface LowCodeClearPageParams {
  targetId?: string;
}
