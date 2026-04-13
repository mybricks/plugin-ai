import type { CompactRecord, History, TurnRecord, VersionFile, VersionRecord } from "../types";

/** 基于 IndexedDB 的调用历史持久化（存储 TurnRecord[]） */
export class IDBHistory implements History {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private readonly storeName = "turns";
  private readonly compactStoreName = "compact";
  /**
   * 版本元数据 store（不含 files，只含 VersionRecord metadata 字段 + agentKey）。
   * keyPath: "id"，索引 "by_agentKey_createdAt" on [agentKey, createdAt]
   */
  private readonly versionMetaStoreName = "versions_meta";
  /**
   * 版本文件 store（VersionFile[] 按 versionId 存储）。
   * keyPath: "versionId"
   * 与 versions_meta 分离，使 listVersions 无需全量读取大文件对象。
   */
  private readonly versionFilesStoreName = "versions_files";
  private readonly version = 3;

  constructor(options: { dbName?: string } = {}) {
    this.dbName = options.dbName ?? "@plugin-ai/agent/history";
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(this.compactStoreName)) {
          db.createObjectStore(this.compactStoreName, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(this.versionMetaStoreName)) {
          const metaStore = db.createObjectStore(this.versionMetaStoreName, { keyPath: "id" });
          metaStore.createIndex("by_agentKey_createdAt", ["agentKey", "createdAt"], { unique: false });
        }
        if (!db.objectStoreNames.contains(this.versionFilesStoreName)) {
          db.createObjectStore(this.versionFilesStoreName, { keyPath: "versionId" });
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        // 校验核心 objectStore 是否存在，若缺失则强制删库重建
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.close();
          const deleteReq = indexedDB.deleteDatabase(this.dbName);
          deleteReq.onsuccess = () => this.openDB().then(resolve, reject);
          deleteReq.onerror = () => this.openDB().then(resolve, reject);
          return;
        }
        resolve(db);
      };

      req.onerror = () => reject(req.error);

      req.onblocked = () => {
        console.warn("[IDBHistory] database upgrade blocked");
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) {
      if (this.db.objectStoreNames.contains(this.storeName)) {
        return this.db;
      }
      this.db.close();
      this.db = null;
    }
    this.db = await this.openDB();
    return this.db;
  }

  // ── 对话记录 ──────────────────────────────────────────────────────────────
  //
  // 以下方法的 key 参数均为 agentKey（通常等于 comId）。
  // 多个 agent 共享同一个 IDBDatabase 实例，靠 agentKey 做分区隔离。

  async load(key: string): Promise<TurnRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () => resolve(req.result?.turns ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async append(key: string, record: TurnRecord): Promise<void> {
    const existing = await this.load(key);
    let safeRecord: TurnRecord;
    try {
      safeRecord = JSON.parse(JSON.stringify(record));
    } catch {
      console.warn("[IDBHistory] record contains non-serializable data, skipping append");
      return;
    }
    const turns = [...existing, safeRecord];
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const req = tx.objectStore(this.storeName).put({ key, turns });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async update(key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void> {
    const existing = await this.load(key);
    const idx = existing.findIndex((t) => t.id === turnId);
    if (idx === -1) return;
    existing[idx] = { ...existing[idx], ...patch };
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const req = tx.objectStore(this.storeName).put({ key, turns: existing });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [this.storeName, this.compactStoreName],
        "readwrite"
      );
      tx.objectStore(this.storeName).delete(key);
      tx.objectStore(this.compactStoreName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadCompact(key: string): Promise<CompactRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.compactStoreName, "readonly");
      const req = tx.objectStore(this.compactStoreName).get(key);
      req.onsuccess = () => resolve(req.result?.record ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveCompact(key: string, record: CompactRecord): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.compactStoreName, "readwrite");
      const req = tx.objectStore(this.compactStoreName).put({ key, record });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── 版本快照 ──────────────────────────────────────────────────────────────
  //
  // listVersions / addVersion 的 key 参数同为 agentKey，用于版本记录的分区隔离。
  // getVersion / getVersionFiles / updateVersion 以 versionId（uuid）精确定位，不需要 key。

  async listVersions(key: string): Promise<VersionRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.versionMetaStoreName, "readonly");
      const store = tx.objectStore(this.versionMetaStoreName);
      const index = store.index("by_agentKey_createdAt");
      // IDBKeyRange: agentKey === key，createdAt 任意 → 范围 [key, -∞] ~ [key, +∞]
      const range = IDBKeyRange.bound([key, -Infinity], [key, Infinity]);
      const req = index.getAll(range);
      req.onsuccess = () => {
        // 结果已按 [agentKey, createdAt] 升序（IDB 默认升序），去掉内部 agentKey 字段后返回
        const results: VersionRecord[] = (req.result ?? []).map(
          ({ agentKey: _agentKey, ...rest }) => rest as VersionRecord
        );
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async addVersion(key: string, record: VersionRecord, files: VersionFile[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [this.versionMetaStoreName, this.versionFilesStoreName],
        "readwrite"
      );
      // 写 metadata（附加 agentKey 供索引查询）
      tx.objectStore(this.versionMetaStoreName).put({ ...record, agentKey: key });
      // 写 files
      tx.objectStore(this.versionFilesStoreName).put({ versionId: record.id, files });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getVersionFiles(versionId: string): Promise<VersionFile[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.versionFilesStoreName, "readonly");
      const req = tx.objectStore(this.versionFilesStoreName).get(versionId);
      req.onsuccess = () => resolve(req.result?.files ?? []);
      req.onerror = () => reject(req.error);
    });
  }

  async getVersion(versionId: string): Promise<VersionRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.versionMetaStoreName, "readonly");
      const req = tx.objectStore(this.versionMetaStoreName).get(versionId);
      req.onsuccess = () => {
        if (!req.result) { resolve(null); return; }
        const { agentKey: _agentKey, ...rest } = req.result;
        resolve(rest as VersionRecord);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateVersion(
    versionId: string,
    patch: Partial<Pick<VersionRecord, "summary">>
  ): Promise<void> {
    const db = await this.getDB();
    // 先读出现有记录再合并写回，保留 agentKey 索引字段
    const existing: (VersionRecord & { agentKey: string }) | undefined = await new Promise(
      (resolve, reject) => {
        const tx = db.transaction(this.versionMetaStoreName, "readonly");
        const req = tx.objectStore(this.versionMetaStoreName).get(versionId);
        req.onsuccess = () => resolve(req.result ?? undefined);
        req.onerror = () => reject(req.error);
      }
    );
    if (!existing) return;
    const updated = { ...existing, ...patch };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.versionMetaStoreName, "readwrite");
      const req = tx.objectStore(this.versionMetaStoreName).put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
