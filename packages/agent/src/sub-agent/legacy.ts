import type { SubAgentTurnRecord, TurnRecord } from "../types";

/**
 * @deprecated 仅用于读取旧版历史：同步子任务曾放在 iteration.turns，
 * UI 进度也曾重复保存在 tool.progress / result.metadata.iterations。
 * 新子 turn 独立保存；旧数据不再需要后可移除此函数。
 */
export function readLegacySubAgentData(
  turn?: Pick<TurnRecord, "iterations">,
  tool?: { progress?: any; result?: { metadata?: Record<string, any> } },
): { records: SubAgentTurnRecord[]; iterations: unknown[] } {
  const records: SubAgentTurnRecord[] = [];
  for (const iteration of turn?.iterations ?? []) {
    if ("type" in iteration) continue;
    records.push(...(iteration.turns ?? []));
  }
  let iterations: unknown[] = [];
  if (Array.isArray(tool?.progress?.iterations)) {
    iterations = tool.progress.iterations;
  } else if (Array.isArray(tool?.result?.metadata?.iterations)) {
    iterations = tool.result.metadata.iterations;
  }
  return { records, iterations };
}
