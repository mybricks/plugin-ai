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
   * - tool:args      → 预创建 ToolCallView（argsContent 流式累积）
   * - tool:call       → 更新 ToolCallRecord args/startTime
   * - tool:result     → 更新工具结果
   * - tool:error      → 更新工具错误
   * - turn:abort      → status=abort
   * - turn:error      → status=error
   * - turn:resume     → 续跑重试：同 turn 回到 pending，恢复 pendingId（中途失败后 retry）
   *
   * 每次调用都会先清除上一次注册的监听器（同一个组件切换 agent 时安全）。
   */
  const subscribeSession = useCallback((a: Agent, opts?: { onTurnStart?: () => void; onTurnEnd?: () => void }) => {
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
      a.events.on("turn:start", ({ turnId, message, attachments, meta, userFormattedText, sender }) => {
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
          ...(sender ? { sender } : {}),
          content: "",
          thinkingContent: "",
          status: "pending",
          iterations: [],
          usage: undefined,
        };
        setMessages((prev) => [...prev, record]);
        opts?.onTurnStart?.();
      }),

      a.events.on("turn:resume", ({ turnId }) => {
        pendingContent = "";
        pendingThinking = "";
        pendingIdRef.current = turnId;
        setMessages((prev) =>
          prev.map((r) =>
            r.id === turnId ? { ...r, status: "pending" as const, error: undefined } : r
          )
        );
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
          opts?.onTurnEnd?.();
        } else {
          updateLastIter((iter) => ({ ...iter, endTime }));
          pendingContent = "";
          pendingThinking = "";
        }
      }),

      a.events.on("turn:abort", () => {
        pendingContent = "";
        pendingThinking = "";
        opts?.onTurnEnd?.();
        update((r) => {
          const now = Date.now();
          const iters = r.iterations.map((iter, i) => {
            const isLast = i === r.iterations.length - 1;
            return {
              ...iter,
              ...(isLast && iter.endTime === undefined ? { endTime: now } : {}),
              toolCalls: iter.toolCalls.map((t) =>
                t.execEndTime === 0
                  ? { ...t, status: "error" as const, execEndTime: now, error: "Aborted" }
                  : t
              ),
            };
          });
          return { 
            ...r, 
            status: "abort" as const, 
            iterations: iters
          };
        });
        pendingIdRef.current = null;
      }),

      a.events.on("turn:error", ({ error }) => {
        pendingContent = "";
        pendingThinking = "";
        opts?.onTurnEnd?.();
        update((r) => {
          const now = Date.now();
          const errorMsg = String((error as any)?.message ?? error);
          const iters = r.iterations.map((iter) => ({
            ...iter,
            toolCalls: iter.toolCalls.map((t) =>
              t.status === "pending"
                ? { ...t, status: "error" as const, execEndTime: t.execEndTime || now, error: errorMsg }
                : t
            ),
          }));
          return {
            ...r,
            status: "error",
            error: errorMsg,
            iterations: iters,
          };
        });
        pendingIdRef.current = null;
      }),

      a.events.on("tool:args", ({ callId, name, content }) => {
        const toolTitle = a.getTools().find(t => t.name === name)?.title;
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            last.toolCalls = last.toolCalls.map((t) => {
              if (t.callId !== callId) return t;
              const partialArgs = tryParsePartialArgs(content);
              return { ...t, argsContent: content, ...(partialArgs ? { args: partialArgs } : {}) };
            });
          } else {
            last.toolCalls = [
              ...last.toolCalls,
              { callId, name, title: toolTitle, args: {}, status: "pending" as const, execStartTime: Date.now(), execEndTime: 0, argsContent: content },
            ];
          }
          iters[iters.length - 1] = last;
          return { ...r, iterations: iters };
        });
      }),

      a.events.on("tool:call", ({ callId, name, args, startTime }) => {
        pendingContent = "";
        const toolTitle = a.getTools().find(t => t.name === name)?.title;
        const argsRaw = args && typeof args === "object" && "_argsRaw" in args
          ? String((args as any)._argsRaw)
          : undefined;
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = { ...iters[iters.length - 1] };
          const existing = last.toolCalls.find((t) => t.callId === callId);
          if (existing) {
            last.toolCalls = last.toolCalls.map((t) =>
              t.callId === callId
                ? {
                    ...t,
                    title: toolTitle,
                    ...(argsRaw !== undefined
                      ? { argsContent: t.argsContent ?? argsRaw }
                      : args !== undefined
                        ? { args, argsContent: undefined }
                        : {}),
                    execStartTime: startTime,
                  }
                : t
            );
          } else {
            last.toolCalls = [
              ...last.toolCalls,
              { callId, name, title: toolTitle, args: argsRaw !== undefined ? {} : args ?? {}, status: "pending" as const, execStartTime: startTime, execEndTime: 0, ...(argsRaw !== undefined ? { argsContent: argsRaw } : {}) },
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
      }),

      a.events.on("tool:progress", ({ callId, data }) => {
        updateLastIterTool(callId, (t) => ({ ...t, progress: data }));
      }),

      // warmup:start → push WarmupIter（status: loading）到 iterations
      a.events.on("warmup:start", ({ startTime, content }) => {
        update((r) => ({
          ...r,
          iterations: [...r.iterations, { type: "warmup" as const, status: "loading" as const, content, startTime, toolCalls: [] as [] }],
        }));
      }),

      // warmup:content → 更新最后一个 warmup iter 的 content
      a.events.on("warmup:content", ({ content }) => {
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = iters[iters.length - 1];
          if (last.type !== "warmup") return r;
          iters[iters.length - 1] = { ...last, content };
          return { ...r, iterations: iters };
        });
      }),

      // warmup:complete → 更新最后一个 warmup iter 的 status/endTime/content
      a.events.on("warmup:complete", ({ status, content, endTime }) => {
        update((r) => {
          if (r.iterations.length === 0) return r;
          const iters = [...r.iterations];
          const last = iters[iters.length - 1];
          if (last.type !== "warmup") return r;
          iters[iters.length - 1] = { ...last, status, content, endTime };
          return { ...r, iterations: iters };
        });
      })
    );

    return () => {
      unsubsRef.current.forEach((u) => u());
      unsubsRef.current = [];
    };
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

/**
 * 从流式输出的不完整 JSON 字符串中提取已知字段。
 * 支持：path / content / old_str / new_str / files / edits
 */
function tryParsePartialArgs(raw: string): Record<string, any> | null {
  if (!raw) return null;

  // 优先尝试完整解析
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // 继续做部分提取
  }

  const result: Record<string, any> = {};

  // path
  const pathMatch = raw.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (pathMatch) result.path = pathMatch[1];

  // content（单文件 write）—— 可能很长且未闭合，取到目前为止的内容
  const contentStart = raw.indexOf('"content"');
  if (contentStart !== -1) {
    const colonIdx = raw.indexOf(":", contentStart);
    if (colonIdx !== -1) {
      const afterColon = raw.slice(colonIdx + 1).trimStart();
      if (afterColon.startsWith('"')) {
        // 提取到目前为止（可能未闭合）
        const inner = afterColon.slice(1);
        const closeIdx = findUnescapedQuote(inner);
        result.content = closeIdx === -1 ? inner : inner.slice(0, closeIdx);
      }
    }
  }

  // old_str（单文件 edit）—— 用手动提取方式避免 /s flag 兼容性问题
  const oldStrKeyIdx = raw.indexOf('"old_str"');
  if (oldStrKeyIdx !== -1) {
    const colonIdx2 = raw.indexOf(":", oldStrKeyIdx);
    if (colonIdx2 !== -1) {
      const afterColon2 = raw.slice(colonIdx2 + 1).trimStart();
      if (afterColon2.startsWith('"')) {
        const inner2 = afterColon2.slice(1);
        const closeIdx2 = findUnescapedQuote(inner2);
        result.old_str = closeIdx2 === -1 ? inner2 : inner2.slice(0, closeIdx2);
      }
    }
  }

  const newStrStart = raw.indexOf('"new_str"');
  if (newStrStart !== -1) {
    const colonIdx = raw.indexOf(":", newStrStart);
    if (colonIdx !== -1) {
      const afterColon = raw.slice(colonIdx + 1).trimStart();
      if (afterColon.startsWith('"')) {
        const inner = afterColon.slice(1);
        const closeIdx = findUnescapedQuote(inner);
        result.new_str = closeIdx === -1 ? inner : inner.slice(0, closeIdx);
      }
    }
  }

  // files（multi_write）—— 提取已完整出现的 { path, content } 条目
  const filesKeyIdx = raw.indexOf('"files"');
  if (filesKeyIdx !== -1) {
    const arrStart = raw.indexOf("[", filesKeyIdx);
    if (arrStart !== -1) {
      result.files = extractPartialObjectArray(raw.slice(arrStart), ["path", "content"]);
    }
  }

  // edits（multi_edit）—— 提取已完整出现的 { path, old_str, new_str } 条目
  const editsKeyIdx = raw.indexOf('"edits"');
  if (editsKeyIdx !== -1) {
    const arrStart = raw.indexOf("[", editsKeyIdx);
    if (arrStart !== -1) {
      result.edits = extractPartialObjectArray(raw.slice(arrStart), ["path", "old_str", "new_str"]);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/** 在字符串中找到第一个未被转义的双引号的位置 */
function findUnescapedQuote(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && s[j] === "\\") { backslashes++; j--; }
      if (backslashes % 2 === 0) return i;
    }
  }
  return -1;
}

/**
 * 从不完整的 JSON 数组字符串中提取已完整出现的对象条目。
 * 对于最后一个未闭合的对象，尽量提取已知字段作为部分条目。
 */
function extractPartialObjectArray(arrStr: string, fields: string[]): Record<string, any>[] {
  const items: Record<string, any>[] = [];

  // 先找完整的对象（花括号闭合）
  let depth = 0;
  let objStart = -1;
  for (let i = 0; i < arrStr.length; i++) {
    const ch = arrStr[i];
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const objStr = arrStr.slice(objStart, i + 1);
        try {
          const parsed = JSON.parse(objStr);
          if (parsed && typeof parsed === "object") items.push(parsed);
        } catch {
          // 忽略无法解析的片段
        }
        objStart = -1;
      }
    }
  }

  // 最后一个未闭合的对象：尽量提取已知字段
  if (objStart !== -1) {
    const partial = arrStr.slice(objStart);
    const partialItem: Record<string, any> = {};
    for (const field of fields) {
      const fieldMatch = partial.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (fieldMatch) partialItem[field] = fieldMatch[1];
    }
    if (Object.keys(partialItem).length > 0) items.push(partialItem);
  }

  return items;
}
