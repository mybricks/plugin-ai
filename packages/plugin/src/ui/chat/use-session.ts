import { useState, useCallback, useRef } from "react";
import type { Agent, TurnRecord } from "../../../agent/src";

// ─── 数据模型 ─────────────────────────────────────────────────────────────────

export type { TurnRecord };

export interface MessageRecord extends Omit<TurnRecord, "status" | "endTime"> {
  status: "pending" | "success" | "abort" | "error";
  endTime?: number;
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
// 单 agent 版本：state 只管一个 agent 的消息列表。
// subscribeSession(agent) 订阅 agent.events，通过 turn:start 自动创建 MessageRecord，
// 无需外部手动调用 addMessage / subscribeAgent，任何调用 agent.requestAI() 的入口
// 都能被自动感知，包括 ChatStartView、ChatPanel、外部直接调用等。

export function useSession(agent: Agent | undefined) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const syncedRef = useRef(false);
  const unsubsRef = useRef<(() => void)[]>([]);
  // 当前正在进行的 turn 的 id（由 turn:start 写入，turn:complete/abort/error 清空）
  const pendingIdRef = useRef<string | null>(null);

  /** 同步历史消息（每个 agent 只执行一次） */
  const syncAgent = useCallback(async (a: Agent) => {
    if (syncedRef.current) return;
    syncedRef.current = true;
    await a.loadHistory();
    const records = turnsToMessageRecords(a.getTurns());
    if (records.length) setMessages(records);
  }, []);

  /**
   * 订阅 agent 事件，全自动管理 MessageRecord 生命周期。
   *
   * - turn:start      → 创建新的 pending MessageRecord，记录 pendingId
   * - llm:start       → push 新 iteration
   * - llm:content     → 实时写入当前 iteration content/thinkingContent
   * - llm:complete    → done=true 时更新 record.content；done=false 时记录 iteration endTime
   * - tool:content    → 预创建 ToolCallRecord（流式展示）
   * - tool:call       → 更新 ToolCallRecord args/startTime
   * - tool:result     → 更新工具结果
   * - tool:error      → 更新工具错误
   * - turn:abort      → status=abort
   * - turn:error      → status=error
   *
   * 每次调用都会先清除上一次注册的监听器（同一个组件切换 agent 时安全）。
   */
  const subscribeSession = useCallback((a: Agent) => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];
    pendingIdRef.current = null;

    let pendingContent = "";
    let pendingThinking = "";

    const update = (updater: (r: MessageRecord) => MessageRecord) => {
      // 在调用时立刻捕获 id，避免 setMessages updater 异步执行时 ref 已被清空
      const id = pendingIdRef.current;
      if (!id) return;
      setMessages((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
    };

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
      // turn:start → 自动创建 pending MessageRecord
      a.events.on("turn:start", ({ turnId, message, attachments, meta, userFormattedText }) => {
        pendingContent = "";
        pendingThinking = "";
        pendingIdRef.current = turnId;
        const userAttachments = (attachments ?? []).map((a: any) => ({
          type: a.type ?? "image",
          content: a.content ?? a.url ?? "",
        }));
        const record: MessageRecord = {
          id: turnId,
          startTime: Date.now(),
          userText: message,
          ...(userFormattedText ? { userFormattedText } : {}),
          userAttachments,
          ...(meta ? { meta } : {}),
          content: "",
          thinkingContent: "",
          status: "pending",
          iterations: [],
          usage: undefined,
        };
        setMessages((prev) => [...prev, record]);
      }),

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
          pendingIdRef.current = null;
        } else {
          updateLastIter((iter) => ({ ...iter, endTime }));
          pendingContent = "";
          pendingThinking = "";
        }
      }),

      a.events.on("turn:abort", () => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => {
          const now = Date.now();
          const iters = r.iterations.map((iter, i) => {
            const isLast = i === r.iterations.length - 1;
            return {
              ...iter,
              ...(isLast && iter.endTime === undefined ? { endTime: now } : {}),
              toolCalls: iter.toolCalls.map((t) =>
                t.execEndTime === 0 ? { ...t, execEndTime: now } : t
              ),
            };
          });
          return { ...r, status: "abort" as const, iterations: iters };
        });
        pendingIdRef.current = null;
      }),

      a.events.on("turn:error", ({ error }) => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({
          ...r,
          status: "error",
          error: String((error as any)?.message ?? error),
        }));
        pendingIdRef.current = null;
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
    pendingIdRef.current = null;
    setMessages([]);
  }, []);

  return { messages, syncAgent, subscribeSession, clearSession };
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
