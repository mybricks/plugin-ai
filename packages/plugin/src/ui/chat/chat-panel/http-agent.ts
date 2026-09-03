import {
  AgentEvents,
  HistoryManager,
  AgentModeEnum,
  getAvailableAgentModes,
  type AgentMode,
  type AgentEventMap,
  type AgentHooks,
  type CompactRecord,
  type BoundHistory,
  type Tool,
  type ToolUIChannel,
  type TurnRecord,
  type VersionFile,
  type VersionRecord,
} from "../../../../../agent/src";
import type { Sandbox } from "../../../../../agent/src/code-agent";
import type {
  ActivePlanFile,
  PlanFileInfo,
} from "../../../../../agent/src/mode-manager";
import type { AgentRuntimeState } from "../../../context/agent-runtime";
import { context } from "../../../context";
import type { BrowserToolRequest } from "./workspace-bridge";
import { WorkspaceBridge } from "./workspace-bridge";
import { HTTP_AGENT_SESSION_STAGE } from "./session-status";
import type { DisabledHandler } from "../../../disabled-handler";
import type {
  RemoteFileSystem,
  RemoteFsOperationsResult,
} from "../../../sandbox/connect-shared";

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
type PlansPageResponse = {
  items?: Array<PlanFileInfo & { content: string }>;
  total?: number;
  nextCursor?: string | null;
};

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
  /** LLM iter 的模式快照；服务端只在 llm:* 事件上提供。 */
  mode?: AgentMode;
  /** LLM iter 的模型快照；服务端只在 llm:* 事件上提供。 */
  model?: string;
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
  /** plugin-ai 初始化时创建的统一 disabled handler。 */
  disabledHandler?: DisabledHandler;
  /** 禁用的运行模式；与本地 CodeAgent.disabledModes 语义一致。 */
  disabledModes?: AgentMode[];
  /** 注册到浏览器端执行的工具。服务端可通过 SSE browser:task 按 name 调用。 */
  browserTools?: Tool[];
  /**
   * 浏览器侧生命周期 hooks。远程 Agent 的实际推理在服务端执行，但 sandbox
   * 仍需要这些 hooks 来维护 loading、锁和 undo/redo 等本地 UI 状态。
   */
  hooks?: AgentHooks;
}

interface HttpAgentRequestAICommonParams {
  turnId?: string;
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

/** 单消息请求：同一文本用于展示与模型输入。 */
export interface MessageHttpAgentRequestAIParams
  extends HttpAgentRequestAICommonParams {
  message: string;
  displayMessage?: never;
  modelMessage?: never;
}

/** 双消息请求：displayMessage 用于展示，modelMessage 用于模型输入。 */
export interface DisplayModelHttpAgentRequestAIParams
  extends HttpAgentRequestAICommonParams {
  displayMessage: string;
  modelMessage: string;
  message?: never;
}

export type HttpAgentRequestAIParams =
  | MessageHttpAgentRequestAIParams
  | DisplayModelHttpAgentRequestAIParams;

interface HttpAgentRetryOptions {
  turnId: string;
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
const INTERRUPTED_TURN_MESSAGE = "任务异常中断，可点击重试继续";
/**
 * TODO: 服务端支持 Agent 探活和 turn 终态确认后，改用服务端状态判断任务是否结束。
 * 当前仍保留客户端超时作为兜底，但需要容忍代理缓冲和服务端背压。
 */
const ENABLE_SSE_IDLE_WATCHDOG = true;
const SSE_IDLE_TIMEOUT_MS = 5 * 60_000;

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
  private readonly disabledHandler?: DisabledHandler;
  private readonly disabledModes: AgentMode[];
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
  /** 已进入浏览器侧 hook 生命周期的 turn，避免 /run 与 /connect 回放重复启动。 */
  private readonly startedHookTurns = new Set<string>();
  /** /connect 启动 hook 可能是异步的；终态必须在其完成后再触发 afterTurn。 */
  private readonly replayStartHookTasks = new Map<string, Promise<void>>();
  private readonly completedHookTurns = new Set<string>();
  /** 已消费的异步摘要，避免 run/connect 重放或重复摘要订阅触发两次。 */
  private readonly completedSummaryHookTurns = new Set<string>();
  /** 已消费的后台收口，避免 run/connect 重放触发两次。 */
  private readonly completedSettledHookTurns = new Set<string>();

  constructor(options: HttpAgentOptions, runtime: HttpAgentRuntimeOptions = {}) {
    this.baseUrl = trimRight(options.baseUrl ?? DEFAULT_BASE_URL, "/");
    this.workspaceId = options.workspaceId;
    this.agentId = options.agentId ?? DEFAULT_AGENT_ID;
    this.key = `http:${this.baseUrl}:${this.workspaceId}:${this.agentId}`;
    this.disabledHandler = runtime.disabledHandler;
    this.disabledModes = runtime.disabledModes ?? [];
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
      .then(() => this.workspaceBridge.waitInitialized())
      .then(() => this.connectEventReplay())
      .catch((error) => {
        console.error("[plugin-ai] remote init failed", error);
      });
  }

  getMode(): AgentMode {
    return this.mode;
  }

  /** 远端 workspace 中当前 active 的计划文件。 */
  async getPlanFile(): Promise<ActivePlanFile | null> {
    const query = new URLSearchParams({ status: "active", limit: "1" });
    const page = await this.requestJson<PlansPageResponse>(
      `${this.workspacePath("plans")}?${query.toString()}`,
    );
    const plan = page.items?.[0];
    return plan?.status === "active" ? plan as ActivePlanFile : null;
  }

  setMode(mode: AgentMode, reason?: string): void {
    const previousMode = this.mode;
    this.mode = mode;
    if (previousMode !== mode) {
      this.events.emit("mode:change", { mode, previousMode, reason });
    }
  }

  getAvailableModes(): AgentMode[] {
    return getAvailableAgentModes({ disabledModes: this.disabledModes });
  }

  getLLMProviders(): undefined {
    return undefined;
  }

  getTools(): Tool[] {
    return this.workspaceBridge.getTools();
  }

  /**
   * 远端 Agent 的工具交互实际由浏览器 BrowserToolBridge 承接。
   * 与 CodeAgent 的同名方法保持一致，让工具 renderer 能直接提交问答答案。
   */
  getToolUI(): ToolUIChannel {
    return this.workspaceBridge.getToolUI();
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
    if (this.blockIfDisabled()) return;
    const displayMessage = params.displayMessage ?? params.message!;
    const modelMessage = params.modelMessage ?? params.message!;
    const turnId = params.turnId ?? createTurnId();
    this.setSessionState({
      running: true,
      turnId,
      stage: { key: HTTP_AGENT_SESSION_STAGE.PREPARING },
    });
    try {
      await this.historyInitialization;
      await this.hooks?.beforeTurn?.({
        message: displayMessage,
        formattedMessage: modelMessage,
        attachments: params.attachments ?? [],
        ...(params.meta ? { meta: params.meta } : {}),
        ...(params.extra ? { extra: params.extra } : {}),
      });
      await this.hooks?.beforeRequest?.({
        ...(params.meta ? { meta: params.meta } : {}),
        ...(params.extra ? { extra: params.extra } : {}),
      });
      if (this.isDisabled()) return;
      // browser/connect 必须在 /run 取得 turn 锁前完成；否则服务端可能还没
      // 把当前浏览器登记为 Browser Tool 执行端。登记失败仍允许纯模型请求继续。
      await this.connectBrowserTools(params.signal).catch((error) => {
        console.warn("[plugin-ai] browser tool connection failed", error);
      });
      // 正常 /run 已执行过启动 hooks。初始化时若 /connect 恰好重放同一 turn，
      // 需要跳过它，避免重复上锁和重复触发 onStart。
      this.startedHookTurns.add(turnId);
      this.handleRemoteEvent(
        {
          event: "turn:start",
          turnId,
          createdAt: Date.now(),
          data: {
            turnId,
            message: displayMessage,
            attachments: params.attachments ?? [],
            ...(params.meta ? { meta: params.meta } : {}),
            ...(modelMessage !== displayMessage
              ? { userFormattedText: modelMessage }
              : {}),
          },
        },
        // 本地合成 turn:start 只为立即渲染用户消息，不能跳过服务端的准备阶段。
        { updateSessionState: false },
      );
      const { providerId, modelId } = this.resolveModelSelection(
        params.providerId,
        params.modelId,
      );
      await this.consumeRunStream(
        this.sessionPath("run"),
        {
          method: "POST",
          body: jsonStringifySafe({
            turnId,
            ...(params.message !== undefined
              ? { message: params.message }
              : {
                  displayMessage: params.displayMessage,
                  modelMessage: params.modelMessage,
                }),
            attachments: params.attachments,
            ...(params.mode ? { mode: params.mode } : {}),
            ...(params.meta ? { meta: params.meta } : {}),
            ...(params.extra ? { extra: params.extra } : {}),
            ...(params.aiRole ? { aiRole: params.aiRole } : {}),
            ...(providerId ? { providerId } : {}),
            ...(modelId ? { modelId } : {}),
          }),
        },
        { signal: params.signal, skipTurnStartId: turnId },
      );
    } catch (error) {
      if (turnId && !params.signal?.aborted) {
        this.handleRemoteEvent({
          event: "turn:error",
          turnId,
          createdAt: Date.now(),
          data: { error: serializeError(error) },
        });
      }
      params.onError?.(error as Error);
      throw error;
    } finally {
      this.setSessionState({ running: false });
      if (turnId) params.onClose?.();
    }
  }

  async retry(turnId: string): Promise<void>;
  async retry(params: HttpAgentRetryOptions): Promise<void>;
  async retry(turnIdOrOptions: string | HttpAgentRetryOptions): Promise<void> {
    const params = typeof turnIdOrOptions === "string"
      ? { turnId: turnIdOrOptions }
      : turnIdOrOptions;
    if (this.blockIfDisabled()) return;
    const { turnId } = params;
    this.setSessionState({
      running: true,
      turnId,
      stage: { key: HTTP_AGENT_SESSION_STAGE.PREPARING },
    });
    try {
      await this.historyInitialization;
      // retry 的 SSE 只下发本次 attempt，不再回放旧事件：先用服务端快照校准
      // 本地该 turn，避免本地状态与服务端不一致。
      await this.calibrateLastTurn(turnId);
      const turn = this.findTurn(turnId);
      if (turn?.endTime != null) return;
      await this.hooks?.beforeTurn?.({
        message: turn?.userText ?? "",
        formattedMessage: turn?.userFormattedText ?? turn?.userText ?? "",
        attachments: (turn?.userAttachments as any[]) ?? [],
      });
      await this.hooks?.beforeRequest?.({});
      if (this.isDisabled()) return;
      await this.connectBrowserTools(params.signal).catch((error) => {
        console.warn("[plugin-ai] browser tool connection failed", error);
      });
      this.startedHookTurns.add(turnId);
      const { providerId, modelId } = this.resolveModelSelection(
        params.providerId,
        params.modelId,
      );
      await this.consumeRunStream(
        this.sessionPath("retry"),
        {
          method: "POST",
          body: jsonStringifySafe({
            turnId,
            ...(providerId ? { providerId } : {}),
            ...(modelId ? { modelId } : {}),
          }),
        },
        { signal: params.signal },
      );
    } catch (error) {
      if (!params.signal?.aborted) {
        this.handleRemoteEvent({
          event: "turn:error",
          turnId,
          createdAt: Date.now(),
          data: { error: serializeError(error) },
        });
      }
      params.onError?.(error as Error);
      throw error;
    } finally {
      this.setSessionState({ running: false });
      params.onClose?.();
    }
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
    if (this.blockIfDisabled()) return;
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

  async dismissSuggestions(turnId: string): Promise<void> {
    if (this.blockIfDisabled()) return;
    await this.requestJson(
      this.sessionPath(`turns/${encodeURIComponent(turnId)}/suggestions/dismiss`),
      { method: "POST" },
    );
    this.handleRemoteEvent({
      event: "turn:suggestions:dismiss",
      turnId,
      createdAt: Date.now(),
      data: { turnId },
    });
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
      /** 服务端关闭前给出的确定结论。 */
      /** /connect 返回 204，表示服务端确认当前没有活跃 turn。 */
      onIdle?: () => void;
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
          onNoContent: params.onIdle,
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
    bindSandbox: (sandbox: Sandbox): Promise<void> => {
      return this.workspaceBridge.bindSandbox(sandbox);
    },
    ensureBrowserConnected: async (): Promise<void> => {
      await this.workspaceBridge.ensureConnected();
    },
    disconnect: (): void => {
      this.workspaceBridge.disconnect();
    },
  };

  /** 供宿主实时写入 remote workspace 的文件系统，不创建版本。 */
  readonly remoteFs: RemoteFileSystem = {
    applyOperations: async (operations) => {
      if (this.blockIfDisabled()) {
        throw new Error("Remote file system operations are disabled.");
      }
      return this.requestJson<RemoteFsOperationsResult>(
        this.workspacePath("fs/operations"),
        {
          method: "POST",
          body: JSON.stringify({ operations }),
        },
      );
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
        if (this.blockIfDisabled()) return;
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
        if (this.blockIfDisabled()) return;
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
    return this.disabledHandler?.isDisabled() ?? false;
  }

  /**
   * 用户侧写操作入口：禁用时提示宿主并返回 true。
   * 中途轮询 / Browser Tool 能力判断等静默路径请继续用 isDisabled()。
   */
  private blockIfDisabled(): boolean {
    if (!this.isDisabled()) return false;
    this.disabledHandler?.message("当前没有操作权限");
    return true;
  }

  /**
   * 解析本次请求使用的模型：显式传入的 providerId/modelId 优先，
   * 否则取 context 中为该 agent key 保存的模型选择（与模型选择 UI 联动）。
   * 未配置 LLM providers 时返回空对象，不向服务端传模型参数。
   */
  private resolveModelSelection(providerId?: string, modelId?: string): {
    providerId?: string;
    modelId?: string;
  } {
    const selected = context.getModelSelection(this.key)?.getSelected();
    return {
      providerId: providerId ?? selected?.providerId,
      modelId: modelId ?? selected?.modelId,
    };
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
    let terminalSeen = false;
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
        if (event.event === "session:locked") {
          this.startReplayHookLifecycle(event);
        }
        if (isTerminalRemoteEvent(event)) terminalSeen = true;
        if (event.event === "turn:resume" || event.event === "turn:start") {
          terminalSeen = false;
        }
        this.handleRemoteEvent(event);
      },
      onError: (error) => {
        this.setSessionState({ running: false, error });
        console.error("[plugin-ai] remote agent replay failed", error);
      },
      onClose: () => {
        if (!terminalSeen) this.markLastUnfinishedTurnInterrupted();
      },
      onIdle: () => {
        this.markLastUnfinishedTurnInterrupted();
      },
    });
  }

  /**
   * 历史中的 success + 无 endTime 表示该 turn 曾启动但没有正常落终态。
   * /connect 返回 204 后才能确认它已不在其他实例执行；这里只派生本地错误 UI，
   * 不回写远端 History，retry 仍可据无 endTime 判断为断点续跑。
   */
  private markLastUnfinishedTurnInterrupted(): void {
    const turn = this.turns[this.turns.length - 1];
    if (!turn || turn.status !== "success" || turn.endTime != null) return;

    turn.status = "error";
    turn.error = INTERRUPTED_TURN_MESSAGE;
    turn.endTime = Date.now();
    this.setSessionState({ running: false });
    // 即使初始化期间还没有事件订阅者，重新发布 History 快照也能刷新 UI。
    this.historyManager.markReady({ hasMore: this.turnsPage.hasMore });
    this.events.emit("turn:error", { error: new Error(INTERRUPTED_TURN_MESSAGE) });
  }

  /**
   * Browser Tool 仅由直接消费 /run 的连接执行；/connect 只用于回放。
   */
  private handleRemoteEvent(
    event: RemoteAgentEvent,
    options: {
      allowBrowserTasks?: boolean;
      /** 本地合成事件仅用于同步消息记录，不应覆盖服务端阶段状态。 */
      updateSessionState?: boolean;
    } = {},
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
    if (
      event.event === "turn:summary" ||
      event.event === "turn:summary:error"
    ) {
      this.triggerAfterTurnSummary(event);
    }
    if (event.event === "turn:settled") {
      this.triggerAfterTurnSettled(event);
    }
    this.applyTurnEvent(event);
    const shouldUpdateSessionState =
      options.updateSessionState !== false &&
      this.shouldUpdateSessionState(event);
    const eventTurnId = this.eventTurnId(event);
    if (
      shouldUpdateSessionState &&
      (event.event === "session:preparing" || event.event === "session:locked")
    ) {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.PREPARING },
      });
      return;
    }
    if (shouldUpdateSessionState && event.event === "session:files-synced") {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.SYNCING_FILES },
      });
      return;
    }
    if (shouldUpdateSessionState && event.event === "session:agent-configured") {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.CONFIGURING },
      });
      return;
    }
    if (shouldUpdateSessionState && event.event === "session:start") {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.AWAITING_MODEL },
      });
      return;
    }
    if (
      shouldUpdateSessionState &&
      (event.event === "turn:start" || event.event === "turn:resume")
    ) {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.AWAITING_MODEL },
      });
    } else if (
      shouldUpdateSessionState &&
      (event.event === "turn:complete" || event.event === "turn:abort")
    ) {
      this.setSessionState({ running: false });
      this.triggerAfterTurn(event);
    } else if (shouldUpdateSessionState && event.event === "turn:error") {
      this.setSessionState({
        running: false,
        error: event.data?.error,
      });
      this.triggerAfterTurn(event);
    } else if (
      event.event === "turn:complete" ||
      event.event === "turn:abort" ||
      event.event === "turn:error"
    ) {
      this.triggerAfterTurn(event);
    } else if (shouldUpdateSessionState && event.event === "llm:start") {
      this.setSessionState({
        running: true,
        turnId: eventTurnId ?? this.sessionState.turnId,
        stage: { key: HTTP_AGENT_SESSION_STAGE.AWAITING_MODEL },
      });
    }
    if (event.event === "mode:change" && event.data?.mode) {
      this.mode = event.data.mode;
    }
    this.events.emit(event.event as keyof AgentEventMap, event.data as never);
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
      if (turn.status === "success") return;
      this.completedHookTurns.delete(turnId);
      this.completedSummaryHookTurns.delete(turnId);
      this.completedSettledHookTurns.delete(turnId);
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
          ...(event.mode ? { mode: event.mode } : {}),
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

  /** /connect 回放不应把当前 /run 的状态切回其他 turn 的阶段文案。 */
  private shouldUpdateSessionState(event: RemoteAgentEvent): boolean {
    const eventTurnId = this.eventTurnId(event);
    return (
      !eventTurnId ||
      !this.sessionState.running ||
      !this.sessionState.turnId ||
      this.sessionState.turnId === eventTurnId
    );
  }

  private findTurn(turnId: string): TurnRecord | undefined {
    return this.turns.find((turn) => turn.id === turnId);
  }

  /**
   * 用服务端最新记录覆盖本地待重试的 turn。
   * retry 的 SSE 不回放旧 attempt，一致性由这份快照保证。
   */
  private async calibrateLastTurn(turnId: string): Promise<void> {
    try {
      const page = await this.session.getTurns({ limit: 1 });
      const remote = (page.turns ?? []).find((turn) => turn.id === turnId);
      if (!remote) return;
      this.turns = mergeTurnRecords(this.turns, [remote]);
      this.historyManager.markReady({ hasMore: this.turnsPage.hasMore });
    } catch (error) {
      // 校准失败不阻塞 retry：服务端仍会校验 turnId 必须是最后一个 turn。
      console.warn("[HttpAgent] calibrate turn before retry failed:", error);
    }
  }

  private findLLMIteration(turn: TurnRecord, iterId: string) {
    return turn.iterations.find(
      (iter) => !("type" in iter) && iter.iterId === iterId,
    );
  }

  /**
   * 刷新后只有 /connect 回放，不会经过 requestAI，因此也不会自然触发
   * beforeTurn / beforeRequest。收到 session:locked 时补齐一次浏览器侧
   * 生命周期，以恢复 loading、设计器 lock 和 vibing 等 UI 状态。
   *
   * session:locked 发生在服务端完成 workspace 准备之前，尚无用户消息可用；
   * 该 hook 仅用于恢复本地 UI，消息内容仍由后续的 turn:start 回放填充。
   */
  private startReplayHookLifecycle(event: RemoteAgentEvent): void {
    const turnId = this.eventTurnId(event);
    if (!turnId || this.startedHookTurns.has(turnId)) return;

    this.startedHookTurns.add(turnId);
    const task = (async () => {
      await this.hooks?.beforeTurn?.({
        message: "",
        formattedMessage: "",
        attachments: [],
      });
      await this.hooks?.beforeRequest?.({});
    })();
    this.replayStartHookTasks.set(turnId, task);
    void task.catch((error) => {
      console.warn("[HttpAgent] replay start hooks failed:", error);
    });
  }

  private setSessionState(state: AgentRuntimeState): void {
    if (
      this.sessionState.running === state.running &&
      this.sessionState.turnId === state.turnId &&
      this.sessionState.error === state.error &&
      this.sessionState.stage?.key === state.stage?.key
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
    const replayStartTask = this.replayStartHookTasks.get(turnId);
    void Promise.resolve(replayStartTask)
      // 启动 hook 的错误已单独记录；仍要运行 afterTurn，以清理已部分建立的 UI 状态。
      .catch(() => undefined)
      .then(() => this.hooks?.afterTurn?.({
        id: turnId,
        status,
        ...(event.event === "turn:error" ? { error: event.data?.error } : {}),
      } as TurnRecord))
      .catch((error) => {
        console.warn("[HttpAgent] hooks.afterTurn failed:", error);
      })
      .finally(() => {
        this.replayStartHookTasks.delete(turnId);
        this.startedHookTurns.delete(turnId);
      });
  }

  /** 服务端已结束的摘要任务；客户端仅触发 hook，不再写 history。 */
  private triggerAfterTurnSummary(event: RemoteAgentEvent): void {
    const turnId = this.eventTurnId(event);
    const summary = event.data?.summary;
    if (
      !turnId ||
      (event.event === "turn:summary" && typeof summary !== "string") ||
      this.completedSummaryHookTurns.has(turnId)
    ) {
      return;
    }
    this.completedSummaryHookTurns.add(turnId);
    const turn =
      this.findTurn(turnId) ??
      ({ id: turnId, status: "success" } as TurnRecord);
    const result =
      event.event === "turn:summary:error"
        ? { status: "error" as const, error: event.data?.error }
        : {
            status: "success" as const,
            ...(typeof event.data?.versionId === "string"
              ? { versionId: event.data.versionId }
              : {}),
          };
    void Promise.resolve(
      this.hooks?.afterTurnSummary?.(turn, summary ?? "", result),
    ).catch(
      (error) => {
        console.warn("[HttpAgent] hooks.afterTurnSummary failed:", error);
      },
    );
  }

  /** 服务端后台任务已收口；不改变已由 turn:complete 结束的 UI loading。 */
  private triggerAfterTurnSettled(event: RemoteAgentEvent): void {
    const turnId = this.eventTurnId(event);
    if (!turnId || this.completedSettledHookTurns.has(turnId)) return;
    this.completedSettledHookTurns.add(turnId);
    const turn =
      this.findTurn(turnId) ??
      ({ id: turnId, status: "success" } as TurnRecord);
    void Promise.resolve(this.hooks?.afterTurnSettled?.(turn)).catch((error) => {
      console.warn("[HttpAgent] hooks.afterTurnSettled failed:", error);
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

  /**
   * 在 run 前显式声明当前浏览器可执行 Browser Tool。服务端会把这项状态
   * 与随后取得的 turn 锁绑定，并在 turn 结束时清理。
   */
  private async connectBrowserTools(signal?: AbortSignal): Promise<void> {
    if (this.isDisabled()) return;
    await this.workspaceBridge.connectBrowserTools(
      this.agentId === DEFAULT_AGENT_ID ? undefined : this.agentId,
      signal,
    );
  }

  private async consumeRunStream(
    path: string,
    init: RequestInit,
    options: {
      signal?: AbortSignal;
      skipTurnStartId?: string;
    } = {},
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let terminalSeen = false;
      void this.requestEventStream(path, init, {
        signal: options.signal,
        onEvent: (event) => {
          if (
            options.skipTurnStartId &&
            event.event === "turn:start" &&
            (event.data?.turnId ?? event.turnId) === options.skipTurnStartId
          ) {
            return;
          }
          this.handleRemoteEvent(event, { allowBrowserTasks: true });
          if (!isTerminalRemoteEvent(event)) return;
          terminalSeen = true;
          resolve();
        },
      })
        .then(() => {
          if (terminalSeen || options.signal?.aborted) {
            if (!terminalSeen) resolve();
            return;
          }
          reject(new SseDisconnectedError(INTERRUPTED_TURN_MESSAGE));
        })
        .catch((error) => {
          if (options.signal?.aborted) { resolve(); return; }
          if (!terminalSeen) { reject(error); return; }
          console.warn("[HttpAgent] post-turn SSE closed before summary:", error);
        });
    });
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
      onNoContent?: () => void;
    } = {},
  ): Promise<void> {
    const watchdog = ENABLE_SSE_IDLE_WATCHDOG
      ? createSseIdleWatchdog(SSE_IDLE_TIMEOUT_MS, params.signal)
      : undefined;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: watchdog?.signal ?? params.signal,
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
        params.onNoContent?.();
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
        if (value?.byteLength) watchdog?.touch();
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
      if (watchdog?.didTimeout()) {
        const disconnected = new SseDisconnectedError(INTERRUPTED_TURN_MESSAGE);
        params.onError?.(disconnected);
        throw disconnected;
      }
      if ((error as Error)?.name === "AbortError") {
        params.onClose?.();
        return;
      }
      params.onError?.(error as Error);
      throw error;
    } finally {
      watchdog?.dispose();
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
  const data: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }
  if (!data.length || !onEvent) return;
  try {
    onEvent(JSON.parse(data.join("\n")) as RemoteAgentEvent);
  } catch (error) {
    console.warn("[HttpAgent] malformed SSE frame ignored:", error);
  }
}

function trimRight(value: string, char: string): string {
  let next = value;
  while (next.endsWith(char)) next = next.slice(0, -char.length);
  return next;
}

function createTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSseIdleWatchdog(timeoutMs: number, external?: AbortSignal) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;
  const abortFromExternal = () => controller.abort();

  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", abortFromExternal);

  const touch = () => {
    if (timer) clearTimeout(timer);
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  };
  touch();

  return {
    signal: controller.signal,
    touch,
    didTimeout: () => timedOut,
    dispose: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", abortFromExternal);
    },
  };
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

function jsonStringifySafe(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && "nodeType" in val) {
      return undefined;
    }
    return val;
  });
}

function serializeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return { message: String(error) };
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
