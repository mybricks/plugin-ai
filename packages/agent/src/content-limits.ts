// ─── Agent 层内容大小限制 ──────────────────────────────────────────────────────
//
// 此文件集中管理 agent 内部的所有内容大小/长度限制常量。
// UI 侧（图片、文件 chip 等）的限制请见 packages/plugin/src/content-limits.ts。

/**
 * 工具调用结果的最大 token 数。
 * 超过此值时，agent 会以 error 形式返回，阻止 context 无限膨胀。
 */
export const TOOL_OUTPUT_MAX_TOKENS = 25_000;

/**
 * 工具输出内容的粗略 token 估算（所有工具统一使用，包含自定义工具）。
 *
 * 超限时将工具结果替换为错误提示，引导模型缩小查询范围或换用更精准的工具，
 * 而非把大量内容直接塞入上下文。
 */
export function roughTokenCountEstimation(
  content: string,
  bytesPerToken: number = 4,
): number {
  return Math.round(content.length / bytesPerToken);
}
