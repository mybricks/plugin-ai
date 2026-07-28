import {
  AgentEvents,
  HistoryManager,
  AgentModeEnum,
  type AgentMode,
  type AgentEventMap,
  type BoundHistory,
  type CompactRecord,
  type History,
  type Tool,
  type TurnRecord,
  type VersionFile,
  type VersionRecord,
} from "../../../../../agent/src";
import type { Sandbox } from "../../../../../agent/src/code-agent";
import type { AgentRuntimeState } from "../../../context/agent-runtime";
import type {
  BrowserToolHandler as WorkspaceBrowserToolHandler,
} from "./workspace-bridge";
import { WorkspaceBridge } from "./workspace-bridge";

export type {
  BrowserToolRequest,
  BrowserToolResult,
} from "./workspace-bridge";

type ApiResponse<T> = T | { code: number; message?: string; data: T };

export interface RemoteAgentEvent {
  event: keyof AgentEventMap | "session:snapshot" | "session:error";
  data: any;
  createdAt: number;
  turnId?: string;
}

export interface TurnsPage {
  turns?: TurnRecord[];
  hasMore?: boolean;
  oldestTurnId?: string | null;
}

export interface HttpAgentOptions {
  /** 方舟测试环境默认值：http://localhost:3001/api */
  baseUrl?: string;
  /** 服务端 workspaceId；当前对应平台 conversation id。 */
  workspaceId: string;
  /** 显式 Session。未传时使用 workspace 的 default session。 */
  sessionId?: string;
  /** @deprecated 服务端已改为 workspace default session，保留仅用于旧调用方迁移。 */
  agentId?: string;
  /** 传给服务端平台接口的用户身份。requestAI 参数中的 userId 优先。 */
  userId?: string;
  key?: string;
  headers?: Record<string, string>;
  /** 执行服务端 scene 下发的浏览器端工具请求。 */
  browserToolHandler?: BrowserToolHandler;
  /** 注册到浏览器端执行的工具。服务端可通过 browser-tool:request 按 name 调用。 */
  browserTools?: Tool[];
}

export interface HttpAgentRequestAIParams {
  message: string;
  attachments?: any[];
  mode?: AgentMode;
  userId?: string;
  meta?: Record<string, any>;
  extra?: Record<string, any>;
  aiRole?: string;
  providerId?: string;
  modelId?: string;
  signal?: AbortSignal;
  onError?: (error: Event | Error) => void;
  onClose?: () => void;
  [key: string]: any;
}

export type BrowserToolHandler = WorkspaceBrowserToolHandler<HttpAgent>;

const DEFAULT_BASE_URL = "http://localhost:3001/api";
const DEFAULT_AGENT_ID = "default";

export class HttpAgent {
  readonly kind = "http";
  readonly protocol = "agent-events";
  readonly events = new AgentEvents();
  readonly baseUrl: string;
  readonly workspaceId: string;
  readonly sessionId?: string;
  /** @deprecated 服务端已改为 workspace default session，保留仅用于旧调用方迁移。 */
  readonly agentId: string;
  readonly userId?: string;
  readonly key: string;
  readonly headers?: Record<string, string>;
  readonly historyManager: HistoryManager;
  private readonly workspaceBridge: WorkspaceBridge<HttpAgent>;
  private mode: AgentMode = AgentModeEnum.Build;
  private turns: TurnRecord[] = [];
  private compactRecord: CompactRecord | null = null;
  private sessionState: AgentRuntimeState = { running: false };
  private sessionStateListeners = new Set<
    (state: AgentRuntimeState) => void
  >();
  private readonly historyInitialization: Promise<void>;

  constructor(options: HttpAgentOptions) {
    this.baseUrl = trimRight(options.baseUrl ?? DEFAULT_BASE_URL, "/");
    this.workspaceId = options.workspaceId;
    this.sessionId = options.sessionId;
    this.agentId = options.agentId ?? DEFAULT_AGENT_ID;
    this.userId = options.userId;
    this.key =
      options.key ??
      `http:${this.baseUrl}:${this.workspaceId}:${this.sessionId ?? "default"}`;
    this.headers = options.headers;
    this.workspaceBridge = new WorkspaceBridge<HttpAgent>({
      origin: getSocketOrigin(this.baseUrl),
      workspaceId: this.workspaceId,
      requestJson: <T>(path: string, init?: RequestInit) =>
        this.requestJson<T>(path, init),
      agent: this,
      tools: options.browserTools,
      handler: options.browserToolHandler,
      getMode: () => this.getMode(),
      setMode: (mode, reason) => this.setMode(mode, reason),
    });
    this.historyManager = new HistoryManager({
      history: this.remoteHistoryStore,
      key: this.key,
    });
    this.historyInitialization = this.initializeHistory();
    void this.historyInitialization
      .then(() => this.connectEventReplay())
      .catch((error) => {
        console.error("[plugin-ai] remote history initialization failed", error);
      });
  }

  getMode(): AgentMode {
    return this.mode;
  }

  setMode(mode: AgentMode, reason?: string): void {
    const previousMode = this.mode;
    this.mode = mode;
    if (previousMode !== mode) {
      this.events.emit("mode:change", { mode, previousMode, reason });
    }
  }

  getAvailableModes(): AgentMode[] {
    return [AgentModeEnum.Build];
  }

  getLLMProviders(): undefined {
    return undefined;
  }

  getTools(): Tool[] {
    return this.workspaceBridge.getTools();
  }

  getTurns(): TurnRecord[] {
    return this.turns;
  }

  getCompactRecord(): CompactRecord | null {
    return this.compactRecord;
  }

  getHistory(): BoundHistory | null {
    return this.historyManager.getBoundHistory();
  }

  getSessionState(): AgentRuntimeState {
    return this.sessionState;
  }

  subscribeSessionState(
    listener: (state: AgentRuntimeState) => void,
  ): () => void {
    this.sessionStateListeners.add(listener);
    listener(this.sessionState);
    return () => this.sessionStateListeners.delete(listener);
  }

  setBrowserToolHandler(handler?: BrowserToolHandler): void {
    this.workspaceBridge.setToolHandler(handler);
  }

  setBrowserTools(tools: Tool[]): void {
    this.workspaceBridge.setTools(tools);
  }

  setBrowserConnectionEnabled(enabled: boolean): void {
    this.workspaceBridge.setEnabled(enabled);
  }

  async requestAI(params: HttpAgentRequestAIParams): Promise<void> {
    // 与本地 Agent.requestAI 保持一致：历史 ready 后才能开始新 turn，
    // 避免迟到的 ready snapshot 覆盖正在流式更新的消息。
    await this.historyInitialization;
    await this.requestEventStream(
      this.sessionPath("run"),
      {
        method: "POST",
        body: JSON.stringify({
          message: params.message,
          attachments: params.attachments,
          ...(params.userId ?? this.userId
            ? { userId: params.userId ?? this.userId }
            : {}),
          ...(params.mode ? { mode: params.mode } : {}),
          ...(params.meta ? { meta: params.meta } : {}),
          ...(params.extra ? { extra: params.extra } : {}),
          ...(params.aiRole ? { aiRole: params.aiRole } : {}),
          ...(params.providerId ? { providerId: params.providerId } : {}),
          ...(params.modelId ? { modelId: params.modelId } : {}),
        }),
      },
      {
        signal: params.signal,
        onEvent: (event) => this.handleRemoteEvent(event),
        onError: params.onError,
        onClose: params.onClose,
      },
    );
    await this.reloadHistory();
  }

  async abort(): Promise<void> {
    await this.requestJson(
      this.sessionPath("abort"),
      {
        method: "POST",
      },
    );
  }

  async clearHistory(): Promise<void> {
    this.turns = [];
    this.compactRecord = null;
    await this.historyManager.clear();
  }

  readonly session = {
    getTurns: async (params?: {
      limit?: number;
      before?: string;
    }): Promise<TurnsPage> => {
      const query = new URLSearchParams();
      query.set("limit", String(params?.limit ?? 20));
      if (params?.before) query.set("before", params.before);
      return this.requestJson<TurnsPage>(
        `${this.sessionPath("turns")}?${query.toString()}`,
      );
    },
    subscribe: (params: {
      limit?: number;
      onEvent: (event: RemoteAgentEvent) => void;
      onError?: (error: Event | Error) => void;
      onClose?: () => void;
    }): (() => void) => {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set("limit", String(params.limit));
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const controller = new AbortController();
      void this.requestEventStream(
        `${this.sessionPath("connect")}${suffix}`,
        { method: "GET" },
        {
          signal: controller.signal,
          onEvent: params.onEvent,
          onError: params.onError,
          onClose: params.onClose,
        },
      ).catch(() => {
        // requestEventStream 已通过 onError 报告连接错误。
      });
      return () => controller.abort();
    },
  };

  private readonly remoteHistoryStore: History = {
    load: async (): Promise<TurnRecord[]> => this.loadAllTurns(),
    append: async (_key, record): Promise<void> => {
      await this.requestJson(this.sessionPath("turns"), {
        method: "POST",
        body: JSON.stringify({ record }),
      });
    },
    update: async (_key, turnId, patch): Promise<void> => {
      await this.requestJson(
        `${this.sessionPath("turns")}/${encodeURIComponent(turnId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );
    },
    clear: async (): Promise<void> => {
      await this.requestJson(this.sessionPath("turns/clear"), {
        method: "POST",
      });
    },
    import: async (_key, turns): Promise<void> => {
      await this.requestJson(this.sessionPath("turns/import"), {
        method: "POST",
        body: JSON.stringify({ turns }),
      });
    },
    loadCompact: async (): Promise<CompactRecord | null> => {
      return this.requestJson<CompactRecord | null>(
        this.sessionPath("compact"),
      );
    },
    saveCompact: async (_key, record): Promise<void> => {
      await this.requestJson(this.sessionPath("compact"), {
        method: "POST",
        body: JSON.stringify({ record }),
      });
    },
    listVersions: async (
      _key: string,
      params?: {
        pageSize?: number;
        pageNum?: number;
      },
    ): Promise<{ total: number; list: VersionRecord[] }> => {
      const query = new URLSearchParams();
      if (params?.pageSize !== undefined) {
        query.set("pageSize", String(params.pageSize));
      }
      if (params?.pageNum !== undefined) {
        query.set("pageNum", String(params.pageNum));
      }
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return normalizeVersionsPage(
        await this.requestJson<any>(`${this.sessionPath("versions")}${suffix}`),
      );
    },
    addVersion: async (
      _key: string,
      record: VersionRecord,
      files: VersionFile[],
    ): Promise<void> => {
      await this.requestJson(this.sessionPath("versions"), {
        method: "POST",
        body: JSON.stringify({ record, files }),
      });
    },
    getVersionFiles: async (versionId: string): Promise<VersionFile[]> => {
      const response = await this.requestJson<any>(
        `${this.sessionPath("versions")}/${encodeURIComponent(versionId)}/files`,
      );
      return Array.isArray(response)
        ? response
        : Array.isArray(response?.files)
          ? response.files
          : [];
    },
    getVersion: async (versionId: string): Promise<VersionRecord | null> => {
      const response = await this.requestJson<any>(
        `${this.sessionPath("versions")}/${encodeURIComponent(versionId)}`,
      );
      const record = response?.record ?? response?.version ?? response;
      return record && Object.keys(record).length ? record : null;
    },
    updateVersion: async (
      versionId: string,
      patch: Partial<Pick<VersionRecord, "summary">> & {
        files?: VersionFile[];
      },
    ): Promise<void> => {
      await this.requestJson(
        `${this.sessionPath("versions")}/${encodeURIComponent(versionId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(patch),
        },
      );
    },
  };

  readonly files = {
    syncSnapshot: async (sandbox: Sandbox): Promise<void> => {
      await this.workspaceBridge.syncSnapshot(sandbox);
    },
    bindSandbox: (sandbox: Sandbox): void => {
      this.workspaceBridge.bindSandbox(sandbox);
    },
    ensureBrowserConnected: async (): Promise<void> => {
      await this.workspaceBridge.ensureConnected();
    },
    disconnect: (): void => {
      this.workspaceBridge.disconnect();
    },
  };

  private async initializeHistory(): Promise<void> {
    const loaded = await this.historyManager.ensureLoaded();
    if (!loaded) return;
    this.turns = loaded.turns;
    this.compactRecord = loaded.compactRecord;
    this.historyManager.markReady();
  }

  private async reloadHistory(): Promise<void> {
    const [turns, compactRecord] = await Promise.all([
      this.loadAllTurns(),
      this.remoteHistoryStore.loadCompact?.(this.key) ?? null,
    ]);
    this.turns = turns;
    this.compactRecord = compactRecord;
  }

  private async loadAllTurns(): Promise<TurnRecord[]> {
    const pageSize = 100;
    let before: string | undefined;
    const pages: TurnRecord[][] = [];
    for (let index = 0; index < 100; index += 1) {
      const page = await this.session.getTurns({ limit: pageSize, before });
      const turns = page.turns ?? [];
      pages.unshift(turns);
      if (!page.hasMore || !page.oldestTurnId || !turns.length) break;
      before = page.oldestTurnId;
    }
    return pages.flat();
  }

  private connectEventReplay(): void {
    this.session.subscribe({
      limit: 1,
      onEvent: (event) => {
        if (event.event === "session:error") {
          this.setSessionState({
            running: false,
            error: event.data?.message ?? event.data,
          });
          console.error(
            "[plugin-ai] remote agent replay failed",
            event.data?.message ?? event.data,
          );
          return;
        }
        this.handleRemoteEvent(event);
      },
      onError: (error) => {
        this.setSessionState({ running: false, error });
        console.error("[plugin-ai] remote agent replay failed", error);
      },
    });
  }

  private handleRemoteEvent(event: RemoteAgentEvent): void {
    if (event.event === "session:snapshot") {
      const mode = event.data?.agent?.mode;
      if (mode) this.mode = mode;
      this.setSessionState({
        running: event.data?.agent?.status === "running",
        ...(event.data?.agent?.activeTurnId
          ? { turnId: event.data.agent.activeTurnId }
          : {}),
      });
      return;
    }
    if (event.event === "session:error") {
      this.setSessionState({
        running: false,
        error: event.data?.message ?? event.data,
      });
      throw new Error(
        String(event.data?.message ?? "Remote agent session failed"),
      );
    }
    if (event.event === "turn:start" || event.event === "turn:resume") {
      this.setSessionState({
        running: true,
        turnId: event.data?.turnId ?? event.turnId,
      });
    } else if (
      event.event === "turn:complete" ||
      event.event === "turn:abort"
    ) {
      this.setSessionState({ running: false });
    } else if (event.event === "turn:error") {
      this.setSessionState({
        running: false,
        error: event.data?.error,
      });
    }
    if (event.event === "mode:change" && event.data?.mode) {
      this.mode = event.data.mode;
    }
    this.events.emit(event.event, event.data as never);
  }

  private setSessionState(state: AgentRuntimeState): void {
    if (
      this.sessionState.running === state.running &&
      this.sessionState.turnId === state.turnId &&
      this.sessionState.error === state.error
    ) {
      return;
    }
    this.sessionState = state;
    for (const listener of this.sessionStateListeners) listener(state);
  }

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
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    if (!text.trim()) return undefined as T;
    return unwrapApiResponse<T>(JSON.parse(text));
  }

  private sessionPath(action: string): string {
    const workspace = encodeURIComponent(this.workspaceId);
    if (this.sessionId) {
      return `/workspaces/${workspace}/sessions/${encodeURIComponent(this.sessionId)}/${action}`;
    }
    return `/workspaces/${workspace}/${action}`;
  }

  private async requestEventStream(
    path: string,
    init: RequestInit,
    params: {
      signal?: AbortSignal;
      onEvent?: (event: RemoteAgentEvent) => void;
      onError?: (error: Event | Error) => void;
      onOpen?: () => void;
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
      params.onOpen?.();

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
}

export function isHttpAgent(agent: unknown): agent is HttpAgent {
  return (
    !!agent &&
    typeof agent === "object" &&
    (agent as any).kind === "http" &&
    (agent as any).protocol === "agent-events"
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

function normalizeVersionsPage(
  response: any,
): { total: number; list: VersionRecord[] } {
  const list = Array.isArray(response?.list)
    ? response.list
    : Array.isArray(response?.versions)
      ? response.versions
      : Array.isArray(response)
        ? response
        : [];
  return {
    list,
    total:
      typeof response?.total === "number" ? response.total : list.length,
  };
}

function dispatchSseChunk(
  chunk: string,
  onEvent?: (event: RemoteAgentEvent) => void,
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
  const event = JSON.parse(data.join("\n")) as RemoteAgentEvent;
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
