import type { CompactRecord, History, TurnRecord, VersionFile, VersionRecord } from "../types";

/**
 * 基于 HTTP 接口的调用历史持久化（存储 TurnRecord[]）。
 *
 * 约定的接口规范：
 *   GET    /turns?key=<key>                           → { turns: TurnRecord[] }
 *   POST   /turns                                     body: { key, turns: TurnRecord[] }  → 覆盖写
 *   PATCH  /turns?key=<key>&turnId=<id>               body: Partial<TurnRecord>            → 局部更新
 *   DELETE /turns?key=<key>                           → 清空
 *   GET    /compact?key=<key>                         → { record: CompactRecord } | {}
 *   POST   /compact                                   body: { key, record: CompactRecord } → 覆盖写
 *
 *   GET    /versions?key=<key>                        → { versions: VersionRecord[] }      （仅 metadata，不含 files）
 *   POST   /versions                                  body: { key, record: VersionRecord, files: VersionFile[] }
 *   GET    /versions/<versionId>?key=<key>            → { record: VersionRecord } | {}
 *   PATCH  /versions/<versionId>?key=<key>            body: Partial<Pick<VersionRecord,'summary'>>
 *   GET    /versions/<versionId>/files?key=<key>      → { files: VersionFile[] }
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

  // ── 对话记录 ──────────────────────────────────────────────────────────────

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

  async import(key: string, turns: TurnRecord[]): Promise<void> {
    await fetch(`${this.baseUrl}/turns`, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, turns }),
    });
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

  // ── 版本快照 ──────────────────────────────────────────────────────────────

  async listVersions(key: string, params: { pageSize: number; pageNum: number }): Promise<{ total: number; list: VersionRecord[] }> {
    const res = await fetch(`${this.baseUrl}/versions?key=${encodeURIComponent(key)}&pageSize=${params.pageSize}&pageNum${params.pageNum}`, {
      headers: this.defaultHeaders(),
    });
    if (!res.ok) return { list: [], total: 0 };
    const data = await res.json();
    return data
  }

  async addVersion(key: string, record: VersionRecord, files: VersionFile[]): Promise<void> {
    await fetch(`${this.baseUrl}/versions`, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, record, files }),
    });
  }

  async getVersion(versionId: string): Promise<VersionRecord | null> {
    const res = await fetch(
      `${this.baseUrl}/versions/${encodeURIComponent(versionId)}`,
      { headers: this.defaultHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.record ?? null;
  }

  async updateVersion(
    versionId: string,
    patch: Partial<Pick<VersionRecord, "summary">>
  ): Promise<void> {
    await fetch(
      `${this.baseUrl}/versions/${encodeURIComponent(versionId)}`,
      {
        method: "PATCH",
        headers: this.defaultHeaders(),
        body: JSON.stringify(patch),
      }
    );
  }

  async getVersionFiles(versionId: string): Promise<VersionFile[]> {
    const res = await fetch(
      `${this.baseUrl}/versions/${encodeURIComponent(versionId)}/files`,
      { headers: this.defaultHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.files ?? [];
  }
}
