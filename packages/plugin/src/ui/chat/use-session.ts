import { useState, useCallback, useEffect, useRef } from "react";
import { applyChildAgentEvent, type Agent, type AgentEventMap, type AgentEvents, type HistoryStatus, type SubAgentCreatedInfo, type TurnRecord, type SubAgentTurnRecord } from "../../../../agent/src";
import type { WarmupIter } from "../../../../agent/src/types";
import { tryParsePartialArgs } from "./messages/tool-renders/partial-args";
import type { ToolCallView } from "./messages/tool-renders";

/** 本地 CodeAgent 与服务端 HttpAgent 共用的会话输入边界。 */
export type AgentPort = Pick<
  Agent,
  "events" | "historyManager" | "getTools"
> & {
  getTurns: (options?: { before?: string; limit?: number }) => TurnRecord[];
  /**
   * 按子 turnId 取子 Agent 的事件总线。本地实现返回真实 Agent 的 events，
   * 远程实现返回由子通道投喂的本地总线。未就绪时返回 undefined。
   */
  childAgentEvents?: (turnId: string) => AgentEvents | undefined;
  getSubAgentTurns?: (agentKey: string) => Promise<SubAgentTurnRecord[]>;
  getChildTurns?: (parentTurnId?: string) => Promise<SubAgentTurnRecord[]>;
  /** 服务端 Agent 的游标分页入口；本地 Agent 仍通过 getTurns(options) 加载。 */
  loadOlderTurns?: (limit?: number) => Promise<unknown>;
};

// ─── 数据模型 ─────────────────────────────────────────────────────────────────

export type { TurnRecord };

export interface UIWarmupIter extends WarmupIter {
  iterId: string;
}
export type UILLMIter = Omit<Exclude<TurnRecord["iterations"][number], WarmupIter>, "toolCalls"> & {
  iterId: string;
  toolCalls: ToolCallView[];
};
export type UIIteration = UIWarmupIter | UILLMIter;

export interface MessageRecord extends Omit<TurnRecord, "status" | "endTime" | "iterations"> {
  status: "pending" | "success" | "abort" | "error";
  endTime?: number;
  iterations: UIIteration[];
  /** 仅 UI 使用的子 turn 视图，不写入主 turn 的 History。 */
  childTurns?: SubAgentTurnRecord[];
}

type MessageIteration = UIIteration;
type LLMMessageIteration = UILLMIter;

let _iterSeq = 0;
function nextIterId(): string {
  return `iter-${++_iterSeq}`;
}

function findLLMIterById(turn: MessageRecord, iterId: string): LLMMessageIteration | null {
  for (let i = turn.iterations.length - 1; i >= 0; i--) {
    const iter = turn.iterations[i];
    if (!isWarmupIteration(iter) && iter.iterId === iterId) return iter as LLMMessageIteration;
  }
  return null;
}

function findWarmupIterById(turn: MessageRecord, iterId: string): UIWarmupIter | null {
  for (let i = turn.iterations.length - 1; i >= 0; i--) {
    const iter = turn.iterations[i];
    if (isWarmupIteration(iter) && iter.iterId === iterId) return iter;
  }
  return null;
}

// 高频流式事件（llm:content / tool:args / tool:progress）先 mutate ref，
// 攒到一个 frame 再统一 commit，把渲染上限稳定在约 30fps。
const STREAM_COMMIT_INTERVAL_MS = 33;

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

function turnsToMessageRecords(turns: TurnRecord[]): MessageRecord[] {
  return turns
    .filter((turn) => !turn.deleted)
    .map((turn) => ({
      ...turn,
      status: !turn.endTime && turn.status === "success" ? "pending" : turn.status,
      iterations: turn.iterations.map((iter) =>
        (iter as any).iterId ? iter : { ...iter, iterId: nextIterId() }
      ) as UIIteration[],
    }));
}

async function loadMessageRecords(agent: AgentPort): Promise<MessageRecord[]> {
  const records = turnsToMessageRecords(await agent.getTurns());
  if (agent.getChildTurns) {
    const hasChildCalls = records.some(record => record.iterations.some(iter => {
      if ("type" in iter) return false;
      return iter.toolCalls.some(tool => tool.name === "call-sub-agent" || tool.name === "init-project" || typeof tool.result?.metadata?.agentKey === "string");
    }));
    if (!hasChildCalls) return records;
    try {
      const children = await agent.getChildTurns();
      for (const record of records) record.childTurns = children.filter(child => child.parentTurnId === record.id);
    } catch (error) {
      console.warn("[plugin-ai] failed to load child turns", error);
    }
    return records;
  }
  if (!agent.getSubAgentTurns) return records;
  await Promise.all(records.map(async record => {
    const keys = new Set<string>();
    for (const iter of record.iterations) {
      if ("type" in iter) continue;
      for (const tool of iter.toolCalls) {
        const key = tool.result?.metadata?.agentKey;
        if (typeof key === "string") keys.add(key);
      }
    }
    const children = await Promise.all([...keys].map(key => agent.getSubAgentTurns!(key)));
    record.childTurns = children.flat().filter(child => child.parentTurnId === record.id);
  }));
  return records;
}

/** 合并加载期间收到的实时子事件，避免异步历史查询覆盖正在展示的进度。 */
function mergeLiveChildren(records: MessageRecord[], current: MessageRecord[]): void {
  const byId = new Map(current.map(record => [record.id, record]));
  for (const record of records) {
    const existing = byId.get(record.id)?.childTurns;
    if (!existing?.length) continue;
    const children = new Map((record.childTurns ?? []).map(child => [child.id, child]));
    for (const child of existing) {
      const saved = children.get(child.id);
      if (!saved || child.endTime || !saved.endTime) children.set(child.id, child);
    }
    record.childTurns = [...children.values()];
  }
}

function isWarmupIteration(iter: MessageIteration): iter is UIWarmupIter {
  return "type" in iter && iter.type === "warmup";
}

// ─── useHistoryLoader ─────────────────────────────────────────────────────────

function useHistoryLoader(
  agent: AgentPort | undefined,
  historyRef: React.MutableRefObject<MessageRecord[]>,
  streamingRef: React.MutableRefObject<MessageRecord | null>,
  commit: () => void,
) {
  const [historyStatus, setHistoryStatus] = useState<HistoryStatus>(
    () => agent?.historyManager.getSnapshot().status ?? "ready"
  );
  const [historyError, setHistoryError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!agent) {
      historyRef.current = [];
      streamingRef.current = null;
      commit();
      setHistoryStatus("ready");
      setHistoryError(null);
      setHasMore(false);
      return;
    }

    let cancelled = false;

    const unsubscribe = agent.historyManager.subscribe(async (snapshot) => {
      if (cancelled) return;
      setHistoryStatus(snapshot.status);
      setHistoryError(snapshot.error);
      setHasMore(snapshot.hasMore);
      if (snapshot.status === "ready") {
        const records = await loadMessageRecords(agent);
        if (cancelled) return;
        const current = [...historyRef.current];
        if (streamingRef.current) current.push(streamingRef.current);
        mergeLiveChildren(records, current);
        const streaming = records.find((r) => r.status === "pending") ?? null;
        historyRef.current = streaming ? records.filter((r) => r !== streaming) : records;
        streamingRef.current = streaming
          ? { ...streaming, iterations: [...streaming.iterations] }
          : null;
        commit();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [agent]);

  return { historyStatus, historyError, hasMore };
}

// ─── useAgentEvents ───────────────────────────────────────────────────────────

function useAgentEvents(
  historyRef: React.MutableRefObject<MessageRecord[]>,
  streamingRef: React.MutableRefObject<MessageRecord | null>,
  commit: () => void,
) {
  const unsubsRef = useRef<(() => void)[]>([]);

  const subscribeSession = useCallback((a: AgentPort, opts?: { onTurnStart?: () => void; onTurnEnd?: () => void }) => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];

    let commitTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleCommit = () => {
      if (commitTimer !== null) return;
      commitTimer = setTimeout(() => {
        commitTimer = null;
        commit();
      }, STREAM_COMMIT_INTERVAL_MS);
    };

    const flushCommit = () => {
      if (commitTimer !== null) {
        clearTimeout(commitTimer);
        commitTimer = null;
      }
      commit();
    };

    const cancelCommit = () => {
      if (commitTimer !== null) {
        clearTimeout(commitTimer);
        commitTimer = null;
      }
    };

    const syncFromSnapshot = async () => {
      const records = await loadMessageRecords(a);
      const current = [...historyRef.current];
      if (streamingRef.current) current.push(streamingRef.current);
      mergeLiveChildren(records, current);
      const streaming = records.find((r) => r.status === "pending") ?? null;
      historyRef.current = streaming ? records.filter((r) => r !== streaming) : records;
      streamingRef.current = streaming
        ? { ...streaming, iterations: [...streaming.iterations] }
        : null;
      commit();
    };

    // 子 Agent 独立订阅：subagent:created 只带身份信息，事件从子 Agent 自己的总线来。
    const childSubscriptions = new Map<string, () => void>();

    const applyChildEvent = (
      info: SubAgentCreatedInfo,
      event: keyof AgentEventMap,
      data: unknown,
    ) => {
      const records = streamingRef.current
        ? [...historyRef.current, streamingRef.current]
        : historyRef.current;
      const parent = records.find(turn => turn.id === info.parentTurnId);
      if (!parent) return;
      const children = [...(parent.childTurns ?? [])];
      if (!applyChildAgentEvent(children, info, event as never, data as never)) return;
      parent.childTurns = children;
      // 后台子任务可能更新已经结束的 turn；更换引用让 memo 组件感知变化。
      if (streamingRef.current?.id === info.parentTurnId) {
        streamingRef.current = { ...streamingRef.current };
      } else {
        historyRef.current = historyRef.current.map(turn => {
          if (turn.id === info.parentTurnId) return { ...turn };
          return turn;
        });
      }
      if (event === "turn:complete" || event === "turn:abort" || event === "turn:error") flushCommit();
      else scheduleCommit();
    };

    const CHILD_TRACKED_EVENTS: (keyof AgentEventMap)[] = [
      "turn:start", "turn:complete", "turn:abort", "turn:error", "llm:retry",
      "llm:start", "llm:content", "llm:complete",
      "tool:call", "tool:args", "tool:result", "tool:error", "tool:progress",
    ];

    const subscribeChild = (info: SubAgentCreatedInfo) => {
      if (childSubscriptions.has(info.turnId)) return;
      const events = a.childAgentEvents?.(info.turnId);
      if (!events) return;
      const unsubs = CHILD_TRACKED_EVENTS.map(name =>
        events.on(name, data => applyChildEvent(info, name, data)),
      );
      const dispose = () => {
        unsubs.forEach(u => u());
        childSubscriptions.delete(info.turnId);
      };
      childSubscriptions.set(info.turnId, dispose);
    };

    unsubsRef.current.push(
      a.events.on("subagent:created", info => {
        subscribeChild(info);
        // 先渲染一条 pending 子任务，不必等子 Agent 自己的第一个事件。
        applyChildEvent(info, "subagent:created", info);
      }),

      a.events.on("turn:start", ({ turnId, message, attachments, meta, userFormattedText, sender }) => {
        flushCommit();
        const userAttachments = (attachments ?? []).map((att: any) => ({
          type: att.type ?? "image",
          ...(att.content !== undefined ? { content: att.content } : {}),
          ...(att.url !== undefined ? { url: att.url } : {}),
          ...(att.filename ?? att.title ? { filename: att.filename ?? att.title } : {}),
          ...(att.mime ? { mime: att.mime } : {}),
          ...(att.mediaType ? { mediaType: att.mediaType } : {}),
        }));
        streamingRef.current = {
          id: turnId,
          startTime: Date.now(),
          userText: message,
          ...(userFormattedText ? { userFormattedText } : {}),
          userAttachments,
          ...(meta ? { meta } : {}),
          ...(sender ? { sender } : {}),
          status: "pending",
          iterations: [],
        };
        commit();
        opts?.onTurnStart?.();
      }),

      a.events.on("turn:resume", async ({ turnId }) => {
        flushCommit();
        const fromAgent = turnsToMessageRecords(await a.getTurns()).find((r) => r.id === turnId);
        const fromHistory = historyRef.current.find((r) => r.id === turnId);
        const restored = fromAgent ?? fromHistory;
        if (!restored) return;
        historyRef.current = historyRef.current.filter((r) => r.id !== turnId);
        streamingRef.current = { ...restored, status: "pending", error: undefined, iterations: [...restored.iterations] };
        commit();
      }),

      a.events.on("llm:start", ({ iterId, startTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        if (turn.iterations.some((i) => i.iterId === iterId)) return;
        turn.iterations.push({ iterId, content: "", toolCalls: [], startTime });
        commit();
      }),

      a.events.on("llm:content", ({ iterId, content, thinkingContent }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        iter.content = content;
        iter.responseTime = iter.responseTime ?? Date.now();
        if (thinkingContent !== undefined) iter.thinkingContent = thinkingContent;
        scheduleCommit();
      }),

      a.events.on("llm:complete", ({ iterId, done, endTime }) => {
        if (done) {
          cancelCommit();
          syncFromSnapshot();
          opts?.onTurnEnd?.();
        } else {
          flushCommit();
          const turn = streamingRef.current;
          if (!turn) return;
          const iter = findLLMIterById(turn, iterId);
          if (iter && endTime !== undefined) iter.endTime = endTime;
          commit();
        }
      }),

      a.events.on("turn:abort", () => {
        cancelCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const now = Date.now();
        const finalized: MessageRecord = {
          ...turn,
          status: "abort",
          endTime: now,
          iterations: turn.iterations.map((iter) => {
            if (isWarmupIteration(iter)) return iter;
            const hasEndTime = iter.endTime === undefined ? { endTime: now } : {};
            return {
              ...iter,
              ...hasEndTime,
              toolCalls: iter.toolCalls.map((tool) =>
                tool.status === "pending"
                  ? { ...tool, status: "error" as const, execEndTime: now, error: "Aborted" }
                  : tool
              ),
            };
          }),
        };
        historyRef.current = [...historyRef.current, finalized];
        streamingRef.current = null;
        commit();
        opts?.onTurnEnd?.();
      }),

      a.events.on("turn:error", ({ error, errorCode }) => {
        cancelCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const now = Date.now();
        const errorMsg = String((error as any)?.message ?? error);
        const finalized: MessageRecord = {
          ...turn,
          status: "error",
          error: errorMsg,
          errorCode,
          iterations: turn.iterations.map((iter) => {
            if (isWarmupIteration(iter)) return iter;
            return {
              ...iter,
              toolCalls: iter.toolCalls.map((tool) =>
                tool.status === "pending"
                  ? { ...tool, status: "error" as const, execEndTime: tool.execEndTime || now, error: errorMsg }
                  : tool
              ),
            };
          }),
        };
        historyRef.current = [...historyRef.current, finalized];
        streamingRef.current = null;
        commit();
        opts?.onTurnEnd?.();
      }),

      a.events.on("tool:args", ({ iterId, callId, name, content }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        const toolTitle = a.getTools().find((t) => t.name === name)?.title;
        const existing = iter.toolCalls.find((t) => t.callId === callId);
        if (existing) {
          const partialArgs = tryParsePartialArgs(content);
          iter.toolCalls = iter.toolCalls.map((t) =>
            t.callId === callId
              ? { ...t, argsContent: content, ...(partialArgs ? { args: partialArgs } : {}) }
              : t
          );
        } else {
          iter.toolCalls = [
            ...iter.toolCalls,
            { callId, name, title: toolTitle, args: {}, status: "pending" as const, execStartTime: Date.now(), execEndTime: 0, argsContent: content },
          ];
        }
        scheduleCommit();
      }),

      a.events.on("tool:call", ({ iterId, callId, name, args, startTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        const toolTitle = a.getTools().find((t) => t.name === name)?.title;
        const argsRaw = args && typeof args === "object" && "_argsRaw" in args
          ? String((args as any)._argsRaw)
          : undefined;
        const existing = iter.toolCalls.find((t) => t.callId === callId);
        if (existing) {
          iter.toolCalls = iter.toolCalls.map((t) =>
            t.callId !== callId ? t : {
              ...t,
              title: toolTitle,
              execStartTime: startTime,
              ...(argsRaw !== undefined
                ? { argsContent: t.argsContent ?? argsRaw }
                : args !== undefined
                  ? { args, argsContent: undefined }
                  : {}),
            }
          );
        } else {
          iter.toolCalls = [
            ...iter.toolCalls,
            {
              callId, name, title: toolTitle,
              args: argsRaw !== undefined ? {} : args ?? {},
              status: "pending" as const,
              execStartTime: startTime,
              execEndTime: 0,
              ...(argsRaw !== undefined ? { argsContent: argsRaw } : {}),
            },
          ];
        }
        commit();
      }),

      a.events.on("tool:result", ({ iterId, callId, result, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId ? { ...tool, status: "success" as const, execEndTime: endTime, result } : tool
        );
        commit();
      }),

      a.events.on("tool:error", ({ iterId, callId, error, errorType, result, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId
            ? {
                ...tool,
                status: "error" as const,
                execEndTime: endTime,
                error,
                ...(errorType ? { errorType } : {}),
                ...(result ? { result } : {}),
              }
            : tool
        );
        commit();
      }),

      a.events.on("tool:progress", ({ iterId, callId, data }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findLLMIterById(turn, iterId);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId ? { ...tool, progress: data } : tool
        );
        scheduleCommit();
      }),

      a.events.on("warmup:start", ({ iterId, startTime, operation }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        turn.iterations.push({ iterId, type: "warmup", operation, status: "loading", startTime, toolCalls: [] });
        commit();
      }),

      a.events.on("warmup:content", ({ retryCount }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const last = turn.iterations[turn.iterations.length - 1];
        if (!last || !isWarmupIteration(last)) return;
        last.retryCount = retryCount;
        scheduleCommit();
      }),

      a.events.on("warmup:complete", ({ iterId, status, errorCode, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = findWarmupIterById(turn, iterId);
        if (!iter) return;
        iter.status = status;
        iter.errorCode = errorCode;
        iter.endTime = endTime;
        commit();
      }),

      a.events.on("turn:suggestions", ({ turnId, suggestions }) => {
        historyRef.current = historyRef.current.map((r) =>
          r.id === turnId ? { ...r, suggestions } : r
        );
        commit();
      }),

      a.events.on("turn:suggestions:dismiss", ({ turnId }) => {
        historyRef.current = historyRef.current.map((r) =>
          r.id === turnId ? { ...r, suggestionsDismissed: true } : r
        );
        commit();
      }),

      a.events.on("turn:delete", ({ turnId }) => {
        flushCommit();
        historyRef.current = historyRef.current.filter((r) => r.id !== turnId);
        if (streamingRef.current?.id === turnId) streamingRef.current = null;
        commit();
      }),
    );

    syncFromSnapshot();

    return () => {
      cancelCommit();
      // 子订阅与父订阅是两套生命周期，父销毁时一并释放，避免残留监听。
      childSubscriptions.forEach((dispose) => dispose());
      childSubscriptions.clear();
      unsubsRef.current.forEach((u) => u());
      unsubsRef.current = [];
    };
  }, []);

  const clearSession = useCallback(() => {
    historyRef.current = [];
    streamingRef.current = null;
    commit();
  }, [commit]);

  const loadMoreHistory = useCallback(async (agent: AgentPort, limit: number) => {
    if (agent.loadOlderTurns) {
      await agent.loadOlderTurns(limit);
    } else {
      const oldest = historyRef.current[0];
      if (!oldest) return;
      await agent.getTurns({ before: oldest.id, limit });
    }
    const records = await loadMessageRecords(agent);
    const current = [...historyRef.current];
    if (streamingRef.current) current.push(streamingRef.current);
    mergeLiveChildren(records, current);
    const streaming = streamingRef.current;
    historyRef.current = streaming
      ? records.filter((r) => r.id !== streaming.id)
      : records;
    commit();
  }, [commit]);

  return { subscribeSession, clearSession, loadMoreHistory };
}

// ─── useSession ───────────────────────────────────────────────────────────────

export function useSession(agent: AgentPort | undefined) {
  const historyRef = useRef<MessageRecord[]>([]);
  const streamingRef = useRef<MessageRecord | null>(null);
  const loadingMoreRef = useRef(false);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // commit 只做一件事：把 ref 的当前值快照到 React state。
  // streaming turn 的最后一个 iter 每次都浅拷贝，让 MessageIteration.memo 感知到变化；
  // 已完成的 iter 保持同一引用，让 memo 直接 bailout。
  const commit = useCallback(() => {
    const streaming = streamingRef.current;
    if (streaming) {
      const iters = streaming.iterations;
      setMessages([
        ...historyRef.current,
        {
          ...streaming,
          iterations: iters.map((iter, i) =>
            i === iters.length - 1 ? { ...iter } : iter
          ),
        },
      ]);
    } else {
      setMessages([...historyRef.current]);
    }
  }, []);

  const { historyStatus, historyError, hasMore } = useHistoryLoader(agent, historyRef, streamingRef, commit);
  const { subscribeSession, clearSession, loadMoreHistory: loadMoreHistoryBase } = useAgentEvents(historyRef, streamingRef, commit);
  const loadMoreHistory = useCallback(async (targetAgent: AgentPort, limit: number) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      await loadMoreHistoryBase(targetAgent, limit);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [loadMoreHistoryBase]);

  return { messages, historyStatus, historyError, hasMore, isLoadingMore, subscribeSession, clearSession, loadMoreHistory };
}
