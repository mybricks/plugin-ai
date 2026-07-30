import type { Sandbox } from "../../../../../../agent/src/code-agent";

interface FileManifestItem {
  path: string;
  hash?: string;
  size?: number;
}

interface FileManifestResponse {
  workspaceId?: string;
  version?: number;
  files?: FileManifestItem[];
}

type FileOperation =
  | { type: "write"; path: string; hash: string; size: number }
  | { type: "delete"; path: string };

interface FileChange {
  version: number;
  ops: FileOperation[];
}

interface FileChangesResponse {
  workspaceId: string;
  currentVersion: number;
  fromVersion: number;
  snapshotRequired: boolean;
  changes: FileChange[];
}

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

/**
 * 按 client-guide.md 维护浏览器沙箱与 workspace 文件：
 * - 初始化时以服务端文件为准，hash diff 后拉取内容；
 * - 收到 workspace:file-change 后，按 version cursor 拉取一次增量；
 * - 文件写入/删除都由服务端完成，客户端只同步服务端结果。
 */
export class FileHmr {
  private sandbox?: Sandbox;
  private enabled = false;
  private version = 0;
  private localHashMap = new Map<string, string>();
  private initialized = false;
  private syncPromise: Promise<void> = Promise.resolve();
  private syncPending = false;
  private syncRequestedWhilePending = false;
  private requestedVersion = 0;

  constructor(
    private readonly options: {
      workspaceId: string;
      userId?: string;
      requestJson: RequestJson;
    },
  ) {}

  bindSandbox(sandbox: Sandbox): void {
    this.sandbox = sandbox;
    void this.syncSnapshot().catch((error) => {
      console.error("[plugin-ai] initialize remote file sync failed", error);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async ensureConnected(): Promise<void> {
    if (!this.enabled || !this.sandbox) return;
    if (!this.initialized) await this.syncSnapshot();
  }

  disconnect(): void {}

  async prepareRun(): Promise<void> {
    if (!this.enabled || !this.sandbox) return;
    if (!this.initialized) {
      await this.syncSnapshot();
    }
  }

  syncChanges(targetVersion?: number): Promise<void> {
    const sandbox = this.sandbox;
    if (!this.enabled || !sandbox || !this.initialized) {
      return Promise.resolve();
    }
    const target = Number(targetVersion) || this.version + 1;
    this.requestedVersion = Math.max(this.requestedVersion, target);
    if (this.requestedVersion <= this.version) return Promise.resolve();
    if (this.syncPending) {
      this.syncRequestedWhilePending = true;
      return this.syncPromise;
    }
    this.syncPending = true;
    this.syncRequestedWhilePending = false;
    this.syncPromise = this.syncPromise
      .catch(() => {
        // 前一次同步失败不阻塞后续文件事件触发的同步。
      })
      .then(async () => {
        while (this.requestedVersion > this.version) {
          const before = this.version;
          await this.pullRemoteChanges(sandbox);
          if (this.version <= before) break;
        }
      })
      .finally(() => {
        this.syncPending = false;
        if (
          this.syncRequestedWhilePending &&
          this.requestedVersion > this.version
        ) {
          this.syncRequestedWhilePending = false;
          void this.syncChanges(this.requestedVersion).catch((error) => {
            console.error(
              "[plugin-ai] retry queued workspace file sync failed",
              error,
            );
          });
        }
      });
    return this.syncPromise;
  }

  async syncSnapshot(sandbox = this.sandbox): Promise<void> {
    if (!sandbox) return;
    this.sandbox = sandbox;

    const manifestQuery = this.withUserId();
    const manifest = await this.options.requestJson<FileManifestResponse>(
      `${this.workspacePath("files")}${manifestQuery}`,
    );
    this.version = Number(manifest?.version ?? 0);

    const localFiles = await sandbox.getFiles();
    const localEntries = await mapWithConcurrency(localFiles, 4, async (file) => ({
      path: file.path,
      content: file.content,
      hash: await sha256(file.content),
    }));
    this.localHashMap = new Map(
      localEntries.map((file) => [file.path, file.hash]),
    );

    const remoteFiles = await mapWithConcurrency(
      (manifest?.files ?? []).filter((file) => !!file?.path),
      4,
      async (file) => {
        const localHash = this.localHashMap.get(file.path);
        if (file.hash && localHash === file.hash) return null;
        return this.readRemoteFile(file.path);
      },
    );
    const filesToUpdate = remoteFiles.filter(
      (file): file is { path: string; content: string } => !!file,
    );
    if (filesToUpdate.length) {
      await sandbox.updateFiles(filesToUpdate);
      const hashes = await mapWithConcurrency(filesToUpdate, 4, async (file) => ({
        path: file.path,
        hash: await sha256(file.content),
      }));
      for (const file of hashes) this.localHashMap.set(file.path, file.hash);
    }

    this.initialized = true;
  }

  private async pullRemoteChanges(sandbox: Sandbox): Promise<void> {
    const query = new URLSearchParams({
      sinceVersion: String(this.version),
    });
    if (this.options.userId) query.set("userId", this.options.userId);
    const response = await this.options.requestJson<FileChangesResponse>(
      `${this.workspacePath("files/changes")}?${query.toString()}`,
    );
    if (response.snapshotRequired) {
      await this.syncSnapshot(sandbox);
      return;
    }
    const changes = [...(response.changes ?? [])].sort(
      (left, right) => left.version - right.version,
    );

    for (const change of changes) {
      for (const operation of change.ops ?? []) {
        if (!operation?.path) continue;
        if (operation.type === "delete") {
          await sandbox.deleteFiles([operation.path]);
          this.localHashMap.delete(operation.path);
        } else if (this.localHashMap.get(operation.path) !== operation.hash) {
          const file = await this.readRemoteFile(operation.path);
          if (file) {
            await sandbox.updateFiles([file]);
            this.localHashMap.set(file.path, operation.hash);
          }
        }
      }
      this.version = Math.max(this.version, Number(change.version) || 0);
    }
    this.version = Math.max(
      this.version,
      Number(response.currentVersion) || 0,
    );
  }

  private async readRemoteFile(
    path: string,
  ): Promise<{ path: string; content: string } | null> {
    const query = new URLSearchParams({ path });
    if (this.options.userId) query.set("userId", this.options.userId);
    const response = await this.options.requestJson<
      string | { path?: string; content?: string } | null
    >(`${this.workspacePath("files/content")}?${query.toString()}`);
    if (typeof response === "string") return { path, content: response };
    if (!response) return null;
    return {
      path: response.path || path,
      content: String(response.content ?? ""),
    };
  }

  private workspacePath(action: string): string {
    return `/workspaces/${encodeURIComponent(this.options.workspaceId)}/${action}`;
  }

  private withUserId(): string {
    if (!this.options.userId) return "";
    return `?${new URLSearchParams({ userId: this.options.userId }).toString()}`;
  }
}

async function sha256(content: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is not available");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(concurrency, 1), values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
