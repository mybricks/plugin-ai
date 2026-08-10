import type { History, TurnRecord, CompactRecord, VersionRecord, VersionFile } from "@agent/types";

/**
 * 内存版 History 实现，供 playground 使用。
 * 构造时传入预设的 turns，模拟"已有历史"场景。
 * 每次 case 切换时 new 一个新实例即可重置。
 */
export class MockHistory implements History {
  private turns: TurnRecord[];
  private compact: CompactRecord | null;
  private loadDelayMs: number;
  private loadError: boolean;
  private pageDelayMs: number;
  loadTurns?: History["loadTurns"];

  constructor(
    initialTurns: TurnRecord[] = [],
    compact: CompactRecord | null = null,
    opts?: { loadDelayMs?: number; loadError?: boolean; pageDelayMs?: number; supportsPagination?: boolean }
  ) {
    this.turns = [...initialTurns];
    this.compact = compact;
    this.loadDelayMs = opts?.loadDelayMs ?? 0;
    this.loadError = opts?.loadError ?? false;
    this.pageDelayMs = opts?.pageDelayMs ?? 0;
    if (opts?.supportsPagination !== false) {
      this.loadTurns = this.loadTurnsImpl.bind(this);
    }
  }

  async load(_key: string): Promise<TurnRecord[]> {
    if (this.loadDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.loadDelayMs));
    }
    if (this.loadError) {
      throw new Error("MockHistory: 模拟历史记录加载失败");
    }
    return [...this.turns];
  }

  private async loadTurnsImpl(_key: string, options: { after?: string; before?: string; limit?: number }): Promise<{ turns: TurnRecord[]; hasMore: boolean }> {
    const { after, before, limit } = options;
    let result = [...this.turns];

    if (after !== undefined) {
      const idx = result.findIndex((t) => t.id === after);
      const beforeCount = idx >= 0 ? idx + 1 : 0;
      result = idx >= 0 ? result.slice(idx + 1) : result;
      return { turns: result, hasMore: beforeCount > 0 };
    }

    if (before !== undefined) {
      const idx = result.findIndex((t) => t.id === before);
      result = idx >= 0 ? result.slice(0, idx) : result;
    }

    if (before !== undefined && limit !== undefined) {
      if (this.pageDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.pageDelayMs));
      }
      const hasMore = result.length > limit;
      result = result.slice(-limit);
      return { turns: result, hasMore };
    }

    return { turns: result, hasMore: false };
  }

  async append(_key: string, record: TurnRecord): Promise<void> {
    this.turns.push(record);
  }

  async update(_key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void> {
    const idx = this.turns.findIndex((t) => t.id === turnId);
    if (idx !== -1) {
      this.turns[idx] = { ...this.turns[idx], ...patch };
    }
  }

  async clear(_key: string): Promise<void> {
    this.turns = [];
    this.compact = null;
  }

  async loadCompact(_key: string): Promise<CompactRecord | null> {
    return this.compact;
  }

  async saveCompact(_key: string, record: CompactRecord): Promise<void> {
    this.compact = record;
  }

  async listVersions(_key: string): Promise<VersionRecord[]> {
    return [];
  }

  async addVersion(_key: string, _record: VersionRecord, _files: VersionFile[]): Promise<void> {}

  async getVersionFiles(_versionId: string): Promise<VersionFile[]> {
    return [];
  }

  async getVersion(_versionId: string): Promise<VersionRecord | null> {
    return null;
  }

  async updateVersion(_versionId: string, _patch: Partial<VersionRecord>): Promise<void> {}
}
