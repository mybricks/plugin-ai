import type { Agent } from "./agent";
import type { SubAgentTurnRecord, TokenUsage, TurnRecord } from "./types";

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

export interface ChildAgentBridgeContext {
  callId?: string;
  attachSubAgentTurn?: (record: SubAgentTurnRecord) => void;
  emitProgress?: (data: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

export interface CreateChildAgentBridgeOptions {
  subAgent: Agent;
  parentAgent: Agent;
  ctx: ChildAgentBridgeContext;
  subAgentType: string;
  title?: string;
  userText: string;
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
  runRequest: (message: string) => Promise<ChildAgentRequestResult>;
  finish: (
    lastTurn: TurnRecord | undefined,
    status: TurnRecord["status"],
    error?: string,
  ) => {
    agentKey: string;
    status: "success" | "error" | "aborted";
    iterations: ChildAgentProgressIteration[];
  };
  metadata: (status: string) => {
    subAgentType: string;
    title?: string;
    agentKey: string;
    status: string;
    iterations: ChildAgentProgressIteration[];
  };
  summarizeToolCalls: (output: string) => string;
}

/**
 * 把 fork / SubAgent 接到父 iter：挂 SubAgentTurnRecord，并把 llm/tool 事件编成
 * 覆盖式 progress 快照。call-sub-agent 和 init-project 共用。
 */
export function createChildAgentBridge(
  options: CreateChildAgentBridgeOptions,
): ChildAgentBridge | { error: string } {
  const { subAgent, parentAgent, ctx, subAgentType, title, userText, getProgressExtra } = options;
  const agentKey = subAgent.key;
  if (!agentKey) return { error: "Error: SubAgent 未分配 agentKey。" };

  const callId = ctx.callId ?? agentKey;
  // 子 Agent 执行记录（SubAgentTurnRecord）：先挂一条 running 占位，
  // 随父 Agent 当前 iteration 正常持久化；子 Agent 执行完毕后原地更新同一个对象。
  const record: SubAgentTurnRecord = {
    id: agentKey,
    agentKey,
    subAgentType,
    callId,
    parentAgentKey: parentAgent.key,
    startTime: Date.now(),
    userText,
    userAttachments: [],
    iterations: [],
    status: "success",
  };
  ctx.attachSubAgentTurn?.(record);

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

  // 进度事件采用完整覆盖快照：事件存储只保留同一工具调用的最新 progress，
  // 因此最终快照必须保留全部子 Agent iteration，供 Trace 回放。
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
    record.endTime = Date.now();
    record.status = status;
    record.iterations = lastTurn?.iterations ?? [];
    if (error) record.error = error;
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
        if (contentTimer) {
          clearTimeout(contentTimer);
          contentTimer = null;
        }
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
    // llm:complete 时 flush，确保最终状态立即上报
    const flushContent = () => {
      if (contentTimer) {
        clearTimeout(contentTimer);
        contentTimer = null;
      }
      lastContentEmitAt = Date.now();
      emitProgress();
    };

    const unsubscribeLLMStart = subAgent.events.on("llm:start", ({ iterId, startTime }) => {
      ensureIter(iterId).startTime ??= startTime;
      emitProgress();
    });
    const unsubscribeLLMContent = subAgent.events.on(
      "llm:content",
      ({ content, thinkingContent, iterId }) => {
        const iter = ensureIter(iterId);
        iter.content = content ?? "";
        if (thinkingContent !== undefined) iter.thinkingContent = thinkingContent;
        const next = subscribeOptions.onContent?.({ content, thinkingContent, iterId });
        if (next && typeof (next as Promise<void>).then === "function") {
          void (next as Promise<void>).then(emitContentThrottled, emitContentThrottled);
          return;
        }
        emitContentThrottled();
      },
    );
    const unsubscribeLLMComplete = subAgent.events.on(
      "llm:complete",
      ({ iterId, finishReason, usage, endTime }) => {
        const iter = ensureIter(iterId);
        iter.endTime = endTime;
        iter.finishReason = finishReason;
        if (usage) {
          iter.usage = usage;
          iter.model = usage.model;
        }
        // LLM complete 通常不会再有 content；必须强制发送，避免最终用量丢失。
        flushContent();
      },
    );
    const unsubscribeToolCall = subAgent.events.on(
      "tool:call",
      ({ callId: toolCallId, name, title, args, iterId, startTime }) => {
        ensureIter(iterId).toolCalls.push({
          callId: toolCallId,
          name,
          ...(title ? { title } : {}),
          args,
          status: "running",
          startTime,
        });
        toolCallIterIndex.set(toolCallId, iterId);
        emitProgress();
      },
    );
    const unsubscribeToolResult = subAgent.events.on(
      "tool:result",
      ({ callId: toolCallId, name, title, result, endTime }) => {
        const iterId = toolCallIterIndex.get(toolCallId);
        const toolCall = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(
          (item) => item.callId === toolCallId,
        );
        if (toolCall) {
          toolCall.name = name;
          if (title) toolCall.title = title;
          toolCall.status = "success";
          toolCall.endTime = endTime;
          toolCall.output = typeof result?.output === "string" ? result.output : undefined;
        }
        emitProgress();
      },
    );
    const unsubscribeToolError = subAgent.events.on(
      "tool:error",
      ({ callId: toolCallId, name, title, error, endTime }) => {
        const iterId = toolCallIterIndex.get(toolCallId);
        const toolCall = (iterId ? iterMap.get(iterId) : undefined)?.toolCalls.find(
          (item) => item.callId === toolCallId,
        );
        if (toolCall) {
          toolCall.name = name;
          if (title) toolCall.title = title;
          toolCall.status = "error";
          toolCall.endTime = endTime;
          toolCall.error = error;
        }
        emitProgress();
      },
    );

    const abort = () => subAgent.abort();
    if (ctx.signal?.aborted) abort();
    else ctx.signal?.addEventListener("abort", abort, { once: true });

    emitProgress();

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      if (contentTimer) {
        clearTimeout(contentTimer);
        contentTimer = null;
      }
      unsubscribeLLMStart();
      unsubscribeLLMContent();
      unsubscribeLLMComplete();
      unsubscribeToolCall();
      unsubscribeToolResult();
      unsubscribeToolError();
      ctx.signal?.removeEventListener("abort", abort);
      if (disposeSubscription === dispose) disposeSubscription = null;
    };
    disposeSubscription = dispose;
    return dispose;
  };

  const runRequest: ChildAgentBridge["runRequest"] = async (message) => {
    let lastTurn: TurnRecord | undefined;
    let requestError: Error | null = null;
    // 取消是控制流状态，不从 Error.message 反推，避免展示文案参与业务判断。
    let wasCancelled = false;
    try {
      await subAgent.requestAI({ message });
      const turns = await subAgent.getTurns();
      lastTurn = turns[turns.length - 1];
      if (ctx.signal?.aborted || lastTurn?.status === "abort") {
        wasCancelled = true;
      }
    } catch (err: unknown) {
      wasCancelled = Boolean(ctx.signal?.aborted);
      requestError = err instanceof Error ? err : new Error(String(err));
      try {
        const turns = await subAgent.getTurns();
        lastTurn = turns[turns.length - 1];
      } catch {
        // fork 可能已经中断，保留 requestError。
      }
      if (!wasCancelled && lastTurn?.status === "abort") wasCancelled = true;
    }

    const status: TurnRecord["status"] = wasCancelled
      ? "abort"
      : requestError || lastTurn?.status === "error"
        ? "error"
        : lastTurn?.status ?? "success";
    return {
      lastTurn,
      status,
      error: requestError && !wasCancelled ? requestError.message : undefined,
      wasCancelled,
    };
  };

  const metadata = (status: string) => ({
    subAgentType,
    title,
    agentKey,
    status,
    iterations: getIterations(),
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
      emitProgress({ status: statusLabel, endTime: record.endTime });
      return { agentKey, status: statusLabel, iterations: getIterations() };
    },
    metadata,
    summarizeToolCalls,
  };
}
