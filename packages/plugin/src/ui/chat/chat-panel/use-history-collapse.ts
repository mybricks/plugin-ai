import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    try {
      if (!Array.isArray(messages) || !isValidMaxIters(maxIters)) {
        setMetrics(FALLBACK_METRICS);
        return;
      }
      setMetrics({
        foldBoundary: calcFoldBoundary(messages, maxIters),
        historyIterCount: calcHistoryIterCount(messages),
      });
    } catch {
      setMetrics(FALLBACK_METRICS);
    }
  }, [messages.length, maxIters]);

  const isValid = Array.isArray(messages) && isValidMaxIters(maxIters);
  const { foldBoundary, historyIterCount } = metrics;
  let visibleStartIndex: number;
  if (!isValid) {
    visibleStartIndex = 0;
  } else if (cursor != null && cursor.atHistoryIterCount === historyIterCount) {
    visibleStartIndex = Math.min(cursor.visibleStartIndex, foldBoundary);
  } else {
    visibleStartIndex = foldBoundary;
  }

  const onExpandHistory = useCallback((type: "one" | "all") => {
    if (!isValid) return;
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
  }, [historyIterCount, isValid, messages.length, visibleStartIndex]);

  if (!isValid) {
    return {
      collapseCursor: FALLBACK_CURSOR,
      onExpandHistory: () => {},
    };
  }

  return {
    collapseCursor: { visibleStartIndex, collapsedCount: visibleStartIndex },
    onExpandHistory,
  };
}
