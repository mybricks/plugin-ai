import type { SubAgentTurnRecord, TurnRecord } from "../types";
import { readLegacySubAgentData } from "./legacy";

/**
 * 从平铺的 turn 列表中收集指定 agentKey 的记录，兼容旧版同步记录。
 */
export function collectSubAgentTurns(turns: TurnRecord[], agentKey: string): SubAgentTurnRecord[] {
  const records = new Map<string, SubAgentTurnRecord>();
  for (const turn of turns) {
    const legacy = readLegacySubAgentData(turn).records;
    const childTurns = [...legacy];
    if ("parentTurnId" in turn) childTurns.push(turn as SubAgentTurnRecord);
    for (const child of childTurns) {
      if (child.agentKey === agentKey) records.set(child.id, child);
    }
  }
  return [...records.values()].sort((a, b) => a.startTime - b.startTime);
}
