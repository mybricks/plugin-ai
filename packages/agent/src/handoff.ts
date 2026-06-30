import type { TurnRecord } from "./types";

// ─── HandoffOptions ─────────────────────────────────────────────────────────

/**
 * 历史消息 handoff 配置。
 *
 * 启用后，带有 `turn.handoff` 的成功历史轮次会在构建 LLM messages 时被替换为
 * user（原始用户消息）+ assistant（handoff 内容）两条消息。
 *
 * 默认不启用。
 */
export interface HandoffOptions {
  /** 是否启用 handoff 历史替换，默认 false */
  enabled?: boolean;
}

/**
 * 将 turn.handoff 格式化为替代历史轮次的 assistant 消息内容。
 */
export function formatHandoffMessageContent(handoff: string): string {
  const escapedHandoff = handoff
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<handoff-turn>
<notice>The following summary is a summary of this historical turn and replaces the original assistant/tool messages for that turn.</notice>
<summary>
${escapedHandoff}
</summary>
</handoff-turn>`;
}

/**
 * 计算哪些 turn 可以使用 handoff 替换。
 *
 * 命中条件：
 *   1. handoff.enabled 为 true
 *   2. turn 为 success 且未被 retried
 *   3. turn.handoff 有非空内容
 */
export function computeHandoffTurnIds(
  turns: TurnRecord[],
  options?: HandoffOptions | false
): Set<string> {
  const result = new Set<string>();
  if (!options || options.enabled !== true) return result;

  for (const turn of turns) {
    if (turn.status !== "success" || turn.retried) continue;
    if (turn.handoff?.trim()) {
      result.add(turn.id);
    }
  }

  return result;
}
