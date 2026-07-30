import {
  AgentEvents,
  HistoryManager,
  AgentModeEnum,
  type AgentMode,
  type AgentEventMap,
  type CompactRecord,
  type Tool,
  type TurnRecord,
} from "../../../../../agent/src";
import type { Sandbox } from "../../../../../agent/src/code-agent";
import type { AgentRuntimeState } from "../../../context/agent-runtime";
import type {
  BrowserToolRequest,
  BrowserToolHandler as WorkspaceBrowserToolHandler,
} from "./workspace-bridge";
import { WorkspaceBridge } from "./workspace-bridge";

export type {
  BrowserToolRequest,
  BrowserToolResult,
} from "./workspace-bridge";

type ApiResponse<T> = T | { code: number; message?: string; data: T };

export interface RemoteAgentEvent {
  event:
    | keyof AgentEventMap
    | "session:error"
    | "session:preparing"
    | "session:start"
    | "workspace:file-change"
    | "browser:task";
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
  /** @deprecated 服务端路由不接受 sessionId；请使用 agentId。 */
  sessionId?: string;
  /** 服务端 agentId。未传时使用 workspace 的 default agent。 */
  agentId?: string;
  /** 传给服务端平台接口的用户身份。requestAI 参数中的 userId 优先。 */
  userId?: string;
  key?: string;
  headers?: Record<string, string>;
  /** 执行服务端 scene 下发的浏览器端工具请求。 */
  browserToolHandler?: BrowserToolHandler;
  /** 注册到浏览器端执行的工具。服务端可通过 SSE browser:task 按 name 调用。 */
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
const DEFAULT_TURNS_PAGE_SIZE = 20;

export class HttpAgent {
  readonly kind = "http";
  readonly protocol = "agent-events";
  readonly events = new AgentEvents();
  readonly baseUrl: string;
  readonly workspaceId: string;
  /** @deprecated 服务端路由不接受 sessionId；保留仅用于旧调用方迁移。 */
  readonly sessionId?: string;
  /** 服务端 agentId；default 使用 workspace 直连路由。 */
  readonly agentId: string;
  readonly userId?: string;
  readonly key: string;
  readonly headers?: Record<string, string>;
  readonly historyManager: HistoryManager;
  private readonly workspaceBridge: WorkspaceBridge<HttpAgent>;
  private mode: AgentMode = AgentModeEnum.Build;
  private turns: TurnRecord[] = [];
  private turnsPage: Required<Pick<TurnsPage, "hasMore">> &
    Pick<TurnsPage, "oldestTurnId"> = {
    hasMore: false,
    oldestTurnId: null,
  };
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
    this.agentId = options.agentId ?? options.sessionId ?? DEFAULT_AGENT_ID;
    this.userId = options.userId;
    this.key =
      options.key ??
      `http:${this.baseUrl}:${this.workspaceId}:${this.agentId}`;
    this.headers = options.headers;
    this.workspaceBridge = new WorkspaceBridge<HttpAgent>({
      workspaceId: this.workspaceId,
      userId: this.userId,
      requestJson: <T>(path: string, init?: RequestInit) =>
        this.requestJson<T>(path, init),
      agent: this,
      tools: options.browserTools,
      handler: options.browserToolHandler,
      getMode: () => this.getMode(),
      setMode: (mode, reason) => this.setMode(mode, reason),
    });
    this.historyManager = new HistoryManager({});
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

  getTurnsPage(): Required<Pick<TurnsPage, "hasMore">> &
    Pick<TurnsPage, "oldestTurnId"> {
    return { ...this.turnsPage };
  }

  async loadOlderTurns(limit = DEFAULT_TURNS_PAGE_SIZE): Promise<TurnsPage> {
    await this.historyInitialization;
    if (!this.turnsPage.hasMore || !this.turnsPage.oldestTurnId) {
      return { turns: [], hasMore: false, oldestTurnId: null };
    }
    const page = await this.session.getTurns({
      limit,
      before: this.turnsPage.oldestTurnId,
    });
    this.turns = mergeTurnRecords(page.turns ?? [], this.turns);
    this.turnsPage = {
      hasMore: Boolean(page.hasMore),
      oldestTurnId: page.oldestTurnId ?? null,
    };
    this.historyManager.markReady();
    return page;
  }

  getCompactRecord(): CompactRecord | null {
    return this.compactRecord;
  }

  getHistory(): null {
    return null;
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
    await this.workspaceBridge.prepareRun();
    let terminalSeen = false;
    let prepareTurnStarted = false;
    try {
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
          onEvent: (event) => {
            terminalSeen ||= isTerminalRemoteEvent(event);
            if (
              event.event === "session:preparing" &&
              event.turnId &&
              !prepareTurnStarted
            ) {
              prepareTurnStarted = true;
              this.handleRemoteEvent({
                event: "turn:start",
                turnId: event.turnId,
                createdAt: event.createdAt,
                data: {
                  turnId: event.turnId,
                  message: params.message,
                  attachments: params.attachments ?? [],
                  ...(params.meta ? { meta: params.meta } : {}),
                },
              });
            }
            this.handleRemoteEvent(event);
          },
        },
      );
      if (!terminalSeen && !params.signal?.aborted) {
        throw new SseDisconnectedError(
          "Run SSE closed before a terminal event",
        );
      }
    } catch (error) {
      if (
        (error as Error)?.name === "AbortError" ||
        error instanceof RemoteSessionError ||
        error instanceof HttpResponseError
      ) {
        params.onError?.(error as Error);
        throw error;
      }
      // /run 连接断开不会取消服务端 Agent，改用 /connect 跨实例重放并续接。
      try {
        await this.requestEventStream(
          this.sessionPath("connect"),
          { method: "GET" },
          {
            signal: params.signal,
            onEvent: (event) => this.handleRemoteEvent(event),
          },
        );
      } catch (reconnectError) {
        params.onError?.(reconnectError as Error);
        throw reconnectError;
      }
    }
    await this.reloadHistory();
    params.onClose?.();
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
    await this.requestJson(this.sessionPath("turns/clear"), {
      method: "POST",
    });
    this.turns = [];
    this.compactRecord = null;
    this.turnsPage = {
      hasMore: false,
      oldestTurnId: null,
    };
    this.historyManager.markReady();
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
      onEvent: (event: RemoteAgentEvent) => void;
      onError?: (error: Event | Error) => void;
      onClose?: () => void;
    }): (() => void) => {
      const controller = new AbortController();
      void this.requestEventStream(
        this.sessionPath("connect"),
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
    const [page, compactRecord] = await Promise.all([
      this.loadLatestTurns(),
      this.loadCompactRecord(),
    ]);
    this.turns = page.turns ?? [];
    this.turnsPage = {
      hasMore: Boolean(page.hasMore),
      oldestTurnId: page.oldestTurnId ?? null,
    };
    this.compactRecord = compactRecord;
    this.historyManager.markReady();
  }

  private async reloadHistory(): Promise<void> {
    const [page, compactRecord] = await Promise.all([
      this.loadLatestTurns(),
      this.loadCompactRecord(),
    ]);
    this.turns = mergeTurnRecords(this.turns, page.turns ?? []);
    if (!this.turnsPage.oldestTurnId) {
      this.turnsPage = {
        hasMore: Boolean(page.hasMore),
        oldestTurnId: page.oldestTurnId ?? null,
      };
    }
    this.compactRecord = compactRecord;
  }

  private async loadLatestTurns(
    limit = DEFAULT_TURNS_PAGE_SIZE,
  ): Promise<TurnsPage> {
    return this.session.getTurns({ limit });
  }

  private async loadCompactRecord(): Promise<CompactRecord | null> {
    try {
      return await this.requestJson<CompactRecord | null>(
        this.sessionPath("compact"),
      );
    } catch (error) {
      console.warn("[plugin-ai] load compact failed, ignored", error);
      return null;
    }
  }

  private connectEventReplay(): void {
    this.session.subscribe({
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
    if (event.event === "workspace:file-change") {
      void this.workspaceBridge
        .syncFileChanges(Number(event.data?.version) || undefined)
        .catch((error) => {
          console.error("[plugin-ai] sync workspace file changes failed", error);
        });
      return;
    }
    if (event.event === "browser:task") {
      const request = event.data as Omit<
        BrowserToolRequest,
        "workspaceId" | "browserId"
      > &
        Partial<Pick<BrowserToolRequest, "workspaceId" | "browserId">>;
      void this.workspaceBridge
        .handleBrowserTask({
          ...request,
          workspaceId: request.workspaceId ?? this.workspaceId,
          browserId: request.browserId ?? "",
        })
        .catch((error) => {
          console.error("[plugin-ai] browser task response failed", error);
        });
      return;
    }
    if (event.event === "session:error") {
      this.setSessionState({
        running: false,
        error: event.data?.message ?? event.data,
      });
      throw new RemoteSessionError(
        String(event.data?.message ?? "Remote agent session failed"),
      );
    }
    if (event.event === "session:preparing" || event.event === "session:start") {
      this.setSessionState({
        running: true,
        turnId: event.turnId ?? this.sessionState.turnId,
      });
      return;
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
    if (this.agentId !== DEFAULT_AGENT_ID) {
      return `/workspaces/${workspace}/agents/${encodeURIComponent(this.agentId)}/${action}`;
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
        throw new HttpResponseError(
          response.status,
          await readHttpErrorMessage(response),
        );
      }
      if (response.status === 204) {
        params.onOpen?.();
        params.onClose?.();
        return;
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

function mergeTurnRecords(
  olderTurns: TurnRecord[],
  newerTurns: TurnRecord[],
): TurnRecord[] {
  const merged: TurnRecord[] = [];
  const seen = new Set<string>();
  for (const turn of [...olderTurns, ...newerTurns]) {
    if (!turn?.id) {
      merged.push(turn);
      continue;
    }
    const index = merged.findIndex((item) => item.id === turn.id);
    if (index >= 0) {
      merged[index] = turn;
      continue;
    }
    if (!seen.has(turn.id)) {
      seen.add(turn.id);
      merged.push(turn);
    }
  }
  return merged;
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

class RemoteSessionError extends Error {}

class SseDisconnectedError extends Error {}

class HttpResponseError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`${status} ${message}`);
  }
}

function isTerminalRemoteEvent(event: RemoteAgentEvent): boolean {
  return (
    event.event === "turn:complete" ||
    event.event === "turn:abort" ||
    event.event === "turn:error" ||
    event.event === "session:error"
  );
}

async function readHttpErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || "Request failed";
  try {
    const text = await response.text();
    if (!text.trim()) return fallback;
    const body = JSON.parse(text);
    const message = body?.message ?? body?.error;
    if (Array.isArray(message)) return message.join("; ");
    return typeof message === "string" && message ? message : fallback;
  } catch {
    return fallback;
  }
}
