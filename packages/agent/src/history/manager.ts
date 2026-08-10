import type { BoundHistory, CompactRecord, History, TurnRecord } from "../types";
import { bindHistory } from "../types";

export type HistoryStatus = "idle" | "loading" | "ready" | "error";

export interface HistoryManagerSnapshot {
  status: HistoryStatus;
  error: unknown;
  hasMore: boolean;
}

export type HistoryManagerListener = (snapshot: HistoryManagerSnapshot) => void;

/** ensureLoaded 返回的原始持久化数据（内部使用） */
export interface HistoryLoadResult {
  turns: TurnRecord[];
  compactRecord: CompactRecord | null;
}

/**
 * 纯状态机：只负责管理历史加载的生命周期（idle → loading → ready / error）。
 * turns 的内存存储由 Agent.turns 唯一持有，不在此处维护副本。
 * Agent 在写好 turns 之后调用 markReady()，保证订阅者收到通知时数据已就绪。
 */
export class HistoryManager {
  private status: HistoryStatus;
  private error: unknown = null;
  private loadPromise: Promise<HistoryLoadResult | null> | null = null;
  private listeners = new Set<HistoryManagerListener>();
  private hasMore: boolean = false;

  constructor(private readonly options: { history?: History | null; key?: string }) {
    this.status = options.history && options.key ? "idle" : "ready";
  }

  hasStorage(): boolean {
    return Boolean(this.options.history && this.options.key);
  }

  getSnapshot(): HistoryManagerSnapshot {
    return {
      status: this.status,
      error: this.error,
      hasMore: this.hasMore,
    };
  }

  subscribe(listener: HistoryManagerListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 触发持久化层加载，返回原始数据供 Agent 写入 turns。
   * - 无 storage：直接返回 null（状态已是 ready，无需加载）
   * - 已 ready：返回 null
   * - 加载中：复用同一个 Promise（幂等）
   * - error 状态：重新抛出错误
   *
   * 注意：此方法不自动调用 markReady()，Agent 负责在写好 turns 后调用。
   */
  async ensureLoaded(): Promise<HistoryLoadResult | null> {
    if (!this.options.history || !this.options.key) {
      // 无 storage，直接标记 ready（若还没有）
      if (this.status !== "ready") {
        this.status = "ready";
        this.emit();
      }
      return null;
    }
    if (this.status === "ready") return null;
    if (this.status === "loading" && this.loadPromise) return this.loadPromise;
    if (this.status === "error") throw this.error;

    this.status = "loading";
    this.error = null;
    this.emit();

    this.loadPromise = this.load().finally(() => {
      this.loadPromise = null;
    });
    return this.loadPromise;
  }

  /**
   * Agent 在将 turns 写入内存后调用，将状态切为 ready 并通知订阅者。
   * 此时订阅者调用 agent.getTurns() 能拿到完整数据。
   */
  markReady(opts?: { hasMore?: boolean }): void {
    this.status = "ready";
    this.error = null;
    if (opts?.hasMore !== undefined) this.hasMore = opts.hasMore;
    this.emit();
  }

  async loadTurns(options: { after?: string; before?: string; limit?: number }): Promise<{ turns: TurnRecord[]; hasMore: boolean } | null> {
    const { history, key } = this.options;
    if (!history || !key || !history.loadTurns) return null;
    return history.loadTurns(key, options);
  }

  async append(record: TurnRecord): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.append(key, record);
  }

  async update(turnId: string, patch: Partial<TurnRecord>): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.update(key, turnId, patch);
  }

  async replaceTurn(record: TurnRecord): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.update(key, record.id, record);
  }

  async clear(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.clear(key);
    this.status = "ready";
    this.error = null;
    this.emit();
  }

  async saveCompact(record: CompactRecord): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.saveCompact(key, record);
  }

  getBoundHistory(): BoundHistory | null {
    const { history, key } = this.options;
    if (!history || !key) return null;
    return bindHistory(history, key);
  }

  private async load(): Promise<HistoryLoadResult> {
    const { history, key } = this.options;
    if (!history || !key) {
      return { turns: [], compactRecord: null };
    }

    try {
      let compactRecord: CompactRecord | string | null = null;
      if (history?.loadCompact) {
        compactRecord = await history.loadCompact(key);
        if (compactRecord && typeof compactRecord === "string") {
          try {
            const parsed = JSON.parse(compactRecord as any);
            compactRecord = parsed && "upToTurnId" in parsed ? parsed : null;
          } catch {
            compactRecord = null;
          }
        }
      }

      // 支持分页且已有 compact 边界时，首屏只需要 compact 之后的 turns。
      // 不要先调用 load()，否则远端 History 仍会发生一次全量拉取。
      if (compactRecord && history.loadTurns) {
        return { turns: [], compactRecord: compactRecord as CompactRecord };
      }

      // 不支持分页（或没有 compact 边界）时保持原有全量加载兼容行为。
      const turns = await history.load(key);
      // 注意：不在这里 emit ready，由 Agent.ensureHistoryReady 在写好 turns 后调 markReady()
      return { turns, compactRecord: compactRecord as CompactRecord | null };
    } catch (error) {
      this.status = "error";
      this.error = error;
      this.emit();
      throw error;
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
