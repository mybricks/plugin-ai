import type { MentionProvider } from "./types";

/**
 * 按 agentKey（comId 派生）隔离的 mention 注册表。
 * 与 chipRegistry 是同级机制：chipRegistry 管全局 chip 类型定义，
 * mentionRegistry 管"某个 comId 专属的 mention 候选来源"，
 * 由 connectToAI(comId, { mentions }) 注册，供该 comId 对应的 ChatPanel/Sender 读取。
 */
class MentionRegistry {
  private map = new Map<string, MentionProvider[]>();

  register(agentKey: string, mentions?: MentionProvider[]): void {
    if (!mentions?.length) {
      this.map.delete(agentKey);
      return;
    }
    this.map.set(agentKey, mentions);
  }

  unregister(agentKey: string): void {
    this.map.delete(agentKey);
  }

  get(agentKey?: string): MentionProvider[] {
    if (!agentKey) return [];
    return this.map.get(agentKey) ?? [];
  }
}

export const mentionRegistry = new MentionRegistry();
