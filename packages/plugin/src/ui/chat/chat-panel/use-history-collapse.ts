import { useCallback, useRef, useState } from "react";
import type { MessageRecord } from "../use-session";

// ─── 折叠边界计算 ─────────────────────────────────────────────────────────────

function getIterLength(record: MessageRecord): number {
  return Array.isArray(record.iterations) ? record.iterations.length : 0;
}

/** 计算自动折叠边界：返回折叠区尾部 index（exclusive），0 表示不需要折叠。
 *
 * 规则：
 * - 从尾往前累加已完成 turn 的 iter 数
 * - 跳过 pending turn（永远展示）
 * - 累计超过 maxIters 时，当前 turn 及更早的全部折叠
 */
function calcFoldBoundary(messages: MessageRecord[], maxIters: number): number {
  let iterCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const record = messages[i];
    if (record.status === "pending") continue;
    const iterLen = getIterLength(record);
    if (iterCount + iterLen > maxIters) {
      return i + 1;
    }
    iterCount += iterLen;
  }
  return 0;
}

/** 已完成历史的总 iter 数，用作手动展开游标的版本。 */
function calcHistoryIterCount(messages: MessageRecord[]): number {
  let iterCount = 0;
  for (const record of messages) {
    if (record.status === "pending") continue;
    iterCount += getIterLength(record);
  }
  return iterCount;
}

function isValidMaxIters(maxIters: number): boolean {
  return Number.isFinite(maxIters) && maxIters > 0;
}

// ─── useHistoryCollapse ───────────────────────────────────────────────────────

export interface HistoryCollapseResult {
  collapseCursor: {
    visibleStartIndex: number;
    collapsedCount: number;
  };
  onExpandHistory: (type: "one" | "all") => void;
  /**
   * 主动触发折叠边界重新计算。
   *
   * 为什么不通过 messages 状态变化自动派生？
   * 消息列表在流式渲染期间会高频更新（每个 SSE delta 都触发 setState），
   * 若把折叠逻辑挂在 messages 依赖上，每帧都会重算，引入不必要的 O(n) 开销。
   * 折叠状态只需在两个低频时机重算：
   *   1. 历史加载完成（historyLoaded: false → true）
   *   2. 一轮对话结束（turn:complete / turn:abort / turn:error）
   * 调用方在这两处手动调用 recalculate()，避免流式渲染期间重复计算。
   *
   * recalculate 通过 useRef 保证引用永远稳定，调用方可直接放入 effect 回调
   * 而不必将其列入依赖数组。
   */
  recalculate: () => void;
}

interface HistoryCollapseMetrics {
  foldBoundary: number;
  historyIterCount: number;
}

const FALLBACK_METRICS: HistoryCollapseMetrics = {
  foldBoundary: 0,
  historyIterCount: 0,
};

const FALLBACK_CURSOR = {
  visibleStartIndex: 0,
  collapsedCount: 0,
};

/**
 * 管理超长历史折叠的全部状态与派生值。
 *
 * 核心模型：**总 iter 数版本 + 展开游标 + iter 上限**
 *
 * - 自动折叠：用 maxIters 从尾部反推自动边界 foldBoundary
 * - 手动展开：记录本次展开后的 visibleStartIndex
 * - 新 turn 完成：historyIterCount 变化，展开游标失效，回到自动折叠
 */
export function useHistoryCollapse(
  messages: MessageRecord[],
  maxIters: number
): HistoryCollapseResult {
  const [cursor, setCursor] = useState<{ visibleStartIndex: number; atHistoryIterCount: number } | null>(null);
  const [metrics, setMetrics] = useState<HistoryCollapseMetrics>(FALLBACK_METRICS);

  // 用 ref 持有最新的 messages / maxIters，让 recalculate 的引用永远稳定，
  // 调用方无需将其加入 effect 依赖。
  const messagesRef = useRef(messages);
  const maxItersRef = useRef(maxIters);
  messagesRef.current = messages;
  maxItersRef.current = maxIters;

  const recalculate = useRef(() => {
    try {
      const msgs = messagesRef.current;
      const max = maxItersRef.current;
      if (!Array.isArray(msgs) || !isValidMaxIters(max)) {
        setMetrics(FALLBACK_METRICS);
        return;
      }
      setMetrics({
        foldBoundary: calcFoldBoundary(msgs, max),
        historyIterCount: calcHistoryIterCount(msgs),
      });
    } catch {
      setMetrics(FALLBACK_METRICS);
    }
  }).current;

  try {
    if (!Array.isArray(messages) || !isValidMaxIters(maxIters)) {
      return {
        collapseCursor: FALLBACK_CURSOR,
        onExpandHistory: () => {},
        recalculate,
      };
    }

    const { foldBoundary, historyIterCount } = metrics;
    const visibleStartIndex =
      cursor != null && cursor.atHistoryIterCount === historyIterCount
        ? Math.min(cursor.visibleStartIndex, foldBoundary)
        : foldBoundary;

    const collapsedCount = visibleStartIndex;
    const collapseCursor = { visibleStartIndex, collapsedCount };

    const onExpandHistory = (type: "one" | "all") => {
      try {
        if (type === "all") {
          if (messages.length <= 0) return;
          setCursor({ visibleStartIndex: 0, atHistoryIterCount: historyIterCount });
          return;
        }

        const targetIndex = visibleStartIndex - 1;
        if (targetIndex < 0) return;
        setCursor({ visibleStartIndex: targetIndex, atHistoryIterCount: historyIterCount });
      } catch {
        // 折叠交互失败时保持当前渲染，不影响聊天主体。
      }
    };

    return {
      collapseCursor,
      onExpandHistory,
      recalculate,
    };
  } catch {
    return {
      collapseCursor: FALLBACK_CURSOR,
      onExpandHistory: () => {},
      recalculate,
    };
  }
}
