/** 生成简单的随机 UUID（兼容浏览器和 Node 环境） */
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // fallback: RFC 4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SHORT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * 生成子 Agent 的 agentKey，形如 `agent_r19xd`（前缀 + 下划线 + 5 位 base36）。
 *
 * 这个值就是真实的 agentKey，落盘、事件、后续唤起子 Agent 全部用它，
 * 不是展示时再做的美化。5 位 base36 约 6000 万种组合，单会话内碰撞可忽略。
 */
export function createAgentKey(): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += SHORT_ID_ALPHABET[Math.floor(Math.random() * SHORT_ID_ALPHABET.length)];
  }
  return `agent_${suffix}`;
}
