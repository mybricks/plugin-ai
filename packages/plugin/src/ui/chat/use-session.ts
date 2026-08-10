import { useState, useCallback, useEffect, useRef } from "react";
import type { Agent, HistoryStatus, TurnRecord } from "../../../../agent/src";
import type { WarmupIter } from "../../../../agent/src/types";
import { tryParsePartialArgs } from "./messages/tool-renders/partial-args";
import type { ToolCallView } from "./messages/tool-renders";

/** 本地 CodeAgent 与服务端 HttpAgent 共用的会话输入边界。 */
export type SessionAgent = Pick<
  Agent,
  "events" | "historyManager" | "getTurns" | "getTools"
> & {
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
}

type MessageIteration = UIIteration;
type LLMMessageIteration = UILLMIter;

let _iterSeq = 0;
function nextIterId(): string {
  return `iter-${++_iterSeq}`;
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

function isWarmupIteration(iter: MessageIteration): iter is UIWarmupIter {
  return "type" in iter && iter.type === "warmup";
}

function getLastLLMIter(turn: MessageRecord): LLMMessageIteration | null {
  for (let i = turn.iterations.length - 1; i >= 0; i--) {
    if (!isWarmupIteration(turn.iterations[i])) return turn.iterations[i] as LLMMessageIteration;
  }
  return null;
}

// ─── useHistoryLoader ─────────────────────────────────────────────────────────

function useHistoryLoader(
  agent: SessionAgent | undefined,
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
        const records = turnsToMessageRecords(await agent.getTurns());
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

  const subscribeSession = useCallback((a: SessionAgent, opts?: { onTurnStart?: () => void; onTurnEnd?: () => void }) => {
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
      const records = turnsToMessageRecords(await a.getTurns());
      const streaming = records.find((r) => r.status === "pending") ?? null;
      historyRef.current = streaming ? records.filter((r) => r !== streaming) : records;
      streamingRef.current = streaming
        ? { ...streaming, iterations: [...streaming.iterations] }
        : null;
      commit();
    };

    unsubsRef.current.push(
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

      a.events.on("llm:start", ({ step, startTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const llmCount = turn.iterations.filter((i) => !isWarmupIteration(i)).length;
        if (llmCount >= step) return;
        turn.iterations.push({ iterId: nextIterId(), content: "", toolCalls: [], startTime });
        commit();
      }),

      a.events.on("llm:content", ({ content, thinkingContent }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
        if (!iter) return;
        iter.content = content;
        iter.responseTime = iter.responseTime ?? Date.now();
        if (thinkingContent !== undefined) iter.thinkingContent = thinkingContent;
        scheduleCommit();
      }),

      a.events.on("llm:complete", ({ done, endTime }) => {
        if (done) {
          cancelCommit();
          syncFromSnapshot();
          opts?.onTurnEnd?.();
        } else {
          flushCommit();
          const turn = streamingRef.current;
          if (!turn) return;
          const iter = getLastLLMIter(turn);
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

      a.events.on("turn:error", ({ error }) => {
        cancelCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const now = Date.now();
        const errorMsg = String((error as any)?.message ?? error);
        const finalized: MessageRecord = {
          ...turn,
          status: "error",
          error: errorMsg,
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

      a.events.on("tool:args", ({ callId, name, content }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
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

      a.events.on("tool:call", ({ callId, name, args, startTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
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

      a.events.on("tool:result", ({ callId, result, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId ? { ...tool, status: "success" as const, execEndTime: endTime, result } : tool
        );
        commit();
      }),

      a.events.on("tool:error", ({ callId, error, errorType, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId
            ? { ...tool, status: "error" as const, execEndTime: endTime, error, ...(errorType ? { errorType } : {}) }
            : tool
        );
        commit();
      }),

      a.events.on("tool:progress", ({ callId, data }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const iter = getLastLLMIter(turn);
        if (!iter) return;
        iter.toolCalls = iter.toolCalls.map((tool) =>
          tool.callId === callId ? { ...tool, progress: data } : tool
        );
        scheduleCommit();
      }),

      a.events.on("warmup:start", ({ startTime, content }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        turn.iterations.push({ iterId: nextIterId(), type: "warmup", status: "loading", content, startTime, toolCalls: [] });
        commit();
      }),

      a.events.on("warmup:content", ({ content }) => {
        const turn = streamingRef.current;
        if (!turn) return;
        const last = turn.iterations[turn.iterations.length - 1];
        if (!last || !isWarmupIteration(last)) return;
        last.content = content;
        scheduleCommit();
      }),

      a.events.on("warmup:complete", ({ status, content, endTime }) => {
        flushCommit();
        const turn = streamingRef.current;
        if (!turn) return;
        const last = turn.iterations[turn.iterations.length - 1];
        if (!last || !isWarmupIteration(last)) return;
        last.status = status;
        last.content = content;
        last.endTime = endTime;
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
      unsubsRef.current.forEach((u) => u());
      unsubsRef.current = [];
    };
  }, []);

  const clearSession = useCallback(() => {
    historyRef.current = [];
    streamingRef.current = null;
    commit();
  }, [commit]);

  const loadMoreHistory = useCallback(async (agent: SessionAgent, limit: number) => {
    if (agent.loadOlderTurns) {
      await agent.loadOlderTurns(limit);
    } else {
      const oldest = historyRef.current[0];
      if (!oldest) return;
      await agent.getTurns({ before: oldest.id, limit });
    }
    const records = turnsToMessageRecords(await agent.getTurns());
    const streaming = streamingRef.current;
    historyRef.current = streaming
      ? records.filter((r) => r.id !== streaming.id)
      : records;
    commit();
  }, [commit]);

  return { subscribeSession, clearSession, loadMoreHistory };
}

// ─── useSession ───────────────────────────────────────────────────────────────

export function useSession(agent: SessionAgent | undefined) {
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
  const loadMoreHistory = useCallback(async (targetAgent: SessionAgent, limit: number) => {
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
