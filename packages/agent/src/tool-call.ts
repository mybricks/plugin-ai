import type {
  Message,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  TurnRecord,
} from "./types";
import type { AgentEvents } from "./events";
import {
  applyToolCallOutcome,
  createAfterToolCallParams,
  createBeforeToolCallParams,
  type AgentHooks,
} from "./hooks";
import { TOOL_OUTPUT_MAX_TOKENS, roughTokenCountEstimation } from "./content-limits";
import { toolCallRecordToMessage } from "./message-utils";

/** LLM 输出的单个工具调用。args 为 null 时由 argsRaw 提供未解析的原始串。 */
type RawToolCall = { id: string; name: string; args: any; argsRaw?: string };

/** prepare 与 execute 两阶段共用的运行上下文。 */
export interface ToolCallContext {
  turn: TurnRecord;
  step: number;
  /** 所属 LLM iter 的唯一 ID，与 llm:start 对应 */
  iterId: string;
  signal: AbortSignal;
  events: AgentEvents;
}

export interface PrepareToolCallParams {
  /** 会被原地改写：解析后的 args 及 beforeToolCall 改写结果都写回这里 */
  toolCall: RawToolCall;
  /** 当前可用工具集，按 name 匹配；匹配不到按 "Tool not found" 处理 */
  tools?: Tool[];
  ctx: ToolCallContext;
  hooks?: Pick<AgentHooks, "beforeToolCall">;
}

/**
 * 前置阶段产物。`record.status === "error"` 表示前置已失败，
 * execute 阶段会直接短路收口，不再 validate / execute。
 */
export interface PreparedToolCall {
  record: ToolCallRecord;
  tool?: Tool;
  ctx: ToolCallContext;
}

export interface ExecuteToolCallParams {
  hooks?: Pick<AgentHooks, "afterToolCall">;
  /**
   * 由调用方构造工具执行上下文。
   * 上下文依赖 turn 级可变状态（aiRole、用户输入、UI 通道等），
   * 因此这里只接受一个工厂函数，避免本模块反向依赖 Agent 实例。
   */
  createToolContext: (ctx: { callId: string; name: string }) => ToolExecutionContext;
  /**
   * ToolCallRecord 即将执行时回调一次。
   * record 为可变引用，后续所有状态变更都写在同一对象上，
   * 调用方据此在执行期间就能看到 pending 记录（工具通过 ctx.iterations 读取、崩溃续跑依赖它）。
   */
  onRecordCreated?: (record: ToolCallRecord) => void;
}

export interface ToolCallResult {
  /** 写入 iteration 并持久化的调用记录 */
  record: ToolCallRecord;
  /** 回传给模型的 tool 消息 */
  message: Message;
}

/**
 * 工具调用的前置阶段：解析参数、定位工具、执行 beforeToolCall。
 *
 * 必须在构建 assistant 消息之前调用：hook 改写后的参数要成为 tool_calls
 * 的唯一事实来源，否则模型本轮看到原始参数、历史回放时看到改写后的参数。
 *
 * 本阶段不发事件、不碰 iteration，只产出 record；失败信息直接写在 record 上。
 */
export async function prepareToolCall(params: PrepareToolCallParams): Promise<PreparedToolCall> {
  const { toolCall: tc, tools, ctx, hooks } = params;

  // 解析参数：失败时把原始串挂在 _argsRaw 上，后续原样回传给模型自行修正
  let argsParseError: unknown = null;
  if (tc.argsRaw != null && tc.args === null) {
    try {
      tc.args = JSON.parse(tc.argsRaw);
    } catch (e) {
      argsParseError = e;
      tc.args = { _argsRaw: tc.argsRaw };
    }
  }

  const tool = tools?.find(t => t.name === tc.name);
  const record: ToolCallRecord = {
    callId: tc.id,
    name: tc.name,
    title: tool?.title,
    args: tc.args,
    status: "pending",
    execStartTime: Date.now(),
    execEndTime: 0,
  };

  // 工具不存在优先于一切：连工具都没有，参数是否合法没有意义。
  if (!tool) {
    record.status = "error";
    record.errorType = "normal";
    record.error = `Tool not found: ${tc.name}`;
    // 参数同时解析失败时附上原始内容，便于模型定位自己吐错了什么
    if (tc.args?._argsRaw) record.error += `\nrawContent: ${tc.args._argsRaw}`;
    return { record, tool, ctx };
  }

  if (argsParseError) {
    record.status = "error";
    record.errorType = "invalid_args";
    record.error = String((argsParseError as any)?.message ?? argsParseError);
    if (tc.args?._argsRaw) record.error += `\nrawContent: ${tc.args._argsRaw}`;
    return { record, tool, ctx };
  }

  const hookCtx = { ...ctx, tool, toolCall: record };

  // ── beforeToolCall：可改写参数或拒绝调用 ───────────────────────────────────
  // 与其余 hook 一致：hook 抛错就当它没配置，工具照常执行。
  try {
    const result = await hooks?.beforeToolCall?.(createBeforeToolCallParams(hookCtx));
    if (result?.decision === "deny") {
      record.status = "error";
      record.errorType = "normal";
      record.error = `Tool call denied by hook: ${result.reason?.trim() || "no reason provided"}`;
    } else if (result && Object.prototype.hasOwnProperty.call(result, "args")) {
      // 改写后的参数写回 tc，使 assistant 消息、doom loop 判定、实际执行
      // 三者共用同一份参数。argsRaw 是解析成功路径下的冗余原始串，一并清除。
      record.args = (result as { args?: any }).args;
      tc.args = record.args;
      tc.argsRaw = undefined;
    }
  } catch (e) {
    console.warn("[Agent] hooks.beforeToolCall failed:", e);
  }

  return { record, tool, ctx };
}

/**
 * 工具调用的执行阶段：validate → execute → afterToolCall → output 守卫。
 *
 * 前置阶段已失败时直接短路收口，但仍会发出成对的 tool:call / tool:error。
 * hook 抛错只告警，不影响工具正常执行。
 */
export async function executeToolCall(
  prepared: PreparedToolCall,
  params: ExecuteToolCallParams,
): Promise<ToolCallResult> {
  const { record, tool, ctx } = prepared;
  const { signal, events, step, iterId } = ctx;

  params.onRecordCreated?.(record);
  // tool:call 与 tool:result / tool:error 必须成对：
  // 工具不存在、参数解析失败、hook deny 等分支也要先发出开始事件，UI 才有卡片可更新。
  events.emit("tool:call", { callId: record.callId, name: record.name, args: record.args ?? undefined, step, startTime: record.execStartTime, iterId });

  // 前置已失败（工具不存在 / 参数非法 / hook deny）
  if (record.status === "error" || !tool) return finalize(record, tool, ctx);

  const toolContext = params.createToolContext({ callId: record.callId, name: record.name });
  // execute 真正跑起来才允许触发 afterToolCall：
  // 前置 deny 和参数校验失败不属于"执行结果"，不应让 hook 改写。
  let executed = false;

  try {
    tool.validate?.(record.args, toolContext);
    executed = true;
    const result = await tool.execute(record.args, toolContext);
    // 即使用户在 execute 期间取消，也保留工具已完成的部分结果。最终 message
    // 会由统一 formatter 标为“部分结果 + 已取消”，而不会误判为完整成功。
    record.result = { output: result.output, metadata: result.metadata };
    if (signal.aborted) {
      record.status = "error";
      record.errorType = "normal";
      record.error = "Error: 用户已手动取消";
    } else {
      record.status = "success";
    }
  } catch (e) {
    record.status = "error";
    // ToolValidationError 或 validate 抛出的错误视为 invalid_args
    record.errorType = (e as any)?.name === "ToolValidationError" ? "invalid_args" : "normal";
    record.error = signal.aborted ? "Error: 用户已手动取消" : String((e as any)?.message ?? e);
  }

  record.execEndTime = Date.now();

  // ── afterToolCall：可改写执行结果 ─────────────────────────────────────────
  // 用户取消是不可覆盖的终态，此时直接跳过 hook，避免被改写回 success。
  if (executed && !signal.aborted) {
    try {
      const outcome = await params.hooks?.afterToolCall?.(
        createAfterToolCallParams({ ...ctx, tool, toolCall: record }),
      );
      if (outcome) applyToolCallOutcome(record, outcome);
    } catch (e) {
      console.warn("[Agent] hooks.afterToolCall failed:", e);
    }
  }

  return finalize(record, tool, ctx, { isCancelled: signal.aborted });
}

/**
 * 收口阶段：执行 output 守卫、发出事件、生成模型 tool message。
 * 所有分支（含 hook 改写后的结果）都必须经过这里，守卫不可被绕过。
 */
function finalize(
  record: ToolCallRecord,
  tool: Tool | undefined,
  ctx: ToolCallContext,
  options: { isCancelled?: boolean } = {},
): ToolCallResult {
  const { step, iterId, events } = ctx;
  record.execEndTime ||= Date.now();

  // ── 工具 output 大小守卫 ─────────────────────────────────────────────────
  // 自定义工具可能返回超大内容；统一在此拦截，用报错替换真实 output，
  // 引导模型缩小查询范围，而非把大量内容塞入上下文。
  // read 工具本身已有提前检查（在 execute 内部抛错），此处为兜底保护。
  // 注意：守卫排在 afterToolCall 之后，hook 改写出的超大 output 同样会被拦下。
  let includePartialOutput = options.isCancelled === true;
  if ((record.status === "success" || includePartialOutput) && record.result) {
    const maxOutputTokens = tool?.limits?.maxToken ?? TOOL_OUTPUT_MAX_TOKENS;
    const outputTokens = maxOutputTokens === false ? 0 : roughTokenCountEstimation(record.result.output);
    if (maxOutputTokens !== false && outputTokens > maxOutputTokens) {
      // 原始 output 不能留在持久化 record 中：历史重建时会根据 turn 的取消
      // 状态格式化该 record，保留它会让超限内容重新进入模型上下文。metadata
      // 仍可留下，供 init-project 这类工具展示安全的结构化结果。
      const cancelled = includePartialOutput;
      record.status = "error";
      record.errorType = "normal";
      record.result = record.result.metadata === undefined
        ? undefined
        : { output: "", metadata: record.result.metadata };
      includePartialOutput = false;
      record.error = `Error: Tool output exceeds the ${maxOutputTokens} token limit (estimated ~${outputTokens} tokens). Return less data or narrow your query.${cancelled ? "\n\nError: 用户已手动取消" : ""}`;
    }
  }

  const message = toolCallRecordToMessage(record, { isCancelled: includePartialOutput });
  if (message.status === "success") {
    events.emit("tool:result", { callId: record.callId, name: record.name, result: record.result, step, endTime: record.execEndTime, iterId });
  } else {
    events.emit("tool:error", {
      callId: record.callId,
      name: record.name,
      error: String(record.error ?? "Tool execution failed"),
      errorType: record.errorType,
      // 取消时 UI 仍可接收安全的 metadata；若 output 超限，上面的守卫已将
      // output 清空，因此不会通过事件或持久化记录泄漏进后续上下文。
      ...(options.isCancelled && record.result ? { result: record.result } : {}),
      step,
      endTime: record.execEndTime,
      iterId,
    });
  }

  return {
    record,
    message,
  };
}
