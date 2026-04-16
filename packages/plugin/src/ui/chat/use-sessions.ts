import { useState, useCallback, useRef } from "react";
import type { Agent, TurnRecord } from "../../../agent/src";

// ─── 数据模型 ─────────────────────────────────────────────────────────────────
//
// MessageRecord 直接 extends TurnRecord，仅补充流式过程中需要的临时字段。
// 持久化结构（TurnRecord）和 UI 结构复用同一份类型，避免两套数据。

export type { TurnRecord };

/**
 * UI 展示用的消息记录，在 TurnRecord 基础上补充：
 *   - status 扩展为 "pending"（流式进行中）
 *   - iterations 中的流式专用字段已在 TurnRecord 的 iterations 元素类型里通过可选字段扩展
 */
export interface MessageRecord extends Omit<TurnRecord, "status" | "endTime"> {
  status: "pending" | "success" | "abort" | "error";
  endTime?: number;
}

// ─── 辅助 ─────────────────────────────────────────────────────────────────────

/** 从 TurnRecord[] 直接映射为 MessageRecord[]（用于历史恢复，status 固定已完成） */
function turnsToMessageRecords(turns: TurnRecord[]): MessageRecord[] {
  return turns.map((turn) => ({ ...turn }));
}

function agentKey(agent: Agent): string {
  return agent.key ?? (agent.events as unknown as string);
}

// ─── useSessions ─────────────────────────────────────────────────────────────

export function useSessions() {
  const [sessions, setSessions] = useState<Record<string, MessageRecord[]>>({});
  const syncedRef = useRef<Set<string>>(new Set());
  const unsubsRef = useRef<(() => void)[]>([]);

  /** 取指定 agent 对应的消息列表 */
  const getMessages = useCallback(
    (agent: Agent): MessageRecord[] => sessions[agentKey(agent)] ?? [],
    [sessions]
  );

  /**
   * 切换 agent 时同步历史消息（先 loadHistory 再映射，每个 key 只同步一次）。
   */
  const syncAgent = useCallback(async (agent: Agent) => {
    const key = agentKey(agent);
    if (syncedRef.current.has(key)) return;

    await agent.loadHistory();
    syncedRef.current.add(key);

    const turns: TurnRecord[] = agent.getTurns();
    const records = turnsToMessageRecords(turns);
    if (records.length) {
      setSessions((prev) => ({ ...prev, [key]: records }));
    }
  }, []);

  /**
   * 新建一条 pending 的 MessageRecord，返回 recordId。
   * 在 agent.requestAI 之前调用，再将 id 传给 subscribeAgent。
   */
  const addMessage = useCallback(
    (
      agent: Agent,
      userText: string,
      userAttachments: MessageRecord["userAttachments"] = []
    ): string => {
      const key = agentKey(agent);
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
      setSessions((prev) => ({
        ...prev,
        [key]: [...(prev[key] ?? []), record],
      }));
      return id;
    },
    []
  );

  /**
   * 订阅 agent 事件，将 SSE 事件写入 id 对应的 MessageRecord。
   *
   * 事件流与数据结构对应关系：
   *   llm:start       → push 新 iteration（设 llmStartTime）
   *   llm:content     → 写当前 iteration 的 content / thinkingContent（暂存）
   *   tool:content    → 在当前 iteration 预创建 ToolCallRecord（pending）
   *   tool:call       → 更新当前 iteration 当前工具的 execStartTime / args
   *   tool:result     → 更新当前 iteration 当前工具 status=success / endTime
   *   tool:error      → 更新当前 iteration 当前工具 status=error / endTime
   *   llm:complete    → 设当前 iteration llmEndTime；done=true 时写 record.content
   *   turn:abort      → status=abort
   *   turn:error      → status=error
   */
  const subscribeAgent = useCallback((agent: Agent, id: string) => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];

    const key = agentKey(agent);
    // 当前 step 暂存的 LLM 文本（llm:complete 或 tool:call 时写入 iteration）
    let pendingContent = "";
    let pendingThinking = "";

    const update = (updater: (r: MessageRecord) => MessageRecord) =>
      setSessions((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).map((r) => (r.id === id ? updater(r) : r)),
      }));

    /** 更新最后一个 iteration */
    const updateLastIter = (
      updater: (iter: MessageRecord["iterations"][number]) => MessageRecord["iterations"][number]
    ) =>
      update((r) => {
        if (r.iterations.length === 0) return r;
        const iters = [...r.iterations];
        iters[iters.length - 1] = updater(iters[iters.length - 1]);
        return { ...r, iterations: iters };
      });

    /** 更新最后一个 iteration 中指定 callId 的工具 */
    const updateLastIterTool = (
      callId: string,
      toolUpdater: (t: MessageRecord["iterations"][number]["toolCalls"][number]) => MessageRecord["iterations"][number]["toolCalls"][number]
    ) =>
      updateLastIter((iter) => ({
        ...iter,
        toolCalls: iter.toolCalls.map((t) => (t.callId === callId ? toolUpdater(t) : t)),
      }));

    unsubsRef.current.push(
      agent.events.on("llm:start", ({ startTime }) => {
        pendingContent = "";
        pendingThinking = "";
        // push 新 iteration
        update((r) => ({
          ...r,
          iterations: [
            ...r.iterations,
            { content: "", toolCalls: [], startTime },
          ],
        }));
      }),

      agent.events.on("llm:content", ({ content, thinkingContent }) => {
        pendingContent = content;
        if (thinkingContent !== undefined) pendingThinking = thinkingContent;
        // 实时写入当前 iteration（用于流式展示）
        updateLastIter((iter) => ({
          ...iter,
          content: pendingContent,
          // 当收到首个 token 时设置 responseTime
          responseTime: iter.responseTime ?? Date.now(),
          ...(thinkingContent !== undefined ? { thinkingContent: pendingThinking } : {}),
        }));
      }),

      agent.events.on("llm:complete", ({ done, endTime }) => {
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
          // 本 step 有工具调用，记录 endTime
          updateLastIter((iter) => ({ ...iter, endTime }));
          pendingContent = "";
          pendingThinking = "";
        }
      }),

      agent.events.on("turn:abort", () => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => {
          const now = Date.now();
          const iters = r.iterations.length > 0
            ? r.iterations.map((iter, i) =>
                i === r.iterations.length - 1 && iter.endTime === undefined
                  ? { ...iter, endTime: now }
                  : iter
              )
            : r.iterations;
          return { ...r, status: "abort", iterations: iters };
        });
      }),

      agent.events.on("turn:error", ({ error }) => {
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({
          ...r,
          status: "error",
          error: String((error as any)?.message ?? error),
        }));
      }),

      agent.events.on("turn:resume", ({ turnId }) => {
        if (turnId !== id) return;
        pendingContent = "";
        pendingThinking = "";
        update((r) => ({ ...r, status: "pending", error: undefined }));
      }),

      // tool:content — LLM 流式输出 tool_calls，在当前 iteration 预创建 ToolCallRecord
      agent.events.on("tool:content", ({ callId, name, argsDelta }) => {
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            // 已有：追加 argsRaw，尝试提取路径
            last.toolCalls = last.toolCalls.map((t) => {
              if (t.callId !== callId) return t;
              const newArgsRaw = (t.argsRaw ?? "") + argsDelta;
              const partialArgs = tryParsePartialArgs(newArgsRaw);
              return { ...t, argsRaw: newArgsRaw, ...(partialArgs ? { args: partialArgs } : {}) };
            });
          } else {
            // 首帧：预创建 pending 记录
            last.toolCalls = [
              ...last.toolCalls,
              {
                callId,
                name,
                args: {},
                status: "success" as const, // 占位，tool:call 后更新
                execStartTime: Date.now(),
                execEndTime: 0,
                argsRaw: argsDelta,
              },
            ];
          }
          iters[iters.length - 1] = last;
          return { ...r, iterations: iters };
        });
      }),

      agent.events.on("tool:call", ({ callId, name, args, startTime }) => {
        pendingContent = "";
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            last.toolCalls = last.toolCalls.map((t) =>
              t.callId === callId
                ? { ...t, args, argsRaw: undefined, execStartTime: startTime }
                : t
            );
          } else {
            // 未预创建（onToolCallStream 未触发）
            last.toolCalls = [
              ...last.toolCalls,
              { callId, name, args, status: "success" as const, execStartTime: startTime, execEndTime: 0 },
            ];
          }
          iters[iters.length - 1] = last;
          return { ...r, iterations: iters };
        });
      }),

      agent.events.on("tool:result", ({ callId, result, endTime }) => {
        updateLastIterTool(callId, (t) => ({ ...t, status: "success", execEndTime: endTime, result }));
      }),

      agent.events.on("tool:error", ({ callId, error, endTime }) => {
        updateLastIterTool(callId, (t) => ({ ...t, status: "error", execEndTime: endTime, error }));
      })
    );
  }, []);

  /** 清空指定 agent 的 UI 消息列表（配合 agent.clearHistory 使用） */
  const clearSession = useCallback((agent: Agent) => {
    const key = agentKey(agent);
    syncedRef.current.delete(key);
    setSessions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const unsubscribeAll = useCallback(() => {
    unsubsRef.current.forEach((u) => u());
    unsubsRef.current = [];
  }, []);

  return { sessions, getMessages, addMessage, syncAgent, clearSession, subscribeAgent, unsubscribeAll };
}

// ─── 辅助：从不完整 JSON 字符串中提取已知字段 ───────────────────────────────────

/**
 * 尝试从流式传输的不完整 JSON 中提取 path 字段。
 */
function tryParsePartialArgs(raw: string): Record<string, any> | null {
  if (!raw) return null;
  const result: Record<string, any> = {};
  const pathMatch = raw.match(/"path"\s*:\s*"([^"\\]*)"/);
  if (pathMatch) result.path = pathMatch[1];
  if (/"oldString"\s*:/.test(raw)) result._hasOldString = true;
  if (/"newString"\s*:/.test(raw)) result._hasNewString = true;
  return Object.keys(result).length > 0 ? result : null;
}
