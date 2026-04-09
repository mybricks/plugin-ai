import type { History, TurnRecord } from "../types";

/** 基于 IndexedDB 的调用历史持久化（存储 TurnRecord[]） */
export class IDBHistory implements History {
  private dbName: string;
  private db: IDBDatabase | null = null;
  private readonly storeName = "turns";
  private readonly version = 1;

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
      // 再次校验存活连接里 objectStore 是否齐全
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
    // 通过 JSON 往返过滤掉 undefined、循环引用、不可序列化对象等非标准数据
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

  async clear(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const req = tx.objectStore(this.storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
