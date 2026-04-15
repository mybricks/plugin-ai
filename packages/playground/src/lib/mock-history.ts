import type { History, TurnRecord, CompactRecord, VersionRecord, VersionFile } from "@agent/types";

/**
 * 内存版 History 实现，供 playground 使用。
 * 构造时传入预设的 turns，模拟"已有历史"场景。
 * 每次 case 切换时 new 一个新实例即可重置。
 */
export class MockHistory implements History {
  private turns: TurnRecord[];
  private compact: CompactRecord | null;

  constructor(initialTurns: TurnRecord[] = [], compact: CompactRecord | null = null) {
    this.turns = [...initialTurns];
    this.compact = compact;
  }

  async load(_key: string): Promise<TurnRecord[]> {
    return [...this.turns];
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
