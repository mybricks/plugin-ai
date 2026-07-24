import { io, type Socket } from "socket.io-client";
import {
  AgentModeEnum,
  type AgentMode,
  type BoundHistory,
  type Tool,
  type TurnRecord,
} from "../../../../../agent/src";
import type { Sandbox } from "../../../../../agent/src/code-agent";

type ApiResponse<T> = T | { code: number; message?: string; data: T };

export type AguiEventType =
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "RUN_ERROR"
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "STATE_SNAPSHOT"
  | "STATE_DELTA"
  | "CUSTOM";

export interface AguiEvent {
  type: AguiEventType;
  timestamp?: number;
  [key: string]: any;
}

export interface TurnsPage {
  turns?: TurnRecord[];
  hasMore?: boolean;
  oldestTurnId?: string | null;
}

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

export interface HttpAgentOptions {
  /** 方舟测试环境默认值：http://localhost:3001/api */
  baseUrl?: string;
  workspaceId: string;
  /** 方舟测试环境默认 agentId：default */
  agentId?: string;
  key?: string;
  headers?: Record<string, string>;
  /** 默认 delta：AG-UI stream 推送增量内容。 */
  streamContentMode?: "snapshot" | "delta";
}

export interface HttpAgentRequestAIParams {
  message: string;
  attachments?: any[];
  mode?: AgentMode;
  meta?: Record<string, any>;
  signal?: AbortSignal;
  onEvent?: (event: AguiEvent) => void;
  onError?: (error: Event | Error) => void;
  onClose?: () => void;
  [key: string]: any;
}

const DEFAULT_BASE_URL = "http://localhost:3001/api";
const DEFAULT_AGENT_ID = "default";

export class HttpAgent {
  readonly kind = "http";
  readonly protocol = "agui";
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly key: string;
  readonly headers?: Record<string, string>;
  readonly streamContentMode: "snapshot" | "delta";
  private mode: AgentMode = AgentModeEnum.Build;
  private fileSyncSandbox?: Sandbox;
  private fileSyncDisconnect?: () => void;
  private fileSocket?: Socket;

  constructor(options: HttpAgentOptions) {
    this.baseUrl = trimRight(options.baseUrl ?? DEFAULT_BASE_URL, "/");
    this.workspaceId = options.workspaceId;
    this.agentId = options.agentId ?? DEFAULT_AGENT_ID;
    this.key =
      options.key ?? `http:${this.baseUrl}:${this.workspaceId}:${this.agentId}`;
    this.headers = options.headers;
    this.streamContentMode = options.streamContentMode ?? "delta";
  }

  getMode(): AgentMode {
    return this.mode;
  }

  setMode(mode: AgentMode): void {
    this.mode = mode;
  }

  getAvailableModes(): AgentMode[] {
    return [AgentModeEnum.Build];
  }

  getLLMProviders(): undefined {
    return undefined;
  }

  getTools(): Tool[] {
    return [];
  }

  getTurns(): TurnRecord[] {
    return [];
  }

  getCompactRecord(): null {
    return null;
  }

  getHistory(): BoundHistory | null {
    // HTTP agent 的历史由 AG-UI 接口托管：面板启动时走
    // /connect?limit=1 获取当前快照，缺失/更早的 turns 再走 /turns。
    // 这里不返回本地 BoundHistory，避免 sandbox 侧把远端历史当成本地持久化来写。
    return null;
  }

  async requestAI(params: HttpAgentRequestAIParams): Promise<void> {
    await this.requestEventStream(
      `/workspaces/${encodeURIComponent(this.workspaceId)}/agents/${encodeURIComponent(this.agentId)}/run`,
      {
        method: "POST",
        body: JSON.stringify({
          message: params.message,
          attachments: params.attachments,
          ...(params.mode ? { mode: params.mode } : {}),
          ...(params.meta ? { meta: params.meta } : {}),
        }),
      },
      {
        signal: params.signal,
        onEvent: params.onEvent,
        onError: params.onError,
        onClose: params.onClose,
      },
    );
    if (this.fileSyncSandbox) {
      this.files.connectAndSync(this.fileSyncSandbox);
    }
  }

  async abort(): Promise<void> {
    await this.requestJson(
      `/workspaces/${encodeURIComponent(this.workspaceId)}/agents/${encodeURIComponent(this.agentId)}/abort`,
      {
        method: "POST",
      },
    );
  }

  async clearHistory(): Promise<void> {
    await this.requestJson(
      `/workspaces/${encodeURIComponent(this.workspaceId)}/agents/${encodeURIComponent(this.agentId)}/turns/clear`,
      {
        method: "POST",
      },
    );
  }

  readonly agui = {
    getTurns: async (params?: {
      limit?: number;
      before?: string;
    }): Promise<TurnsPage> => {
      const query = new URLSearchParams();
      query.set("limit", String(params?.limit ?? 20));
      if (params?.before) query.set("before", params.before);
      return this.requestJson<TurnsPage>(
        `/workspaces/${encodeURIComponent(this.workspaceId)}/agents/${encodeURIComponent(this.agentId)}/turns?${query.toString()}`,
      );
    },
    subscribe: (params: {
      limit?: number;
      onEvent: (event: AguiEvent) => void;
      onError?: (error: Event) => void;
      onClose?: () => void;
    }): (() => void) => {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const url = `${this.baseUrl}/workspaces/${encodeURIComponent(this.workspaceId)}/agents/${encodeURIComponent(this.agentId)}/connect${suffix}`;
      const eventSource = new EventSource(url);
      let closed = false;
      let sawTerminalEvent = false;
      let sawSnapshot = false;
      const close = () => {
        if (closed) return;
        closed = true;
        eventSource.close();
        params.onClose?.();
      };
      const isTerminalRunEvent = (event: AguiEvent) =>
        event.type === "RUN_FINISHED" || event.type === "RUN_ERROR";
      eventSource.onmessage = (message) => {
        const event = JSON.parse(message.data) as AguiEvent;
        if (event.type === "STATE_SNAPSHOT") sawSnapshot = true;
        params.onEvent(event);
        if (isTerminalRunEvent(event)) {
          sawTerminalEvent = true;
          close();
        }
      };
      eventSource.onerror = (error) => {
        // /connect?limit=1 是一次性初始化流。服务端发送 STATE_SNAPSHOT 后
        // 主动结束 SSE 时，浏览器会触发 EventSource.onerror；这不是历史加载失败。
        if (
          closed ||
          sawTerminalEvent ||
          (params.limit !== undefined && sawSnapshot) ||
          eventSource.readyState === EventSource.CLOSED
        ) {
          close();
          return;
        }
        params.onError?.(error);
        close();
      };
      return close;
    },
  };

  readonly files = {
    syncSnapshot: async (sandbox: Sandbox): Promise<void> => {
      const tree = await this.requestJson<FileTreeResponse>(
        `/workspaces/${encodeURIComponent(this.workspaceId)}/files`,
      );
      const files = await Promise.all(
        (tree.files ?? []).map((file) => this.resolveRemoteFile(file)),
      );
      const existing = await this.getSandboxFiles(sandbox);
      const remotePaths = new Set(
        files.filter(Boolean).map((file) => file!.path),
      );
      const deletePaths = existing
        .map((file) => file.path)
        .filter((path) => !remotePaths.has(path));
      const writableFiles = files.filter(
        (file): file is { path: string; content: string } => !!file,
      );
      if (writableFiles.length) await sandbox.updateFiles(writableFiles);
      if (deletePaths.length) await sandbox.deleteFiles(deletePaths);
    },
    connect: (sandbox: Sandbox): (() => void) => {
      this.fileSocket?.disconnect();
      const socket = io(`${getSocketOrigin(this.baseUrl)}/ws`, {
        transports: ["websocket"],
        reconnection: true,
      });
      this.fileSocket = socket;
      socket.on("connect", () => {
        socket.emit("workspace:join", { workspaceId: this.workspaceId });
      });
      socket.on(
        "file:change",
        (payload: { requestId?: string | null; changes?: any[] }) => {
          const changes = Array.isArray(payload?.changes)
            ? payload.changes
            : [];
          for (const change of changes) {
            void this.applyFileChange(change, sandbox);
          }
        },
      );
      socket.on("connect_error", (error) => {
        console.error("[plugin-ai] workspace ws connect failed", error);
      });
      return () => {
        socket.emit("workspace:leave", { workspaceId: this.workspaceId });
        socket.disconnect();
        if (this.fileSocket === socket) this.fileSocket = undefined;
      };
    },
    connectAndSync: (sandbox: Sandbox): (() => void) => {
      this.fileSyncSandbox = sandbox;
      this.fileSyncDisconnect?.();
      this.fileSyncDisconnect = undefined;
      let disposed = false;
      let disconnect: (() => void) | undefined;
      void this.files
        .syncSnapshot(sandbox)
        .then(() => {
          if (disposed) return;
          disconnect = this.files.connect(sandbox);
          this.fileSyncDisconnect = disconnect;
        })
        .catch((error) => {
          console.error("[plugin-ai] sync remote files snapshot failed", error);
        });
      return () => {
        disposed = true;
        disconnect?.();
        if (this.fileSyncDisconnect === disconnect) {
          this.fileSyncDisconnect = undefined;
        }
      };
    },
  };

  async requestJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...this.headers,
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return unwrapApiResponse<T>(await response.json());
  }

  private async requestEventStream(
    path: string,
    init: RequestInit,
    params: {
      signal?: AbortSignal;
      onEvent?: (event: AguiEvent) => void;
      onError?: (error: Event | Error) => void;
      onClose?: () => void;
    } = {},
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: params.signal,
        headers: {
          accept: "text/event-stream",
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...this.headers,
          ...init.headers,
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error("SSE response body is not available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const chunk = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          dispatchSseChunk(chunk, params.onEvent);
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (buffer.trim()) dispatchSseChunk(buffer, params.onEvent);
      params.onClose?.();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        params.onClose?.();
        return;
      }
      params.onError?.(error as Error);
      throw error;
    }
  }

  private async applyFileChange(change: any, sandbox: Sandbox) {
    if (Array.isArray(change?.ops)) {
      for (const op of change.ops) {
        await this.applyFileChange(op, sandbox);
      }
      return;
    }
    const path = String(change?.path ?? "");
    if (!path) return;
    if (change.hash === null || change.type === "delete") {
      await sandbox.deleteFiles([path]);
      return;
    }
    const file = await this.readRemoteFile(path);
    if (!file) return;
    await sandbox.updateFiles([{ path, content: String(file.content ?? "") }]);
  }

  private async readRemoteFile(
    path: string,
  ): Promise<{ path: string; content: string } | null> {
    const query = new URLSearchParams({ path });
    const file = await this.requestJson<{
      path?: string;
      content?: string;
    } | null>(
      `/workspaces/${encodeURIComponent(this.workspaceId)}/files/content?${query.toString()}`,
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
  ): Promise<Array<{ path: string }>> {
    try {
      return await sandbox.getFiles();
    } catch {
      return [];
    }
  }
}

export function isHttpAgent(agent: unknown): agent is HttpAgent {
  return (
    !!agent &&
    typeof agent === "object" &&
    (agent as any).kind === "http" &&
    (agent as any).protocol === "agui"
  );
}

function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (
    response &&
    typeof response === "object" &&
    "code" in response &&
    "data" in response
  ) {
    const wrapped = response as { code: number; message?: string; data: T };
    if (wrapped.code !== 0) {
      throw new Error(wrapped.message ?? `API error ${wrapped.code}`);
    }
    return wrapped.data;
  }
  return response as T;
}

function dispatchSseChunk(
  chunk: string,
  onEvent?: (event: AguiEvent) => void,
) {
  if (!onEvent) return;
  const data: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }
  if (!data.length) return;
  const event = JSON.parse(data.join("\n")) as AguiEvent;
  onEvent(event);
}

function trimRight(value: string, char: string): string {
  let next = value;
  while (next.endsWith(char)) next = next.slice(0, -char.length);
  return next;
}

function getSocketOrigin(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = url.pathname.replace(/\/api\/?$/, "");
    url.search = "";
    url.hash = "";
    return trimRight(url.toString(), "/");
  } catch {
    return trimRight(baseUrl.replace(/\/api\/?$/, ""), "/");
  }
}
