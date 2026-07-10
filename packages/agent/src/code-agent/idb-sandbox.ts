import type { GetFilesOptions, Sandbox, UnifiedFile } from "./index";

type MaybePromise<T> = T | Promise<T>;

export interface IDBSandboxOptions {
  /** 存储分区 key，通常与 Agent key 保持一致。 */
  key: string;
  /** IndexedDB database 名称。 */
  dbName?: string;
  /**
   * 初始文件。
   *
   * 仅在当前 key 没有任何 sandbox state 时写入，避免刷新页面或重复构造时覆盖已有文件。
   */
  initialFiles?: UnifiedFile[];
  /** 静态背景上下文，透传给 CodeAgent。 */
  getContext?: () => MaybePromise<string | null>;
  /** 项目空间元信息，透传给 CodeAgent。 */
  getSandboxMetaSection?: () => MaybePromise<string | null>;
}

export interface IDBSandboxFileRecord {
  path: string;
  content: string;
  permissions?: UnifiedFile["permissions"];
  createdAt: number;
  updatedAt: number;
}

export interface IDBSandboxState {
  key: string;
  files: Record<string, IDBSandboxFileRecord>;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_DB_NAME = "@plugin-ai/code-agent/sandbox";
const STORE_NAME = "sandboxes";
const DB_VERSION = 1;

const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\/+/, "");

function assertValidPath(path: string): string {
  const normalized = normalizePath(path).trim();
  if (!normalized || normalized === "." || normalized === ".." || normalized.includes("../")) {
    throw new Error(`Invalid file path: ${path}`);
  }
  return normalized;
}

function isFileExcluded(file: UnifiedFile, exclude?: GetFilesOptions["exclude"]): boolean {
  if (!exclude) return false;
  const excludes = Array.isArray(exclude) ? exclude : [exclude];
  const normalizedPath = normalizePath(file.path);

  return excludes.some((pattern) => {
    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      return pattern.test(normalizedPath);
    }

    const normalizedPattern = normalizePath(pattern);
    const directoryPattern = normalizedPattern.endsWith("/")
      ? normalizedPattern
      : `${normalizedPattern}/`;
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(directoryPattern);
  });
}

function toFile(record: IDBSandboxFileRecord): UnifiedFile {
  return {
    path: record.path,
    content: record.content,
    ...(record.permissions ? { permissions: record.permissions } : {}),
  };
}

function toRecord(file: UnifiedFile, now: number, previous?: IDBSandboxFileRecord): IDBSandboxFileRecord {
  const path = assertValidPath(file.path);
  return {
    path,
    content: file.content,
    ...(file.permissions ? { permissions: file.permissions } : previous?.permissions ? { permissions: previous.permissions } : {}),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

export class IDBSandbox implements Sandbox {
  private readonly key: string;
  private readonly dbName: string;
  private readonly initialFiles: UnifiedFile[];
  private readonly resolveContext?: IDBSandboxOptions["getContext"];
  private readonly resolveSandboxMetaSection?: IDBSandboxOptions["getSandboxMetaSection"];
  private db: IDBDatabase | null = null;

  constructor(options: IDBSandboxOptions) {
    if (!options.key || typeof options.key !== "string") {
      throw new Error("IDBSandbox option key is required");
    }
    this.key = options.key;
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.initialFiles = options.initialFiles ?? [];
    this.resolveContext = options.getContext;
    this.resolveSandboxMetaSection = options.getSandboxMetaSection;
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this environment"));
        return;
      }

      const req = indexedDB.open(this.dbName, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => {
        console.warn("[IDBSandbox] database upgrade blocked");
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db && this.db.objectStoreNames.contains(STORE_NAME)) {
      return this.db;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.db = await this.openDB();
    return this.db;
  }

  private async loadState(): Promise<IDBSandboxState | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(this.key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async saveState(state: IDBSandboxState): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).put(state);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private createInitialState(): IDBSandboxState {
    const now = Date.now();
    const files: Record<string, IDBSandboxFileRecord> = {};
    for (const file of this.initialFiles) {
      const record = toRecord(file, now);
      files[record.path] = record;
    }
    return { key: this.key, files, createdAt: now, updatedAt: now };
  }

  private async ensureState(): Promise<IDBSandboxState> {
    const existing = await this.loadState();
    if (existing) return existing;

    const state = this.createInitialState();
    await this.saveState(state);
    return state;
  }

  async getFiles(options?: GetFilesOptions): Promise<UnifiedFile[]> {
    const state = await this.ensureState();
    const files = Object.values(state.files).map(toFile);
    return options?.exclude ? files.filter((file) => !isFileExcluded(file, options.exclude)) : files;
  }

  async updateFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    const state = await this.ensureState();
    const now = Date.now();

    for (const file of files) {
      const path = assertValidPath(file.path);
      const previous = state.files[path];
      if (previous?.permissions?.write === false) {
        throw new Error(`${path} is read-only`);
      }
      state.files[path] = {
        path,
        content: file.content,
        ...(previous?.permissions ? { permissions: previous.permissions } : {}),
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
    }

    state.updatedAt = now;
    await this.saveState(state);
  }

  async deleteFiles(paths: string[]): Promise<void> {
    const state = await this.ensureState();
    const now = Date.now();

    for (const rawPath of paths) {
      const path = assertValidPath(rawPath);
      const previous = state.files[path];
      if (previous?.permissions?.delete === false) {
        throw new Error(`${path} cannot be deleted`);
      }
      delete state.files[path];
    }

    state.updatedAt = now;
    await this.saveState(state);
  }

  async getContext(): Promise<string | null> {
    return (await this.resolveContext?.()) ?? null;
  }

  async getSandboxMetaSection(): Promise<string | null> {
    return (await this.resolveSandboxMetaSection?.()) ?? null;
  }

  async importFiles(files: UnifiedFile[], options: { clear?: boolean } = {}): Promise<void> {
    const state = options.clear
      ? this.createInitialState()
      : await this.ensureState();
    const now = Date.now();

    if (options.clear) {
      state.files = {};
      state.createdAt = now;
    }

    for (const file of files) {
      const path = assertValidPath(file.path);
      state.files[path] = toRecord(file, now, state.files[path]);
    }

    state.updatedAt = now;
    await this.saveState(state);
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(this.key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
