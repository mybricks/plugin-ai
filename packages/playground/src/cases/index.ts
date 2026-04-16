import type { TestCase } from "./types";
import {
  networkErrorCase,
  networkErrorDelayedCase,
  networkErrorAfterStreamCase,
  toolCallArgsMidErrorCase,
} from "./network-error";
import {
  toolSuccessCase,
  toolWriteCase,
  toolMultiWriteCase,
  toolReadThenWriteCase,
  toolDeleteCase,
  toolNotFoundCase,
} from "./tool-error";
import {
  maskByTurnsCase,
  maskByAgeCase,
  maskToolHistoryCase,
} from "./mask";
import {
  multiTurnNormalCase,
  multiTurnMidErrorCase,
  multiTurnWithHistoryCase,
  thinkingCase,
} from "./multi-turn";
import {
  doomLoopCase,
  doomLoopThreshold5Case,
  abortCase,
  retrySuccessCase,
  maxStepsCase,
} from "./edge-cases";
import { compactTriggerCase, compactWithToolsCase } from "./compact";
import { markdownRichCase, userMessageWithLinksCase, streamingMarkdownCase, toolThenEmptyContentCase } from "./ui-render";

export type { TestCase } from "./types";

export const ALL_CASES: TestCase[] = [
  // 网络中断
  networkErrorCase,
  networkErrorDelayedCase,
  networkErrorAfterStreamCase,
  toolCallArgsMidErrorCase,
  // 工具调用（真实 MemFS）
  toolSuccessCase,
  toolWriteCase,
  toolMultiWriteCase,
  toolReadThenWriteCase,
  toolDeleteCase,
  toolNotFoundCase,
  // 多轮 ReAct
  multiTurnNormalCase,
  multiTurnMidErrorCase,
  multiTurnWithHistoryCase,
  thinkingCase,
  // 消息遮蔽
  maskByTurnsCase,
  maskByAgeCase,
  maskToolHistoryCase,
  // 异常检测
  doomLoopCase,
  doomLoopThreshold5Case,
  abortCase,
  retrySuccessCase,
  maxStepsCase,
  // Compact
  compactTriggerCase,
  compactWithToolsCase,
  // UI 渲染
  markdownRichCase,
  userMessageWithLinksCase,
  streamingMarkdownCase,
  // 异常检测—工具后空 content
  toolThenEmptyContentCase,
];

/** 按 group 分组 */
export function groupCases(cases: TestCase[]): Record<string, TestCase[]> {
  return cases.reduce(
    (acc, c) => {
      (acc[c.group] ??= []).push(c);
      return acc;
    },
    {} as Record<string, TestCase[]>
  );
}
