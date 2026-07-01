// ─── Agent 层内容大小限制 ──────────────────────────────────────────────────────
//
// 此文件集中管理 agent 内部的所有内容大小/长度限制常量。
// UI 侧（图片、文件 chip 等）的限制请见 packages/plugin/src/content-limits.ts。

/**
 * 工具调用结果的最大 token 数。
 * 超过此值时，agent 会以 error 形式返回，阻止 context 无限膨胀。
 */
export const TOOL_OUTPUT_MAX_TOKENS = 25_000;
