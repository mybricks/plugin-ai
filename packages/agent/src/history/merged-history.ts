import type { CompactRecord, History, HistoryPersistMode, TurnRecord, VersionFile, VersionRecord } from "../types";

/**
 * 以 primary History（SessionHTTPHistory）为主，
 * 版本快照相关能力在传入 fallback History 时优先使用 fallback。
 *
 * 用于 WebSocket Agent 场景：历史读取/写入由服务端会话接口负责，
 * 版本快照复用本地传入的 IDBHistory 等实现。
 */
export class MergedHistory implements History {
  get persistMode(): HistoryPersistMode {
    return this.primary.persistMode ?? "turn";
  }

  constructor(
    private primary: History,
    private fallback?: History,
  ) {}

  // ── 对话记录：全走 primary ──

  load(key: string): Promise<TurnRecord[]> {
    return this.primary.load(key);
  }

  loadTurns(
    key: string,
    options: { after?: string; before?: string; limit?: number },
  ): Promise<{ turns: TurnRecord[]; hasMore: boolean }> {
    if (!this.primary.loadTurns) {
      return this.primary.load(key).then((turns) => ({ turns, hasMore: false }));
    }
    return this.primary.loadTurns(key, options);
  }

  append(key: string, record: TurnRecord): Promise<void> {
    return this.primary.append(key, record);
  }

  update(key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void> {
    return this.primary.update(key, turnId, patch);
  }

  clear(key: string): Promise<void> {
    return this.primary.clear(key);
  }

  import(key: string, turns: TurnRecord[]): Promise<void> {
    return this.primary.import(key, turns);
  }

  // ── compact：走 primary ──

  loadCompact(key: string): Promise<CompactRecord | null> {
    return this.primary.loadCompact(key);
  }

  saveCompact(key: string, record: CompactRecord): Promise<void> {
    return this.primary.saveCompact(key, record);
  }

  // ── 版本快照：有 fallback 时优先 fallback，否则保持 primary ──

  private get versionHistory(): History {
    return this.fallback ?? this.primary;
  }

  listVersions(
    key: string,
    params?: { pageSize?: number; pageNum?: number },
  ): Promise<{ total: number; list: VersionRecord[] }> {
    return this.versionHistory.listVersions(key, params);
  }

  addVersion(key: string, record: VersionRecord, files: VersionFile[]): Promise<void> {
    return this.versionHistory.addVersion(key, record, files);
  }

  getVersion(versionId: string): Promise<VersionRecord | null> {
    return this.versionHistory.getVersion(versionId);
  }

  updateVersion(
    versionId: string,
    patch: Partial<Pick<VersionRecord, "summary">> & { files?: VersionFile[] },
  ): Promise<void> {
    return this.versionHistory.updateVersion(versionId, patch);
  }

  getVersionFiles(versionId: string): Promise<VersionFile[]> {
    return this.versionHistory.getVersionFiles(versionId);
  }
}
