import { useState, useCallback, useRef } from "react";
import type { Agent, TurnRecord } from "../../../agent/src";

// ─── 数据模型 ─────────────────────────────────────────────────────────────────

export type { TurnRecord };

export interface MessageRecord extends Omit<TurnRecord, "status" | "endTime"> {
  status: "pending" | "success" | "abort" | "error";
  endTime?: number;
}

export interface ToolRecord {
  callId: string;
  name: string;
  args: Record<string, any>;
  status: "pending" | "success" | "error";
  execStartTime: number;
  execEndTime: number;
  result?: any;
  error?: any;
}

export interface Session {
  messages: MessageRecord[];
}

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

function turnsToMessageRecords(turns: TurnRecord[]): MessageRecord[] {
  return turns.map((turn) => ({ ...turn }));
}

// ─── useSession ───────────────────────────────────────────────────────────────
//
// 单 agent 版本：state 只管一个 agent 的消息列表，不再用 Record<key, ...> map。
// 每个 ChatPanel 实例持有独立的 useSession，agent 事件 re-render 范围完全隔离。

export function useSession(agent: Agent | undefined) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const syncedRef = useRef(false);
  const unsubsRef = useRef<(() => void)[]>([]);

  /** 同步历史消息（每个 agent 只执行一次） */
  const syncAgent = useCallback(async (a: Agent) => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    await a.loadHistory();
    const records = turnsToMessageRecords(a.getTurns());
    if (records.length) setMessages(records);
  }, []);

  /**
   * 新建一条 pending MessageRecord，返回 recordId。
   * 在 agent.requestAI 之前调用。
   */
  const addMessage = useCallback(
    (userText: string, userAttachments: MessageRecord["userAttachments"] = []): string => {
      const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const record: MessageRecord = {
        id,
        startTime: Date.now(),
        userText,
        userAttachments,
        content: "",
        thinkingContent: "",
        status: "pending",
        iterations: [],
        usage: undefined,
      };
      setMessages((prev) => [...prev, record]);
      return id;
    },
    []
  );

  /**
   * 订阅 agent 事件，将 SSE 事件写入 id 对应的 MessageRecord。
   */
  const subscribeAgent = useCallback((a: Agent, id: string) => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];

    let pendingContent = "";
    let pendingThinking = "";

    const update = (updater: (r: MessageRecord) => MessageRecord) =>
      setMessages((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));

    const updateLastIter = (
      updater: (iter: MessageRecord["iterations"][number]) => MessageRecord["iterations"][number]
    ) =>
      update((r) => {
        if (r.iterations.length === 0) return r;
        const iters = [...r.iterations];
        iters[iters.length - 1] = updater(iters[iters.length - 1]);
        return { ...r, iterations: iters };
      });

    const updateLastIterTool = (
      callId: string,
      toolUpdater: (t: MessageRecord["iterations"][number]["toolCalls"][number]) => MessageRecord["iterations"][number]["toolCalls"][number]
    ) =>
      updateLastIter((iter) => ({
        ...iter,
        toolCalls: iter.toolCalls.map((t) => (t.callId === callId ? toolUpdater(t) : t)),
      }));

    unsubsRef.current.push(
      a.events.on("llm:start", ({ startTime }) => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({
          ...r,
          iterations: [...r.iterations, { content: "", toolCalls: [], startTime }],
        }));
      }),

      a.events.on("llm:content", ({ content, thinkingContent }) => {
        pendingContent = content;
        if (thinkingContent !== undefined) pendingThinking = thinkingContent;
        updateLastIter((iter) => ({
          ...iter,
          content: pendingContent,
          responseTime: iter.responseTime ?? Date.now(),
          ...(thinkingContent !== undefined ? { thinkingContent: pendingThinking } : {}),
        }));
      }),

      a.events.on("llm:complete", ({ done, endTime }) => {
        if (done) {
          const finalContent = pendingContent;
          pendingContent = "";
          pendingThinking = "";
          update((r) => {
            const iters = [...r.iterations];
            if (iters.length > 0) {
              iters[iters.length - 1] = { ...iters[iters.length - 1], endTime, content: finalContent };
            }
            return { ...r, status: "success", content: finalContent, iterations: iters };
          });
        } else {
          updateLastIter((iter) => ({ ...iter, endTime }));
          pendingContent = "";
          pendingThinking = "";
        }
      }),

      a.events.on("turn:abort", () => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({ ...r, status: "abort" }));
      }),

      a.events.on("turn:error", ({ error }) => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({
          ...r,
          status: "error",
          error: String((error as any)?.message ?? error),
        }));
      }),

      a.events.on("tool:content", ({ callId, name, argsDelta }) => {
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            last.toolCalls = last.toolCalls.map((t) => {
              if (t.callId !== callId) return t;
              const newArgsRaw = (t.argsRaw ?? "") + argsDelta;
              const partialArgs = tryParsePartialArgs(newArgsRaw);
              return { ...t, argsRaw: newArgsRaw, ...(partialArgs ? { args: partialArgs } : {}) };
            });
          } else {
            last.toolCalls = [
              ...last.toolCalls,
              { callId, name, args: {}, status: "success" as const, execStartTime: Date.now(), execEndTime: 0, argsRaw: argsDelta },
            ];
          }
          iters[iters.length - 1] = last;
          return { ...r, iterations: iters };
        });
      }),

      a.events.on("tool:call", ({ callId, name, args, startTime }) => {
        pendingContent = "";
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            last.toolCalls = last.toolCalls.map((t) =>
              t.callId === callId ? { ...t, args, argsRaw: undefined, execStartTime: startTime } : t
            );
          } else {
            last.toolCalls = [
              ...last.toolCalls,
              { callId, name, args, status: "success" as const, execStartTime: startTime, execEndTime: 0 },
            ];
          }
          iters[iters.length - 1] = last;
          return { ...r, iterations: iters };
        });
      }),

      a.events.on("tool:result", ({ callId, result, endTime }) => {
        updateLastIterTool(callId, (t) => ({ ...t, status: "success", execEndTime: endTime, result }));
      }),

      a.events.on("tool:error", ({ callId, error, endTime }) => {
        updateLastIterTool(callId, (t) => ({ ...t, status: "error", execEndTime: endTime, error }));
      })
    );
  }, []);

  /** 清空消息列表（配合 agent.clearHistory 使用） */
  const clearSession = useCallback(() => {
    syncedRef.current = false;
    setMessages([]);
  }, []);

  return { messages, syncAgent, addMessage, subscribeAgent, clearSession };
}

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

function tryParsePartialArgs(raw: string): Record<string, any> | null {
  if (!raw) return null;
  const result: Record<string, any> = {};
  const pathMatch = raw.match(/"path"\s*:\s*"([^"\\]*)"/);
  if (pathMatch) result.path = pathMatch[1];
  if (/"oldString"\s*:/.test(raw)) result._hasOldString = true;
  if (/"newString"\s*:/.test(raw)) result._hasNewString = true;
  return Object.keys(result).length > 0 ? result : null;
}
