import type { CompactRecord, History, TurnRecord } from "../types";

/**
 * 基于 HTTP 接口的调用历史持久化（存储 TurnRecord[]）。
 *
 * 约定的接口规范：
 *   GET    /turns?key=<key>                    → { turns: TurnRecord[] }
 *   POST   /turns                               body: { key, turns: TurnRecord[] }  → 覆盖写
 *   PATCH  /turns?key=<key>&turnId=<id>         body: Partial<TurnRecord>            → 局部更新
 *   DELETE /turns?key=<key>                     → 清空
 *   GET    /compact?key=<key>                   → { record: CompactRecord } | {}
 *   POST   /compact                             body: { key, record: CompactRecord } → 覆盖写
 */
export class HTTPHistory implements History {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: { baseUrl: string; headers?: Record<string, string> }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.headers = options.headers ?? {};
  }

  private defaultHeaders() {
    return { "Content-Type": "application/json", ...this.headers };
  }

  async load(key: string): Promise<TurnRecord[]> {
    const res = await fetch(`${this.baseUrl}/turns?key=${encodeURIComponent(key)}`, {
      headers: this.defaultHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.turns ?? [];
  }

  async append(key: string, record: TurnRecord): Promise<void> {
    const existing = await this.load(key);
    const turns = [...existing, record];
    await fetch(`${this.baseUrl}/turns`, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, turns }),
    });
  }

  async update(key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void> {
    // TODO: 需要服务端支持 PATCH /turns?key=<key>&turnId=<id>
    // 当前实现：load → merge → 覆盖写（兜底方案，适合低并发场景）
    const existing = await this.load(key);
    const idx = existing.findIndex((t) => t.id === turnId);
    if (idx === -1) return;
    existing[idx] = { ...existing[idx], ...patch };
    await fetch(`${this.baseUrl}/turns`, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, turns: existing }),
    });
  }

  async clear(key: string): Promise<void> {
    await Promise.all([
      fetch(`${this.baseUrl}/turns?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: this.defaultHeaders(),
      }),
      fetch(`${this.baseUrl}/compact?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: this.defaultHeaders(),
      }),
    ]);
  }

  async loadCompact(key: string): Promise<CompactRecord | null> {
    const res = await fetch(`${this.baseUrl}/compact?key=${encodeURIComponent(key)}`, {
      headers: this.defaultHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.record ?? null;
  }

  async saveCompact(key: string, record: CompactRecord): Promise<void> {
    await fetch(`${this.baseUrl}/compact`, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, record }),
    });
  }
}
