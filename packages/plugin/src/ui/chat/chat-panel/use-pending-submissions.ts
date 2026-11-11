import { useCallback, useEffect, useMemo, useState } from "react";
import type { MessageRecord } from "../use-session";

/** 「优先上屏」的占位消息：已提交、真实 turn 尚未建立。 */
export interface PendingSubmission {
  /** 关联标识；agent 建轮时随 turn:start.clientMessageId 回传，用于精确移除。 */
  id: string;
  userText: string;
  userAttachments: any[];
  startTime: number;
  /** 已结束但没落成 turn：保留消息气泡，只去掉"等待响应"提示。 */
  settled?: boolean;
}

/** 只需要 turn:start 事件即可完成配对，避免依赖具体 agent 类型。 */
interface TurnStartEmitter {
  events: {
    on(event: "turn:start", handler: (data: { clientMessageId?: string }) => void): () => void;
  };
}

/**
 * 「优先上屏」占位的唯一入口，把原本散在 use-agent 里的状态、事件配对和合并逻辑收拢到一起：
 * - add     提交时立即上屏
 * - settle  提交结束但没有落成 turn（保留气泡、去掉等待提示）
 * - remove  投递失败等情况下撤销
 * - reset   清空会话时一并清空
 * - merge   把占位并入消息列表（占位永远排在真实消息之后）
 */
export function usePendingSubmissions(agent?: TurnStartEmitter) {
  const [items, setItems] = useState<PendingSubmission[]>([]);

  // 真实轮建立即让位：按 clientMessageId 精确匹配，不依赖文本。
  useEffect(() => {
    if (!agent) return;
    return agent.events.on("turn:start", ({ clientMessageId }) => {
      if (!clientMessageId) return;
      setItems((prev) => prev.filter((entry) => entry.id !== clientMessageId));
    });
  }, [agent]);

  const add = useCallback((entry: PendingSubmission) => {
    setItems((prev) => [...prev, entry]);
  }, []);

  const settle = useCallback((id: string) => {
    setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, settled: true } : entry)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const reset = useCallback(() => setItems([]), []);

  const merge = useCallback((messages: MessageRecord[]): MessageRecord[] => {
    if (!items.length) return messages;
    // settled 且对话已经继续（出现了更晚的真实消息）的占位自动移除：
    // 服务端会话历史里已有这条插话，刷新后仍会从历史恢复，不需要一直挂在当前会话里。
    const placeholders = items
      .filter((entry) =>
        !entry.settled ||
        !messages.some((message) => message.startTime > entry.startTime)
      )
      .map((entry) => ({
        id: entry.id,
        startTime: entry.startTime,
        userText: entry.userText,
        userAttachments: entry.userAttachments,
        status: (entry.settled ? "success" : "pending") as MessageRecord["status"],
        ...(entry.settled ? { endTime: entry.startTime } : {}),
        iterations: [],
      }));
    // 按 startTime 归位：占位可能产生于几条真实消息之前，不能简单追加在末尾。
    return [...messages, ...placeholders].sort((a, b) => a.startTime - b.startTime);
  }, [items]);

  return useMemo(() => ({ add, settle, remove, reset, merge }), [add, settle, remove, reset, merge]);
}
