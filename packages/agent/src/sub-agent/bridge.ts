import type { Agent } from "../agent";
import type { SubAgentEvent } from "../events";
import type { RequestAICommonOptions, SubAgentTurnRecord, TokenUsage, TurnRecord } from "../types";
import type { SubAgentMetadata } from "./types";

/** 创建一条初始 SubAgentTurnRecord，agentKey / callId 等由调用方提供。 */
export function createChildAgentRecord(options: {
  agentKey: string;
  turnId?: string;
  parentAgentKey?: string;
  parentTurnId: string;
  callId: string;
  subAgentType: string;
  title?: string;
  userText: string;
  async?: boolean;
}): SubAgentTurnRecord {
  return {
    id: options.turnId ?? options.agentKey,
    agentKey: options.agentKey,
    parentAgentKey: options.parentAgentKey,
    parentTurnId: options.parentTurnId,
    callId: options.callId,
    subAgentType: options.subAgentType,
    title: options.title,
    async: options.async,
    startTime: Date.now(),
    userText: options.userText,
    userAttachments: [],
    iterations: [],
    status: "success",
  };
}

// ─── 进度快照类型 ─────────────────────────────────────────────────────────────

/**
 * 子 Agent 进度快照里的一次工具调用。
 * 给 UI / Trace 用，不是落盘的 ToolCallRecord。
 */
export interface ChildAgentProgressToolCall {
  callId: string;
  name: string;
  title?: string;
  args?: unknown;
  output?: string;
  error?: string;
  status: "running" | "success" | "error";
  startTime?: number;
  endTime?: number;
}

/**
 * 按 iterId 分组的子 Agent 执行进度。每个元素对应子 Agent 一次 LLM 迭代，
 * 供 UI 做"默认只展示最新一条，点击展开看全部 iter，每个 iter 下的工具再可单独展开"。
 * tool:progress 只保留最新一帧，所以每次都必须带上全部 iter。
 */
export interface ChildAgentProgressIteration {
  iterId: string;
  content: string;
  thinkingContent?: string;
  model?: string;
  usage?: TokenUsage;
  finishReason?: string;
  startTime?: number;
  endTime?: number;
  toolCalls: ChildAgentProgressToolCall[];
}

// ─── Bridge 接口与选项 ────────────────────────────────────────────────────────

export interface ChildAgentBridgeContext {
  turnId?: string;
  callId?: string;
  emitProgress?: (data: Record<string, unknown>) => void;
}

export interface CreateChildAgentBridgeOptions {
  subAgent: Agent;
  parentAgent: Agent;
  ctx: ChildAgentBridgeContext;
  subAgentType: string;
  title?: string;
  userText: string;
  /**
   * 传入已创建的 SubAgentTurnRecord（异步子 Agent 场景）。
   * 不传时 bridge 自动创建一条记录。
   */
  record?: SubAgentTurnRecord;
  /** 每次发 progress 时并上的额外字段（如 init-project 的 files）。 */
  getProgressExtra?: () => Record<string, unknown>;
}

export interface ChildAgentRequestResult {
  lastTurn?: TurnRecord;
  status: TurnRecord["status"];
  error?: string;
  wasCancelled: boolean;
}

export interface ChildAgentBridge {
  agentKey: string;
  callId: string;
  record: SubAgentTurnRecord;
  getIterations: () => ChildAgentProgressIteration[];
  applyTurn: (
    lastTurn: TurnRecord | undefined,
    status: TurnRecord["status"],
    error?: string,
  ) => void;
  emitProgress: (extra?: Record<string, unknown>) => void;
  subscribe: (options?: {
    /** 节流 emitProgress，时间内最多触发一次（leading + trailing）。0 表示不节流。 */
    contentThrottleMs?: number;
    onContent?: (event: {
      content: string;
      thinkingContent?: string;
      iterId: string;
    }) => void | Promise<void>;
  }) => () => void;
  /** requestAI + getTurns，统一 abort / throw 后的 lastTurn 与 status。 */
  runRequest: (message: string, options?: RequestAICommonOptions) => Promise<ChildAgentRequestResult>;
  finish: (
    lastTurn: TurnRecord | undefined,
    status: TurnRecord["status"],
    error?: string,
  ) => {
    agentKey: string;
    status: "success" | "error" | "aborted";
    iterations: ChildAgentProgressIteration[];
  };
  metadata: () => SubAgentMetadata;
  summarizeToolCalls: (output: string) => string;
}

// ─── createChildAgentBridge ───────────────────────────────────────────────────

/**
 * 把 fork / SubAgent 接到父 turn：挂 SubAgentTurnRecord，并把 llm/tool 事件编成
 * 覆盖式 progress 快照。call-sub-agent 和 init-project 共用。
 *
 * 进度事件采用完整覆盖快照：事件存储只保留同一工具调用的最新 progress，
 * 因此最终快照必须保留全部子 Agent iteration，供 Trace 回放。
 */
export function createChildAgentBridge(
  options: CreateChildAgentBridgeOptions,
): ChildAgentBridge | { error: string } {
  const { subAgent, parentAgent, ctx, subAgentType, title, userText, getProgressExtra } = options;
  const agentKey = subAgent.key;
  if (!agentKey) return { error: "Error: SubAgent 未分配 agentKey。" };

  const callId = ctx.callId ?? agentKey;

  // 子 turn 独立持久化；bridge 持有记录用于转发事件与结束状态。
  const record = options.record ?? createChildAgentRecord({
    agentKey, callId, subAgentType, title, userText, parentAgentKey: parentAgent.key,
    parentTurnId: ctx.turnId ?? parentAgent.getTurns().slice(-1)[0]?.id ?? "",
  });

  // 供转发 subagent:event 时附上的身份信息。
  const identity: Pick<SubAgentEvent, "parentTurnId" | "parentAgentKey" | "agentKey" | "turnId" | "callId" | "subAgentType" | "title" | "async"> = {
    parentTurnId: ctx.turnId ?? parentAgent.getTurns().slice(-1)[0]?.id ?? "",
    parentAgentKey: parentAgent.key ?? "",
    agentKey,
    turnId: record.id,
    callId,
    subAgentType,
    title,
    async: record.async === true,
  };

  // 进度快照：按 iterId 维护各 LLM 迭代及其工具调用，getIterations() 保证引用稳定。
  const iterOrder: string[] = [];
  const iterMap = new Map<string, ChildAgentProgressIteration>();
  const toolCallIterIndex = new Map<string, string>();

  const ensureIter = (iterId: string): ChildAgentProgressIteration => {
    let iter = iterMap.get(iterId);
    if (!iter) {
      iter = { iterId, content: "", toolCalls: [] };
      iterMap.set(iterId, iter);
      iterOrder.push(iterId);
    }
    return iter;
  };

  const getIterations = (): ChildAgentProgressIteration[] =>
    iterOrder.map((id) => iterMap.get(id)!);

  const emitProgress = (extra: Record<string, unknown> = {}) => {
    ctx.emitProgress?.({
      status: "running",
      agentKey,
      subAgentType,
      title,
      startTime: record.startTime,
      callId,
      iterations: getIterations(),
      ...getProgressExtra?.(),
      ...extra,
    });
  };

  const applyTurn = (
    lastTurn: TurnRecord | undefined,
    status: TurnRecord["status"],
    error?: string,
  ) => {
    if (lastTurn) Object.assign(record, lastTurn, { id: record.id, startTime: record.startTime });
    record.endTime = lastTurn?.endTime ?? Date.now();
    record.status = status;
    record.error = error ?? lastTurn?.error;
    // 工具执行返回后，父 Agent 的常规落盘流程会一并保存这条记录。
  };

  const progressStatus = (status: TurnRecord["status"]): "success" | "error" | "aborted" =>
    status === "abort" ? "aborted" : status === "error" ? "error" : "success";

  let disposeSubscription: (() => void) | null = null;

  const subscribe: ChildAgentBridge["subscribe"] = (subscribeOptions = {}) => {
    disposeSubscription?.();
    const contentThrottleMs = subscribeOptions.contentThrottleMs ?? 0;
    let lastContentEmitAt = 0;
    let contentTimer: ReturnType<typeof setTimeout> | null = null;

    const emitContentThrottled = () => {
      if (contentThrottleMs <= 0) {
        emitProgress();
        return;
      }
      const remaining = contentThrottleMs - (Date.now() - lastContentEmitAt);
      if (remaining <= 0) {
        if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
        lastContentEmitAt = Date.now();
        emitProgress();
      } else if (!contentTimer) {
        contentTimer = setTimeout(() => {
          contentTimer = null;
          lastContentEmitAt = Date.now();
          emitProgress();
        }, remaining);
      }
    };

    // llm:complete 时 flush，确保最终状态立即上报，避免最终用量丢失。
    const flushContent = () => {
      if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
      lastContentEmitAt = Date.now();
      emitProgress();
    };

    const emitSubAgentEvent = (event: SubAgentEvent["event"], data: unknown) => {
      parentAgent.events.emit("subagent:event", {
        ...identity, event, data, createdAt: Date.now(),
      } as SubAgentEvent);
    };

    const unsubscribeTurnStart = subAgent.events.on("turn:start", (data) => {
      record.userText = data.message;
      emitSubAgentEvent("turn:start", data);
    });

    const unsubscribeLLMStart = subAgent.events.on("llm:start", (data) => {
      ensureIter(data.iterId).startTime ??= data.startTime;
      emitSubAgentEvent("llm:start", data);
      emitProgress();
    });

    const unsubscribeLLMContent = subAgent.events.on("llm:content", (data) => {
      const { content, thinkingContent, iterId } = data;
      const iter = ensureIter(iterId);
      iter.content = content ?? "";
      if (thinkingContent !== undefined) iter.thinkingContent = thinkingContent;
      emitSubAgentEvent("llm:content", data);
      const next = subscribeOptions.onContent?.({ content, thinkingContent, iterId });
      if (next && typeof (next as Promise<void>).then === "function") {
        void (next as Promise<void>).then(emitContentThrottled, emitContentThrottled);
        return;
      }
      emitContentThrottled();
    });

    const unsubscribeLLMComplete = subAgent.events.on("llm:complete", (data) => {
      const { iterId, finishReason, usage, endTime } = data;
      const iter = ensureIter(iterId);
      iter.endTime = endTime;
      iter.finishReason = finishReason;
      if (usage) { iter.usage = usage; iter.model = usage.model; }
      emitSubAgentEvent("llm:complete", data);
      // LLM complete 通常不会再有 content；必须强制发送，避免最终用量丢失。
      flushContent();
    });

    const unsubscribeLLMRetry = subAgent.events.on("llm:retry", (data) => {
      emitSubAgentEvent("llm:retry", data);
    });

    const unsubscribeToolArgs = subAgent.events.on("tool:args", (data) => {
      const iterId = toolCallIterIndex.get(data.callId);
      const tool = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(t => t.callId === data.callId);
      if (tool) Object.assign(tool, { argsContent: data.content });
      emitSubAgentEvent("tool:args", data);
    });

    const unsubscribeToolCall = subAgent.events.on("tool:call", (data) => {
      const { callId: toolCallId, name, title: toolTitle, args, iterId, startTime } = data;
      ensureIter(iterId).toolCalls.push({
        callId: toolCallId,
        name,
        ...(toolTitle ? { title: toolTitle } : {}),
        args,
        status: "running",
        startTime,
      });
      toolCallIterIndex.set(toolCallId, iterId);
      emitSubAgentEvent("tool:call", data);
      emitProgress();
    });

    const unsubscribeToolResult = subAgent.events.on("tool:result", (data) => {
      const { callId: toolCallId, name, title: toolTitle, result, endTime } = data;
      const iterId = toolCallIterIndex.get(toolCallId);
      const tool = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(t => t.callId === toolCallId);
      if (tool) {
        tool.name = name;
        if (toolTitle) tool.title = toolTitle;
        tool.status = "success";
        tool.endTime = endTime;
        tool.output = typeof result?.output === "string" ? result.output : undefined;
      }
      emitSubAgentEvent("tool:result", data);
      emitProgress();
    });

    const unsubscribeToolError = subAgent.events.on("tool:error", (data) => {
      const { callId: toolCallId, name, title: toolTitle, error, endTime } = data;
      const iterId = toolCallIterIndex.get(toolCallId);
      const tool = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(t => t.callId === toolCallId);
      if (tool) {
        tool.name = name;
        if (toolTitle) tool.title = toolTitle;
        tool.status = "error";
        tool.endTime = endTime;
        tool.error = error;
      }
      emitSubAgentEvent("tool:error", data);
      emitProgress();
    });

    const unsubscribeToolProgress = subAgent.events.on("tool:progress", (data) => {
      const iterId = toolCallIterIndex.get(data.callId);
      const tool = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(t => t.callId === data.callId);
      if (tool) Object.assign(tool, { progress: data.data });
      emitSubAgentEvent("tool:progress", data);
    });

    // 取消信号绑定由调用方决定（bindAbortSignal → subAgent.abort()），
    // subscribe 只负责进度订阅与事件转发。

    emitProgress();

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      if (contentTimer) { clearTimeout(contentTimer); contentTimer = null; }
      unsubscribeTurnStart();
      unsubscribeLLMStart();
      unsubscribeLLMContent();
      unsubscribeLLMComplete();
      unsubscribeLLMRetry();
      unsubscribeToolArgs();
      unsubscribeToolCall();
      unsubscribeToolResult();
      unsubscribeToolError();
      unsubscribeToolProgress();
      if (disposeSubscription === dispose) disposeSubscription = null;
    };
    disposeSubscription = dispose;
    return dispose;
  };

  const runRequest = async (message: string, requestOptions: RequestAICommonOptions = {}): Promise<ChildAgentRequestResult> => {
    let requestError: unknown;
    // 取消是控制流状态，不从 Error.message 反推，避免展示文案参与业务判断。
    try {
      await subAgent.requestAI({ ...requestOptions, message, turnId: record.id });
    } catch (error) {
      requestError = error;
    }
    // 通过 turnId 查找而非取 last，兼容异步子 Agent 场景。
    const lastTurn = subAgent.getTurns().find(turn => turn.id === record.id);
    const wasCancelled = lastTurn?.status === "abort";
    return {
      lastTurn,
      wasCancelled,
      status: wasCancelled ? "abort" : requestError ? "error" : lastTurn?.status ?? "success",
      error: requestError && !wasCancelled
        ? String((requestError as Error)?.message ?? requestError)
        : lastTurn?.error,
    };
  };

  const metadata = (): SubAgentMetadata => ({
    subAgentType,
    title,
    agentKey,
    turnId: record.id,
    parentAgentKey: identity.parentAgentKey,
    parentTurnId: identity.parentTurnId,
    parentToolCallId: callId,
    startedAt: record.startTime,
  });

  const summarizeToolCalls = (output: string) => {
    const calls = getIterations().flatMap((iter) => iter.toolCalls);
    const summary =
      calls.length === 0
        ? "工具调用总结：未调用工具。"
        : (() => {
            const counts = new Map<string, { name: string; title?: string; count: number }>();
            for (const toolCall of calls) {
              const current = counts.get(toolCall.name);
              if (current) current.count += 1;
              else counts.set(toolCall.name, { name: toolCall.name, title: toolCall.title, count: 1 });
            }
            const details = [...counts.values()]
              .map(({ name, title: toolTitle, count }) =>
                `${toolTitle ? `${toolTitle}（${name}）` : name} × ${count}`,
              )
              .join("、");
            return `工具调用总结：共调用 ${calls.length} 次：${details}。`;
          })();
    return output ? `${output}\n\n${summary}` : summary;
  };

  return {
    agentKey,
    callId,
    record,
    getIterations,
    applyTurn,
    emitProgress,
    subscribe,
    runRequest,
    finish(lastTurn, status, error) {
      disposeSubscription?.();
      applyTurn(lastTurn, status, error);
      const statusLabel = progressStatus(status);
      // 合成终态事件；执行过程已通过实时事件发送，完整记录保存在子 turn 的 History 中。
      const finishEventName: SubAgentEvent["event"] =
        status === "success" ? "turn:complete" : status === "abort" ? "turn:abort" : "turn:error";
      const finishData = status === "error" ? { error: record.error, errorCode: record.errorCode } : {};
      parentAgent.events.emit("subagent:event", {
        ...identity,
        event: finishEventName,
        data: finishData,
        createdAt: record.endTime!,
      } as SubAgentEvent);
      emitProgress({ status: statusLabel, endTime: record.endTime });
      return { agentKey, status: statusLabel, iterations: getIterations() };
    },
    metadata,
    summarizeToolCalls,
  };
}
