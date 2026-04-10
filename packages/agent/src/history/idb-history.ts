import type { CompactRecord, History, TurnRecord } from "../types";

/** 基于 IndexedDB 的调用历史持久化（存储 TurnRecord[]） */
export class IDBHistory implements History {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private readonly storeName = "turns";
  private readonly compactStoreName = "compact";
  private readonly version = 2;

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
      };

      req.onsuccess = () => {
        const db = req.result;
        // 校验 objectStore 是否存在，若缺失则强制删库重建
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
        // 有其他标签页持有旧版本连接，等待
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
      const tx = db.transaction([this.storeName, this.compactStoreName], "readwrite");
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
}
