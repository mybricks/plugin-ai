import {
  AgentEvents,
  HistoryManager,
  AgentModeEnum,
  type AgentMode,
  type AgentEventMap,
  type AgentHooks,
  type CompactRecord,
  type BoundHistory,
  type Tool,
  type TurnRecord,
  type VersionFile,
  type VersionRecord,
} from "../../../../../agent/src";
import type { Sandbox } from "../../../../../agent/src/code-agent";
import type { AgentRuntimeState } from "../../../context/agent-runtime";
import type { BrowserToolRequest } from "./workspace-bridge";
import { WorkspaceBridge } from "./workspace-bridge";

export type {
  BrowserToolRequest,
  BrowserToolResult,
} from "./workspace-bridge";

type ApiResponse<T> = T | { code: number; message?: string; data: T };
type VersionsPageResponse =
  | { total?: number; list?: VersionRecord[]; versions?: VersionRecord[] }
  | VersionRecord[];
type VersionRecordResponse = { record?: VersionRecord } | VersionRecord | null;
type VersionFilesResponse = { files?: VersionFile[] } | VersionFile[];

export interface RemoteAgentEvent {
  event:
    | keyof AgentEventMap
    | "session:error"
    | "session:preparing"
    | "session:locked"
    | "session:files-synced"
    | "session:agent-configured"
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
  /** 方舟测试环境默认值：http://localhost:3001/agents/api */
  baseUrl?: string;
  /** 服务端 workspaceId；当前对应平台 conversation id。 */
  workspaceId: string;
  /** 服务端 agentId。未传时使用 workspace 的 default agent。 */
  agentId?: string;
}

interface HttpAgentRuntimeOptions {
  /** 返回当前 Agent 是否禁用；未提供时默认启用。 */
  disabled?: () => boolean;
  /** 注册到浏览器端执行的工具。服务端可通过 SSE browser:task 按 name 调用。 */
  browserTools?: Tool[];
  /**
   * 浏览器侧生命周期 hooks。远程 Agent 的实际推理在服务端执行，但 sandbox
   * 仍需要这些 hooks 来维护 loading、锁和 undo/redo 等本地 UI 状态。
   */
  hooks?: AgentHooks;
}

export interface HttpAgentRequestAIParams {
  turnId?: string;
  message: string;
  attachments?: any[];
  mode?: AgentMode;
  meta?: Record<string, any>;
  extra?: Record<string, any>;
  aiRole?: string;
  providerId?: string;
  modelId?: string;
  signal?: AbortSignal;
  onError?: (error: Event | Error) => void;
  onClose?: () => void;
}

// aicode-agents 通过 Nest 的全局路由前缀暴露 API。
const DEFAULT_BASE_URL = "http://localhost:3001/agents/api";
const DEFAULT_AGENT_ID = "default";
const DEFAULT_TURNS_PAGE_SIZE = 20;

export class HttpAgent {
  readonly kind = "http";
  readonly protocol = "agent-events";
  readonly events = new AgentEvents();
  readonly baseUrl: string;
  readonly workspaceId: string;
  /** 服务端 agentId；default 使用 workspace 直连路由。 */
  readonly agentId: string;
  readonly key: string;
  readonly historyManager: HistoryManager;
  private readonly disabled: () => boolean;
  private readonly hooks?: AgentHooks;
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
  private readonly remoteHistory: BoundHistory;
  private readonly historyInitialization: Promise<void>;
  private readonly completedHookTurns = new Set<string>();

  constructor(options: HttpAgentOptions, runtime: HttpAgentRuntimeOptions = {}) {
    this.baseUrl = trimRight(options.baseUrl ?? DEFAULT_BASE_URL, "/");
    this.workspaceId = options.workspaceId;
    this.agentId = options.agentId ?? DEFAULT_AGENT_ID;
    this.key = `http:${this.baseUrl}:${this.workspaceId}:${this.agentId}`;
    this.disabled = runtime.disabled ?? (() => false);
    this.hooks = runtime.hooks;
    this.workspaceBridge = new WorkspaceBridge<HttpAgent>({
      workspaceId: this.workspaceId,
      requestJson: <T>(path: string, init?: RequestInit) =>
        this.requestJson<T>(path, init),
      agent: this,
      tools: runtime.browserTools,
      canHandleBrowserTasks: () => !this.isDisabled(),
      getMode: () => this.getMode(),
      setMode: (mode, reason) => this.setMode(mode, reason),
    });
    this.remoteHistory = this.createRemoteHistory();
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
    this.historyManager.markReady({ hasMore: this.turnsPage.hasMore });
    return page;
  }

  getCompactRecord(): CompactRecord | null {
    return this.compactRecord;
  }

  getHistory(): BoundHistory {
    return this.remoteHistory;
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

  setBrowserTools(tools: Tool[]): void {
    this.workspaceBridge.setTools(tools);
  }

  async requestAI(params: HttpAgentRequestAIParams): Promise<void> {
    if (this.isDisabled()) return;
    this.setSessionState({ running: true, statusText: "准备中..." });
    // 与本地 Agent.requestAI 保持一致：历史 ready 后才能开始新 turn，
    // 避免迟到的 ready snapshot 覆盖正在流式更新的消息。
    await this.historyInitialization;
    await this.workspaceBridge.prepareRun();
    await this.hooks?.beforeTurn?.({
      message: params.message,
      formattedMessage: params.message,
      attachments: params.attachments ?? [],
      ...(params.meta ? { meta: params.meta } : {}),
      ...(params.extra ? { extra: params.extra } : {}),
    });
    await this.hooks?.beforeRequest?.({
      ...(params.meta ? { meta: params.meta } : {}),
      ...(params.extra ? { extra: params.extra } : {}),
    });
    const turnId = params.turnId ?? createTurnId();
    let terminalSeen = false;
    this.handleRemoteEvent({
      event: "turn:start",
      turnId,
      createdAt: Date.now(),
      data: {
        turnId,
        message: params.message,
        attachments: params.attachments ?? [],
        ...(params.meta ? { meta: params.meta } : {}),
      },
    });
    try {
      await this.requestEventStream(
        this.sessionPath("run"),
        {
          method: "POST",
          body: JSON.stringify({
            turnId,
            message: params.message,
            attachments: params.attachments,
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
              event.event === "turn:start" &&
              ((event.data?.turnId ?? event.turnId) === turnId)
            ) {
              return;
            }
            this.handleRemoteEvent(event, { allowBrowserTasks: true });
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
        if (!params.signal?.aborted) {
          this.handleRemoteEvent({
            event: "turn:error",
            turnId,
            createdAt: Date.now(),
            data: { error },
          });
        }
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
    // 当前 turn 已由 SSE 驱动 UI 收口；这里不能再读取 /turns 并覆盖
    // 内存中的流式消息。/turns 只用于首屏历史恢复和向前分页。
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
    if (this.isDisabled()) return;
    await this.requestJson(this.sessionPath("turns/clear"), {
      method: "POST",
    });
    this.turns = [];
    this.compactRecord = null;
    this.turnsPage = {
      hasMore: false,
      oldestTurnId: null,
    };
    this.historyManager.markReady({ hasMore: this.turnsPage.hasMore });
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

  private createRemoteHistory(): BoundHistory {
    return {
      listVersions: async (params) => {
        const query = new URLSearchParams();
        if (params?.pageSize != null) {
          query.set("pageSize", String(params.pageSize));
        }
        if (params?.pageNum != null) {
          query.set("pageNum", String(params.pageNum));
        }
        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await this.requestJson<VersionsPageResponse>(
          `${this.workspacePath("versions")}${suffix}`,
        );
        return normalizeVersionsPage(response);
      },
      addVersion: async (record, files) => {
        if (this.isDisabled()) return;
        await this.requestJson(this.workspacePath("versions"), {
          method: "POST",
          body: JSON.stringify({ record, files }),
        });
      },
      getVersionFiles: async (versionId) => {
        const response = await this.requestJson<VersionFilesResponse>(
          this.workspacePath(
            `versions/${encodeURIComponent(versionId)}/files`,
          ),
        );
        return normalizeVersionFiles(response);
      },
      getVersion: async (versionId) => {
        const response = await this.requestJson<VersionRecordResponse>(
          this.workspacePath(`versions/${encodeURIComponent(versionId)}`),
        );
        return normalizeVersionRecord(response);
      },
      updateVersion: async (versionId, patch) => {
        if (this.isDisabled()) return;
        await this.requestJson(
          this.workspacePath(`versions/${encodeURIComponent(versionId)}`),
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          },
        );
      },
    };
  }

  private isDisabled(): boolean {
    return this.disabled();
  }

  private async initializeHistory(): Promise<void> {
    const page = await this.loadLatestTurns();
    this.turns = page.turns ?? [];
    this.turnsPage = {
      hasMore: Boolean(page.hasMore),
      oldestTurnId: page.oldestTurnId ?? null,
    };
    this.compactRecord = null;
    this.historyManager.markReady({ hasMore: this.turnsPage.hasMore });
  }

  private async loadLatestTurns(
    limit = DEFAULT_TURNS_PAGE_SIZE,
  ): Promise<TurnsPage> {
    return this.session.getTurns({ limit });
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

  /**
   * Browser Tool 仅由直接消费 /run 的连接执行；/connect 只用于回放。
   */
  private handleRemoteEvent(
    event: RemoteAgentEvent,
    options: { allowBrowserTasks?: boolean } = {},
  ): void {
    if (event.event === "workspace:file-change") {
      void this.workspaceBridge
        .syncFileChanges(Number(event.data?.version) || undefined)
        .catch((error) => {
          console.error("[plugin-ai] sync workspace file changes failed", error);
        });
      return;
    }
    if (event.event === "browser:task") {
      // /connect 回放和文件同步在禁用态仍然可用，但不能接管 Browser Tool。
      if (!options.allowBrowserTasks || this.isDisabled()) return;
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
    this.applyTurnEvent(event);
    if (event.event === "session:preparing" || event.event === "session:locked") {
      this.setSessionState({
        running: true,
        turnId: event.turnId ?? this.sessionState.turnId,
        statusText: "准备中...",
      });
      return;
    }
    if (event.event === "session:files-synced") {
      this.setSessionState({
        running: true,
        turnId: event.turnId ?? this.sessionState.turnId,
        statusText: "获取最新文件...",
      });
      return;
    }
    if (event.event === "session:agent-configured") {
      this.setSessionState({
        running: true,
        turnId: event.turnId ?? this.sessionState.turnId,
        statusText: "获取配置...",
      });
      return;
    }
    if (event.event === "session:start") {
      this.setSessionState({
        running: true,
        turnId: event.turnId ?? this.sessionState.turnId,
        statusText: "等待模型响应...",
      });
      return;
    }
    if (event.event === "turn:start" || event.event === "turn:resume") {
      this.setSessionState({
        running: true,
        turnId: event.data?.turnId ?? event.turnId,
        statusText: "等待模型响应...",
      });
    } else if (
      event.event === "turn:complete" ||
      event.event === "turn:abort"
    ) {
      this.setSessionState({ running: false });
      this.triggerAfterTurn(event);
    } else if (event.event === "turn:error") {
      this.setSessionState({
        running: false,
        error: event.data?.error,
      });
      this.triggerAfterTurn(event);
    }
    if (event.event === "mode:change" && event.data?.mode) {
      this.mode = event.data.mode;
    }
    this.events.emit(event.event, event.data as never);
  }

  /**
   * 将 SSE 事件归并进 HttpAgent 的内存 turns，使 getTurns() 与本地 Agent
   * 保持同一契约：在 llm:complete 前已经包含本轮完整快照。
   */
  private applyTurnEvent(event: RemoteAgentEvent): void {
    const data = event.data || {};
    const turnId = this.eventTurnId(event);
    if (!turnId) return;

    if (event.event === "turn:start") {
      if (this.findTurn(turnId)) return;
      let userText = "";
      if (typeof data.message === "string") userText = data.message;
      const turn: TurnRecord = {
        id: turnId,
        startTime: event.createdAt,
        userText,
        userAttachments: [],
        iterations: [],
        status: "success",
      };
      if (typeof data.userFormattedText === "string") {
        turn.userFormattedText = data.userFormattedText;
      }
      if (data.meta) turn.meta = data.meta;
      if (data.sender) turn.sender = data.sender;

      if (Array.isArray(data.attachments)) {
        for (const attachment of data.attachments) {
          const userAttachment: Record<string, unknown> = {
            type: attachment.type || "image",
          };
          if (attachment.content !== undefined) {
            userAttachment.content = attachment.content;
          }
          if (attachment.url !== undefined) {
            userAttachment.url = attachment.url;
          }
          if (attachment.filename || attachment.title) {
            userAttachment.filename = attachment.filename || attachment.title;
          }
          if (attachment.mime) userAttachment.mime = attachment.mime;
          if (attachment.mediaType) {
            userAttachment.mediaType = attachment.mediaType;
          }
          turn.userAttachments.push(userAttachment as any);
        }
      }
      this.turns.push(turn);
      return;
    }

    const turn = this.findTurn(turnId);
    if (!turn) return;

    if (event.event === "turn:resume") {
      turn.status = "success";
      delete turn.error;
      delete turn.endTime;
      return;
    }

    let iterId: string | undefined;
    if (typeof data.iterId === "string") iterId = data.iterId;
    if (event.event === "llm:start" && iterId) {
      if (!this.findLLMIteration(turn, iterId)) {
        turn.iterations.push({
          iterId,
          content: "",
          toolCalls: [],
          startTime: Number(data.startTime) || event.createdAt,
        });
      }
      return;
    }

    if (event.event === "llm:content" && iterId) {
      const iter = this.findLLMIteration(turn, iterId);
      if (!iter) return;
      if (typeof data.content === "string") iter.content = data.content;
      if (iter.responseTime === undefined) iter.responseTime = event.createdAt;
      if (data.thinkingContent !== undefined) {
        iter.thinkingContent = data.thinkingContent;
      }
      return;
    }

    if (event.event === "llm:complete" && iterId) {
      const iter = this.findLLMIteration(turn, iterId);
      if (!iter) return;
      if (data.endTime !== undefined) iter.endTime = Number(data.endTime);
      if (data.usage !== undefined) iter.usage = data.usage;
      if (data.done) {
        turn.status = "success";
        turn.endTime = Number(data.endTime) || event.createdAt;
      }
      return;
    }

    if (event.event === "tool:args" && iterId) {
      const iter = this.findLLMIteration(turn, iterId);
      if (!iter || typeof data.callId !== "string") return;
      const existing = iter.toolCalls.find((call) => call.callId === data.callId);
      if (existing || typeof data.name !== "string") return;
      const tool = this.getTools().find((item) => item.name === data.name);
      const call = {
        callId: data.callId,
        name: data.name,
        args: {},
        status: "pending",
        execStartTime: event.createdAt,
        execEndTime: 0,
      };
      if (tool?.title) call.title = tool.title;
      iter.toolCalls.push(call);
      return;
    }

    if (event.event === "tool:call" && iterId) {
      const iter = this.findLLMIteration(turn, iterId);
      if (!iter || typeof data.callId !== "string") return;
      const call = iter.toolCalls.find((item) => item.callId === data.callId);
      if (call) {
        if (data.args !== undefined) call.args = data.args;
        call.execStartTime = Number(data.startTime) || event.createdAt;
      }
      return;
    }

    if ((event.event === "tool:result" || event.event === "tool:error") && iterId) {
      const iter = this.findLLMIteration(turn, iterId);
      if (!iter || typeof data.callId !== "string") return;
      const call = iter.toolCalls.find((item) => item.callId === data.callId);
      if (!call) return;
      call.execEndTime = Number(data.endTime) || event.createdAt;
      if (event.event === "tool:result") {
        call.status = "success";
        call.result = data.result;
      } else {
        call.status = "error";
        call.error = data.error;
        if (data.errorType) call.errorType = data.errorType;
      }
      return;
    }

    if (event.event === "warmup:start" && iterId) {
      if (!turn.iterations.some((iter) => iter.iterId === iterId)) {
        let content = "";
        if (typeof data.content === "string") content = data.content;
        turn.iterations.push({
          type: "warmup",
          iterId,
          status: "loading",
          content,
          startTime: Number(data.startTime) || event.createdAt,
          toolCalls: [],
        });
      }
      return;
    }

    if (event.event === "warmup:content") {
      let iter: Extract<TurnRecord["iterations"][number], { type: "warmup" }> | undefined;
      for (let index = turn.iterations.length - 1; index >= 0; index--) {
        const current = turn.iterations[index];
        if ("type" in current && current.type === "warmup") {
          iter = current;
          break;
        }
      }
      if (iter && typeof data.content === "string") iter.content = data.content;
      return;
    }

    if (event.event === "warmup:complete" && iterId) {
      const iter = turn.iterations.find(
        (item) => "type" in item && item.type === "warmup" && item.iterId === iterId,
      );
      if (!iter) return;
      if (data.status === "error") {
        iter.status = "error";
      } else {
        iter.status = "success";
      }
      if (typeof data.content === "string") iter.content = data.content;
      iter.endTime = Number(data.endTime) || event.createdAt;
      return;
    }

    if (event.event === "turn:complete") {
      turn.status = "success";
      if (turn.endTime === undefined) turn.endTime = event.createdAt;
    } else if (event.event === "turn:abort") {
      turn.status = "abort";
      if (turn.endTime === undefined) turn.endTime = event.createdAt;
    } else if (event.event === "turn:error") {
      turn.status = "error";
      if (data.error && typeof data.error.message === "string") {
        turn.error = data.error.message;
      } else if (data.error !== undefined) {
        turn.error = String(data.error);
      } else {
        turn.error = "Unknown error";
      }
      if (turn.endTime === undefined) turn.endTime = event.createdAt;
    } else if (event.event === "turn:suggestions") {
      turn.suggestions = data.suggestions;
    } else if (event.event === "turn:suggestions:dismiss") {
      turn.suggestionsDismissed = true;
    } else if (event.event === "turn:delete") {
      turn.deleted = true;
    }
  }

  private eventTurnId(event: RemoteAgentEvent): string | null {
    let turnId = event.turnId;
    if (event.data && typeof event.data.turnId === "string") {
      turnId = event.data.turnId;
    }
    if (typeof turnId === "string" && turnId) return turnId;
    return null;
  }

  private findTurn(turnId: string): TurnRecord | undefined {
    return this.turns.find((turn) => turn.id === turnId);
  }

  private findLLMIteration(turn: TurnRecord, iterId: string) {
    return turn.iterations.find(
      (iter) => !("type" in iter) && iter.iterId === iterId,
    );
  }

  private setSessionState(state: AgentRuntimeState): void {
    if (
      this.sessionState.running === state.running &&
      this.sessionState.turnId === state.turnId &&
      this.sessionState.error === state.error &&
      this.sessionState.statusText === state.statusText
    ) {
      return;
    }
    this.sessionState = state;
    for (const listener of this.sessionStateListeners) listener(state);
  }

  /** 同一 turn 可能经 SSE 重放，afterTurn 必须只执行一次。 */
  private triggerAfterTurn(event: RemoteAgentEvent): void {
    const turnId = event.data?.turnId ?? event.turnId;
    if (typeof turnId !== "string" || !turnId || this.completedHookTurns.has(turnId)) {
      return;
    }
    this.completedHookTurns.add(turnId);
    const status =
      event.event === "turn:complete"
        ? "success"
        : event.event === "turn:abort"
          ? "abort"
          : "error";
    void Promise.resolve(
      this.hooks?.afterTurn?.({
        id: turnId,
        status,
        ...(event.event === "turn:error" ? { error: event.data?.error } : {}),
      } as TurnRecord),
    ).catch((error) => {
      console.warn("[HttpAgent] hooks.afterTurn failed:", error);
    });
  }

  async requestJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
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

  private workspacePath(action: string): string {
    return `/workspaces/${encodeURIComponent(this.workspaceId)}/${action}`;
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

function normalizeVersionsPage(
  response: VersionsPageResponse | undefined,
): { total: number; list: VersionRecord[] } {
  if (Array.isArray(response)) {
    return { total: response.length, list: response };
  }
  const list = response?.list ?? response?.versions ?? [];
  return {
    total: Number(response?.total ?? list.length) || 0,
    list,
  };
}

function normalizeVersionRecord(
  response: VersionRecordResponse | undefined,
): VersionRecord | null {
  if (!response) return null;
  if ("record" in response) return response.record ?? null;
  return response;
}

function normalizeVersionFiles(
  response: VersionFilesResponse | undefined,
): VersionFile[] {
  if (Array.isArray(response)) return response;
  return response?.files ?? [];
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

function createTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
