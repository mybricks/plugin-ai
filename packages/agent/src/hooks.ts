import type {
  Message,
  Tool,
  ToolCallRecord,
  ToolResult,
  TurnRecord,
} from "./types";

/** 自动摘要任务的最终结果。 */
export type TurnSummaryResult =
  | { status: "success"; versionId?: string }
  | { status: "error"; error: unknown };

/** 工具执行前可作出的决策。 */
export type ToolCallDecision = "allow" | "deny";

/** 工具实际执行后的最终结果。 */
export type ToolCallOutcome =
  | { status: "success"; result: ToolResult }
  | { status: "error"; error: string };

export type BeforeToolCallParams = {
  turn: TurnRecord;
  step: number;
  iterId: string;
  /** 已确认存在的工具；工具不存在时根本不会触发本 Hook */
  tool: Tool;
  toolCall: Readonly<ToolCallRecord>;
  signal: AbortSignal;
};

export type BeforeToolCallResult =
  | {
      /** 不写 decision 等同不干预；args 会在全部 Hook 完成后重新校验。 */
      decision?: "allow";
      args?: any;
    }
  | {
      /** 阻止本次调用；reason 会作为工具错误回传模型。 */
      decision: "deny";
      reason: string;
    };

export type AfterToolCallParams = {
  turn: TurnRecord;
  step: number;
  iterId: string;
  tool: Tool;
  toolCall: Readonly<ToolCallRecord>;
  signal: AbortSignal;
};

// ─── AgentHooks ──────────────────────────────────────────────────────────────

/** 生命周期 hooks。 */
export interface AgentHooks {
  /**
   * 用户发送消息后、一轮 turn 开始时的钩子，在构建 turn 级消息快照之前调用。
   * 可用于初始化快照、收集日志等准备工作。
   */
  beforeTurn?: (params: {
    /** 原始用户输入，用于 UI 展示和历史记录 */
    message: string;
    /** 经过 chip format / formatUserMessage 后，实际发送给 LLM 的用户文本 */
    formattedMessage: string;
    attachments: any[];
    meta?: any;
    extra?: Record<string, any>;
  }) => Promise<void> | void;
  /**
   * 每次 LLM 请求前触发（每个 step 都会调用）。
   * 可用于动态修改请求参数、注入上下文等。
   * 返回 `additionalMessages` 时，这些消息会在本次 LLM 请求前追加到 tail。
   */
  beforeRequest?: (params: { meta?: any; extra?: Record<string, any> }) => Promise<{
    additionalMessages?: Message[];
  } | void> | { additionalMessages?: Message[] } | void;
  /**
   * 工具参数已解析，但尚未 validate / execute 时调用。
   * 可改写参数或拒绝调用；改写后的参数一定会重新执行 tool.validate。
   */
  beforeToolCall?: (params: BeforeToolCallParams) => Promise<BeforeToolCallResult | void> | BeforeToolCallResult | void;
  /**
   * 工具实际执行完成后调用；返回值会成为最终写入 ToolCallRecord、回传模型的 outcome。
   * 仅处理 execute 的成功或失败，以下情况不触发：
   * - 工具不存在、参数解析失败、validate 未通过（不属于"执行结果"）
   * - 前置 beforeToolCall deny
   * - 用户手动取消（取消是不可覆盖的终态）
   *
   * 注意：返回的 output 仍会经过统一的 token 上限守卫，超限一样会被替换为报错。
   */
  afterToolCall?: (params: AfterToolCallParams) => Promise<ToolCallOutcome | void> | ToolCallOutcome | void;
  /**
   * 模型准备正常停止当前 turn 时触发。
   *
   * 返回 `additionalMessages` 会拒绝本次停止：当前 assistant 回复会保留在 turn 中，
   * 消息随后追加到上下文，并继续当前 turn 的下一次 LLM 请求。
   * 用户取消、执行错误、doom loop 或达到 maxSteps 时不会触发。
   */
  beforeTurnStop?: (params: {
    turn: TurnRecord;
    step: number;
    finishReason: string;
  }) => Promise<{
    additionalMessages?: Message[];
  } | void> | { additionalMessages?: Message[] } | void;
  /**
   * 每轮 turn 结束后的钩子（无论成功、取消还是错误）。
   * 在 turn:complete / turn:abort / turn:error 事件触发后同步调用。
   * 可用于记录日志、上报埋点等收尾工作。
   */
  afterTurn?: (turn: TurnRecord) => Promise<void> | void;
  /**
   * 本轮 turn 的 summary 任务结束后的钩子（仅 summary.enabled=true 时触发）。
   *
   * 前两个参数保持既有兼容性：成功但无可解析摘要时 summary 为空字符串。
   * 第三个参数用于区分成功与失败；远端成功事件可额外携带 versionId。
   * 失败时 summary 为空字符串。
   */
  afterTurnSummary?: (
    turn: TurnRecord,
    summary: string,
    result?: TurnSummaryResult,
  ) => Promise<void> | void;
  /**
   * 成功 turn 的全部后台后处理结束后的钩子。
   * 此时 summary / compact 均已完成（无论 summary 成功或失败）。
   */
  afterTurnSettled?: (turn: TurnRecord) => Promise<void> | void;
}

function cloneHookData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneHookData) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, cloneHookData(child)]),
    ) as T;
  }
  return value;
}

function cloneToolCallRecord(toolCall: Readonly<ToolCallRecord>): ToolCallRecord {
  return {
    ...toolCall,
    args: cloneHookData(toolCall.args),
    ...(toolCall.result
      ? {
          result: {
            output: toolCall.result.output,
            ...(toolCall.result.metadata ? { metadata: cloneHookData(toolCall.result.metadata) } : {}),
            ...(toolCall.result.attachments ? { attachments: cloneHookData(toolCall.result.attachments) } : {}),
          },
        }
      : {}),
  };
}

/**
 * 将运行期参数转换为公开 Hook 参数。
 * Hook 只能通过返回值改写调用，不能静默修改持久化的 ToolCallRecord。
 */
export function createBeforeToolCallParams(params: BeforeToolCallParams): BeforeToolCallParams {
  return { ...params, toolCall: cloneToolCallRecord(params.toolCall) };
}

export function createAfterToolCallParams(params: AfterToolCallParams): AfterToolCallParams {
  return { ...params, toolCall: cloneToolCallRecord(params.toolCall) };
}

export function getToolCallOutcome(toolCall: Readonly<ToolCallRecord>): ToolCallOutcome {
  if (toolCall.status === "success" && toolCall.result) {
    return {
      status: "success",
      result: toolCall.result,
    };
  }
  return { status: "error", error: String(toolCall.error ?? "Tool execution failed") };
}

export function applyToolCallOutcome(toolCall: ToolCallRecord, outcome: ToolCallOutcome): void {
  if (outcome.status === "success") {
    toolCall.status = "success";
    toolCall.result = outcome.result;
    toolCall.error = undefined;
    toolCall.errorType = undefined;
    return;
  }

  toolCall.status = "error";
  toolCall.result = undefined;
  toolCall.error = outcome.error;
  toolCall.errorType = "normal";
}

export function withToolCallOutcome(
  toolCall: Readonly<ToolCallRecord>,
  outcome: ToolCallOutcome,
): ToolCallRecord {
  const next: ToolCallRecord = { ...toolCall };
  applyToolCallOutcome(next, outcome);
  return next;
}
