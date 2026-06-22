import type { TestCase, Priority } from "./types";
import {
  networkErrorCase,
  networkErrorDelayedCase,
  networkErrorAfterStreamCase,
  networkErrorAfterToolCallNoHistoryCase,
  toolCallArgsMidErrorCase,
  networkErrorRetrySuccessCase,
  networkErrorMultiRetrySuccessCase,
  networkErrorRetryExhaustedCase,
  networkErrorStreamInterruptRetryCase,
  networkErrorBeforeToolRetryCase,
  networkErrorLongRetryCase,
} from "./network-error";
import {
  toolSuccessCase,
  toolWriteCase,
  toolMultiWriteCase,
  toolReadThenWriteCase,
  toolDeleteCase,
  toolNotFoundCase,
  toolWriteUnicodeEscapeCase,
  toolWriteUnicodeMidStreamCase,
  toolArgsJsonParseErrorCase,
  toolWriteLongFilenameCase,
} from "./tool-error";
import { customSlowToolCase, customToolRendererErrorBoundaryCase, customToolValidationErrorThenSlowStreamCase } from "./custom-tool";
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
  abortThenNextTurnAwarenessCase,
  retrySuccessCase,
  maxStepsCase,
} from "./edge-cases";
import { compactTriggerCase, compactWithToolsCase, compactWarmupByUsageCase, compactErrorCase, compactEmptyResponseCase, compactNoContentCase, compactInfiniteCase, compactRetrySuccessErrorCase, compactRetrySuccessTagCase, compactBinaryExpandSuccessCase, compactMidTurnErrorRetryCase } from "./compact";
import { markdownRichCase, userMessageWithLinksCase, userMessageWithTenImagesCase, assistantMessageWithMarkdownImageCase, streamingMarkdownCase, toolThenEmptyContentCase, assistantMessageWithLinksCase } from "./ui-render";
import { renderEmptyAboveCase } from "./ui-render-empty-above";
import { multiEditSameFileCase, multiEditPartialSuccessCase } from "./multi-edit";
import { editDoomLoopCase, editNoDoomLoopCase } from "./edit-doom-loop";
import { editFewLinesCase } from "./edit-few-lines";
import { summaryBasicCase, summaryEmptyResponseCase, suggestionsDisplayCase } from "./summary";
import {
  webFetchBasicCase,
  webFetchFormatCase,
  webFetchImageCase,
  webFetchValidationCase,
  webFetchHttpErrorCase,
} from "./web-fetch";
import { settingCase } from "./setting";
import { modelSwitchCase } from "./model-switch";
import { disabledModesPlanCase } from "./disabled-modes";
import {
  grepDefaultFilesCase,
  grepContentGlobCase,
  grepCountPaginationCase,
  grepNoMatchCase,
  grepValidationCase,
} from "./grep-search";
import { skillUseThenContinueCase } from "./skill";

export type { TestCase, Priority } from "./types";

export const ALL_CASES: TestCase[] = [
  // ─── P0 核心场景 ───────────────────────────────
  networkErrorCase,
  networkErrorAfterStreamCase,
  networkErrorAfterToolCallNoHistoryCase,
  compactMidTurnErrorRetryCase,
  multiEditPartialSuccessCase,
  skillUseThenContinueCase,
  suggestionsDisplayCase,
  abortThenNextTurnAwarenessCase,
  customToolRendererErrorBoundaryCase,
  // ─── 网络中断 ───────────────────────────────────
  networkErrorDelayedCase,
  toolCallArgsMidErrorCase,
  // 网络中断（带重试）
  networkErrorRetrySuccessCase,
  networkErrorMultiRetrySuccessCase,
  networkErrorRetryExhaustedCase,
  networkErrorStreamInterruptRetryCase,
  networkErrorBeforeToolRetryCase,
  networkErrorLongRetryCase,
  // 工具调用（真实 MemFS）
  toolSuccessCase,
  toolWriteCase,
  toolMultiWriteCase,
  toolReadThenWriteCase,
  toolDeleteCase,
  toolNotFoundCase,
  toolWriteUnicodeEscapeCase,
  toolWriteUnicodeMidStreamCase,
  toolArgsJsonParseErrorCase,
  toolWriteLongFilenameCase,
  customSlowToolCase,
  customToolValidationErrorThenSlowStreamCase,
  multiEditSameFileCase,
  editDoomLoopCase,
  editNoDoomLoopCase,
  editFewLinesCase,
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
  compactWarmupByUsageCase,
  compactErrorCase,
  compactEmptyResponseCase,
  compactNoContentCase,
  compactInfiniteCase,
  compactRetrySuccessErrorCase,
  compactRetrySuccessTagCase,
  compactBinaryExpandSuccessCase,
  // Summary
  summaryBasicCase,
  summaryEmptyResponseCase,
  // WebFetch
  webFetchBasicCase,
  webFetchFormatCase,
  webFetchImageCase,
  webFetchValidationCase,
  webFetchHttpErrorCase,
  // UI 渲染
  markdownRichCase,
  userMessageWithLinksCase,
  userMessageWithTenImagesCase,
  assistantMessageWithMarkdownImageCase,
  streamingMarkdownCase,
  assistantMessageWithLinksCase,
  renderEmptyAboveCase,
  // 异常检测—工具后空 content
  toolThenEmptyContentCase,
  // 设置
  settingCase,
  modelSwitchCase,
  disabledModesPlanCase,
  // Grep 搜索
  grepDefaultFilesCase,
  grepContentGlobCase,
  grepCountPaginationCase,
  grepNoMatchCase,
  grepValidationCase,
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
