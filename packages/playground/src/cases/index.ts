import type { TestCase } from "./types";
import {
  networkErrorCase,
  networkErrorDelayedCase,
  networkErrorAfterStreamCase,
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
  toolWriteLongFilenameCase,
} from "./tool-error";
import { customSlowToolCase, customToolValidationErrorThenSlowStreamCase } from "./custom-tool";
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
import { compactTriggerCase, compactWithToolsCase, compactWarmupByUsageCase, compactErrorCase, compactEmptyResponseCase, compactNoContentCase, compactInfiniteCase, compactRetrySuccessErrorCase, compactRetrySuccessTagCase } from "./compact";
import { markdownRichCase, userMessageWithLinksCase, streamingMarkdownCase, toolThenEmptyContentCase, assistantMessageWithLinksCase } from "./ui-render";
import {
  initProjectSingleFileCase,
  initProjectMultiFileCase,
  initProjectStreamingProgressCase,
  initProjectNoFilesCase,
  initProjectPartialFailureCase,
  initProjectIncompleteBlockCase,
  initProjectWithLanguageCase,
  initProjectLongWaitCase,
  initProjectRetryCase,
} from "./init-project";
import { multiEditSameFileCase } from "./multi-edit";
import { editDoomLoopCase, editNoDoomLoopCase } from "./edit-doom-loop";
import { editFewLinesCase } from "./edit-few-lines";
import { summaryBasicCase, summaryEmptyResponseCase } from "./summary";
import {
  webFetchBasicCase,
  webFetchFormatCase,
  webFetchImageCase,
  webFetchValidationCase,
  webFetchHttpErrorCase,
} from "./web-fetch";
import { settingCase } from "./setting";
import {
  grepDefaultFilesCase,
  grepContentGlobCase,
  grepCountPaginationCase,
  grepNoMatchCase,
  grepValidationCase,
} from "./grep-search";

export type { TestCase } from "./types";

export const ALL_CASES: TestCase[] = [
  // 网络中断
  networkErrorCase,
  networkErrorDelayedCase,
  networkErrorAfterStreamCase,
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
  streamingMarkdownCase,
  assistantMessageWithLinksCase,
  // 异常检测—工具后空 content
  toolThenEmptyContentCase,
  // 初始化项目 SubAgent
  initProjectSingleFileCase,
  initProjectMultiFileCase,
  initProjectStreamingProgressCase,
  initProjectNoFilesCase,
  initProjectPartialFailureCase,
  initProjectIncompleteBlockCase,
  initProjectWithLanguageCase,
  initProjectLongWaitCase,
  initProjectRetryCase,
  // 设置
  settingCase,
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
