import type { Sandbox } from "../../../../../../agent/src/code-agent";
import type {
  WorkspaceJoinResponse,
  WorkspaceSocket,
} from "./workspace-socket";

interface FileTreeItem {
  path: string;
  content?: string;
  hash?: string;
  size?: number;
}

interface FileTreeResponse {
  workspaceId: string;
  version?: number;
  files?: FileTreeItem[];
}

export interface BrowserFileChangeEvent {
  version: number;
  changes: Array<{ path: string; hash: string | null }>;
}

type RequestJson = <T = unknown>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export class FileHmr {
  private sandbox?: Sandbox;
  private enabled = false;
  private version = 0;
  private manifestReady = false;
  private baselineReady = false;
  private joinReady = false;
  private applyFailed = false;
  private pendingChanges: BrowserFileChangeEvent[] = [];
  private applyPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: {
      workspaceId: string;
      requestJson: RequestJson;
      socket: WorkspaceSocket<BrowserFileChangeEvent>;
    },
  ) {
    options.socket.onJoin((response) => this.handleJoin(response));
    options.socket.onDisconnect(() => this.handleDisconnect());
    options.socket.on<BrowserFileChangeEvent>("file:change", (event) => {
      this.handleFileChange(event);
    });
  }

  getVersion(): number {
    return this.version;
  }

  isApplyFailed(): boolean {
    return this.applyFailed;
  }

  bindSandbox(sandbox: Sandbox): void {
    this.sandbox = sandbox;
    void this.syncSnapshot().catch((error) => {
      console.error("[plugin-ai] sync remote files snapshot failed", error);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.options.socket.disconnect();
      return;
    }
    if (this.applyFailed && this.sandbox) {
      void this.syncSnapshot().catch((error) => {
        console.error("[plugin-ai] recover remote files snapshot failed", error);
      });
      return;
    }
    if (this.manifestReady) void this.ensureConnected();
  }

  async ensureConnected(): Promise<void> {
    if (!this.enabled || !this.sandbox) return;
    await this.options.socket.connect();
  }

  disconnect(): void {
    this.options.socket.disconnect();
  }

  async syncSnapshot(sandbox = this.sandbox): Promise<void> {
    if (!sandbox) return;
    const tree = await this.options.requestJson<FileTreeResponse>(
      `/workspaces/${encodeURIComponent(this.options.workspaceId)}/files`,
    );
    this.version = Number(tree.version || 0);
    this.manifestReady = true;
    this.baselineReady = false;
    this.applyFailed = false;
    if (this.enabled) void this.ensureConnected();

    const existing = await this.getSandboxFiles(sandbox);
    const existingByPath = new Map(
      existing.map((file) => [file.path, file] as const),
    );
    const remotePaths = new Set(
      (tree.files ?? []).map((file) => file.path).filter(Boolean),
    );
    const deletePaths = existing
      .map((file) => file.path)
      .filter((path) => !remotePaths.has(path));

    const files = await mapWithConcurrency(tree.files ?? [], 4, async (file) => {
      if (!file?.path) return null;
      const local = existingByPath.get(file.path);
      if (local && file.hash) {
        const localHash = await sha256(local.content);
        if (localHash === file.hash) return null;
      } else if (
        local &&
        "content" in file &&
        local.content === String(file.content ?? "")
      ) {
        return null;
      }
      return this.resolveRemoteFile(file);
    });
    const writableFiles = files.filter(
      (file): file is { path: string; content: string } => !!file,
    );
    for (const batch of splitFileBatches(writableFiles)) {
      this.logUpdateFiles("snapshot", batch);
      await sandbox.updateFiles(batch);
    }
    if (deletePaths.length) await sandbox.deleteFiles(deletePaths);

    this.baselineReady = true;
    await this.flushPendingChanges();
  }

  private async handleJoin(
    response: WorkspaceJoinResponse<BrowserFileChangeEvent>,
  ): Promise<void> {
    this.joinReady = true;
    this.pendingChanges.push(...(response.changes ?? []));
    if (response.snapshotRequired || this.applyFailed) {
      await this.syncSnapshot().catch((error) => {
        console.error("[plugin-ai] resync remote files snapshot failed", error);
      });
      return;
    }
    await this.flushPendingChanges();
  }

  private handleDisconnect(): void {
    this.joinReady = false;
    this.pendingChanges = [];
  }

  private handleFileChange(event: BrowserFileChangeEvent): void {
    if (!event || !Number.isFinite(event.version)) return;
    console.info("[plugin-ai][files] received file:change", {
      workspaceId: this.options.workspaceId,
      version: event.version,
      currentVersion: this.version,
      changes: event.changes,
      baselineReady: this.baselineReady,
      joinReady: this.joinReady,
      applyFailed: this.applyFailed,
    });
    if (!this.baselineReady || !this.joinReady || this.applyFailed) {
      console.info("[plugin-ai][files] queue pending file:change", {
        workspaceId: this.options.workspaceId,
        version: event.version,
        pendingCount: this.pendingChanges.length + 1,
      });
      this.pendingChanges.push(event);
      return;
    }
    this.enqueueChange(event);
  }

  private enqueueChange(event: BrowserFileChangeEvent): void {
    const sandbox = this.sandbox;
    if (!sandbox) {
      this.pendingChanges.push(event);
      return;
    }
    console.info("[plugin-ai][files] enqueue file:change", {
      workspaceId: this.options.workspaceId,
      version: event.version,
      currentVersion: this.version,
      changes: event.changes,
    });
    this.applyPromise = this.applyPromise
      .then(async () => {
        if (event.version < this.version) {
          console.info("[plugin-ai][files] skip stale file:change", {
            workspaceId: this.options.workspaceId,
            eventVersion: event.version,
            currentVersion: this.version,
          });
          return;
        }
        await this.applyChange(event, sandbox);
        this.version = event.version;
      })
      .catch((error) => {
        this.applyFailed = true;
        this.options.socket.emit("browser:not-ready", {
          workspaceId: this.options.workspaceId,
        });
        console.error("[plugin-ai] apply remote file change failed", error);
      });
  }

  private async flushPendingChanges(): Promise<void> {
    if (!this.baselineReady || !this.joinReady || this.applyFailed) {
      console.info("[plugin-ai][files] skip flushing pending changes", {
        workspaceId: this.options.workspaceId,
        pendingCount: this.pendingChanges.length,
        baselineReady: this.baselineReady,
        joinReady: this.joinReady,
        applyFailed: this.applyFailed,
      });
      return;
    }

    const pending = this.pendingChanges
      .splice(0)
      .sort((left, right) => left.version - right.version);
    console.info("[plugin-ai][files] flush pending file:changes", {
      workspaceId: this.options.workspaceId,
      versions: pending.map((event) => event.version),
    });
    for (const event of pending) this.enqueueChange(event);

    let applying = this.applyPromise;
    await applying;
    while (applying !== this.applyPromise) {
      applying = this.applyPromise;
      await applying;
    }

    if (
      !this.options.socket.connected ||
      !this.baselineReady ||
      !this.joinReady ||
      this.applyFailed
    ) {
      return;
    }
    this.options.socket.emit("browser:ready", {
      workspaceId: this.options.workspaceId,
      version: this.version,
    });
  }

  private async applyChange(
    event: BrowserFileChangeEvent,
    sandbox: Sandbox,
  ): Promise<void> {
    const latestByPath = new Map<
      string,
      { path: string; hash: string | null }
    >();
    for (const change of event.changes ?? []) {
      const path = String(change?.path ?? "");
      if (path) latestByPath.set(path, { path, hash: change.hash ?? null });
    }
    const deletePaths: string[] = [];
    const writes: Array<{ path: string; hash: string | null }> = [];
    for (const change of latestByPath.values()) {
      if (change.hash === null) deletePaths.push(change.path);
      else writes.push(change);
    }
    console.info("[plugin-ai][files] apply file:change", {
      workspaceId: this.options.workspaceId,
      version: event.version,
      writes: writes.map((change) => change.path),
      deletes: deletePaths,
    });

    const files = (
      await mapWithConcurrency(writes, 4, (change) =>
        this.readRemoteFile(change.path),
      )
    ).filter(
      (file): file is { path: string; content: string } => file !== null,
    );
    for (const batch of splitFileBatches(files)) {
      this.logUpdateFiles("change", batch);
      await sandbox.updateFiles(batch);
    }
    if (deletePaths.length) await sandbox.deleteFiles(deletePaths);
  }

  private logUpdateFiles(
    source: "snapshot" | "change",
    files: Array<{ path: string; content: string }>,
  ): void {
    console.log("[plugin-ai][files] sandbox.updateFiles", {
      source,
      workspaceId: this.options.workspaceId,
      files,
    });
  }

  private async readRemoteFile(
    path: string,
  ): Promise<{ path: string; content: string } | null> {
    console.info("[plugin-ai][files] read remote file", {
      workspaceId: this.options.workspaceId,
      path,
    });
    const query = new URLSearchParams({ path });
    const file = await this.options.requestJson<{
      path?: string;
      content?: string;
    } | null>(
      `/workspaces/${encodeURIComponent(this.options.workspaceId)}/files/content?${query.toString()}`,
    );
    if (!file?.path) return null;
    return { path: file.path, content: String(file.content ?? "") };
  }

  private async resolveRemoteFile(
    file: FileTreeItem,
  ): Promise<{ path: string; content: string } | null> {
    if (!file?.path) return null;
    if ("content" in file) {
      return { path: file.path, content: String(file.content ?? "") };
    }
    return this.readRemoteFile(file.path);
  }

  private async getSandboxFiles(
    sandbox: Sandbox,
  ): Promise<Array<{ path: string; content: string }>> {
    try {
      return await sandbox.getFiles();
    } catch {
      return [];
    }
  }
}

async function sha256(content: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
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

function splitFileBatches(
  files: Array<{ path: string; content: string }>,
  maxFiles = 20,
  maxBytes = 2 * 1024 * 1024,
): Array<Array<{ path: string; content: string }>> {
  const batches: Array<Array<{ path: string; content: string }>> = [];
  let batch: Array<{ path: string; content: string }> = [];
  let batchBytes = 0;
  for (const file of files) {
    const fileBytes = new TextEncoder().encode(file.content).byteLength;
    if (
      batch.length &&
      (batch.length >= maxFiles || batchBytes + fileBytes > maxBytes)
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(file);
    batchBytes += fileBytes;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
