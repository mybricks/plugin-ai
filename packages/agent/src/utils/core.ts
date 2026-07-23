import type { AgentMode, TurnRecord } from "../types";

/**
 * 从 TurnRecord 的 iterations 中提取该轮的运行模式。
 * 取最后一个有 mode 字段的 LLM iter；
 * 若所有 iter 均无 mode（旧数据或空轮），返回 "build"（默认模式）。
 *
 * 统一消化"undefined === build"的语义，调用方无需再做判断。
 */
export function getTurnMode(turn: TurnRecord): AgentMode {
  const iters = turn.iterations ?? [];
  for (let j = iters.length - 1; j >= 0; j--) {
    const iter = iters[j];
    // 跳过 warmup iter（带 type 字段）
    if ("type" in iter) continue;
    if ((iter as any).mode) return (iter as any).mode as AgentMode;
  }
  return "build";
}
