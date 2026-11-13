import {
  AgentEvents,
  AgentModeEnum,
  HistoryManager,
  kv,
  type AgentMode,
  type AgentHooks,
  type BoundHistory,
  type CompactRecord,
  type History,
  type Sandbox,
  type Tool,
  type ToolCallRecord,
  type TurnRecord,
} from "../../../../../agent/src";
import { getActivePlanFile, type ActivePlanFile } from "../../../../../agent/src/mode-manager";
import { splitFrontmatter } from "../../../../../agent/src/utils/frontmatter";
import type { ToolExecutionContext } from "../../../../../agent/src/types";
import { createToolUIChannel, type ToolUIChannel } from "../../../../../agent/src/tool-ui";
import type { AgentRuntimeState } from "../../../context/agent-runtime";
import { WEBSOCKET_AGENT_SESSION_STAGE } from "./session-status";
import { SteerChannel, type SteerParams } from "./websocket-agent-steer";

/** 解析鉴权字段：支持字符串或按请求实时取值的函数。 */
function resolveAuthValue(v?: string | (() => string | undefined | null)): string | undefined {
  return typeof v === "function" ? (v() ?? undefined) : v;
}

export interface WebSocketAgentOptions {
  /** MCP Server 地址，例如 http://112.17.139.222:8106 */
  baseUrl: string;
  /** 平台网关鉴权 token，必填；以 "token" header 发送，WS 握手以 "authToken" 参数发送。支持传函数按请求实时取值。 */
  token: string | (() => string | undefined | null);
  /** 平台网关会话标识，必填；以 "session" header 发送，WS 握手以 "authSession" 参数发送。支持传函数按请求实时取值。 */
  session: string | (() => string | undefined | null);
  /** 工作空间 ID，写入会话 meta 供审计。 */
  workspaceId: string;
  /** 服务端会话 ID；传入时复用该会话，否则新建。 */
  sessionId?: string;
  /** 目标智能体 code；留空走默认智能体。 */
  agentCode?: string;
  /** 业务变量：项目 ID，随 /chat/stream 的 variables 发送。 */
  projectId?: string | number;
  /** 业务变量：应用类型，随 /chat/stream 的 variables 发送。 */
  appType?: string | number;
  /** 客户端类型标识，仅作记录。 */
  clientType?: string;
  /** 业务元数据，创建会话时原样落库。 */
  meta?: Record<string, any>;
}

export interface WebSocketAgentRuntimeOptions {
  /** 由通道对端执行的工具集（read_file / write_file 等），落到本地 sandbox。 */
  tools?: Tool[];
  /** 本地 sandbox；用于读取/修改计划文件（getPlanFile / abandonPlan）。 */
  sandbox?: Sandbox;
  disabled?: () => boolean;
  onDisabledRequest?: () => void;
  disabledModes?: AgentMode[];
  hooks?: AgentHooks;
  /** 本地历史存储；提供后 getHistory 返回可用视图并持久化 turns。 */
  history?: History;
  /** 历史存储命名空间 key（默认使用 agent.key）。 */
  historyKey?: string;
  /**
   * 动态配置消息（对应 prompt.js 中系统提示词之后、用户输入之前的若干条 user 内容，
   * 如前端开发指南、项目空间信息）。系统提示词已在智能体平台侧固定配置，这里只补动态部分。
   * 首个远程会话建立后，会通过追加消息端点一次性 seed 进会话。
   */
  getSeedMessages?: () => Promise<string[]> | string[];
  /**
   * 动态获取当前服务端会话 ID，供外部历史读取实现使用。
   * 在 SessionHTTPHistory 等需要先有 agent 实例才能拿到 sessionId 的场景下使用。
   */
  getSessionId?: () => string | undefined;
  /**
   * 本地会话被重置/清除时触发；调用方可在此通知后端清理其保存的 sessionId。
   * 入参为被重置前的 sessionId。
   */
  onSessionReset?: (sessionId: string) => void | Promise<void>;
}

interface WebSocketAgentRequestAICommonParams {
  attachments?: any[];
  mode?: AgentMode;
  meta?: Record<string, any>;
  extra?: Record<string, any>;
  /** 业务变量；携带时 agentCode 必填（见平台 businessVariables 声明集）。 */
  variables?: Record<string, any>;
  signal?: AbortSignal;
}
/** 单消息：同一文本用于展示与模型输入。 */
export interface MessageWebSocketAgentRequestAIParams extends WebSocketAgentRequestAICommonParams {
  message: string;
  displayMessage?: never;
  modelMessage?: never;
}
/** 双消息：displayMessage 展示，modelMessage 发送给模型。 */
export interface DisplayModelWebSocketAgentRequestAIParams extends WebSocketAgentRequestAICommonParams {
  displayMessage: string;
  modelMessage: string;
  message?: never;
}
export type WebSocketAgentRequestAIParams =
  | MessageWebSocketAgentRequestAIParams
  | DisplayModelWebSocketAgentRequestAIParams;

type WsEnvelope = { v?: number; type?: string; requestId?: string; payload?: any;[key: string]: any };
type ToolResult = { ok: true; result: any } | { ok: false; error: { code: string; message: string } };
type ChatEvent = { name: string; data: any };

/** 与 TurnRecord.iterations 中的 LLM 迭代结构对齐（排除 warmup）。 */
export interface LLMIter {
  iterId: string;
  content: string;
  toolCalls: ToolCallRecord[];
  startTime: number;
  endTime?: number;
  mode?: AgentMode;
}

/** /chat/stream 的流式写入状态：iter 为当前活跃迭代，segment 为该 iter 内的正文累积。 */
export interface ChatStreamState {
  /** 当前正在写入的 turn；steer_delivered 时切换到插话自己的一轮。 */
  turn: TurnRecord;
  iter: LLMIter;
  segment: string;
  /** 整轮累积的全部正文，仅用于 done 事件兜底判断（流内无 delta 时取 data.answer）。 */
  answer: string;
}

interface PersistedSession {
  /** 服务端会话 ID */
  sessionId?: string;
}

const MAX_RECONNECT_ATTEMPTS = 6;

export class WebSocketAgent {
  readonly kind = "websocket";
  readonly protocol = "agent-events";
  readonly events = new AgentEvents();
  readonly historyManager: HistoryManager;
  readonly key: string;
  private readonly options: WebSocketAgentOptions;
  private tools: Tool[];
  private readonly sandbox?: Sandbox;
  private readonly disabled: () => boolean;
  private readonly onDisabledRequest?: () => void;
  private readonly disabledModes: AgentMode[];
  private readonly hooks?: AgentHooks;
  private readonly getSeedMessages?: () => Promise<string[]> | string[];
  private readonly toolUI: ToolUIChannel = createToolUIChannel();
  private readonly turns: TurnRecord[] = [];
  private readonly stateListeners = new Set<(state: AgentRuntimeState) => void>();
  /** 服务端会话 ID，供外部历史读取实现使用。 */
  get sessionId(): string | undefined { return this._sessionId ?? this.getSessionIdForHistory?.(); }
  private _sessionId?: string;
  private socket: WebSocket | null = null;
  private socketPromise: Promise<void> | null = null;
  private socketReady = false;
  /** 服务端返回的 WebSocket 通道地址（已内嵌 sessionId 与 token）。 */
  private channelUrl?: string;
  /** 会话 JWT，用于 DELETE /sessions/{id}。 */
  private sessionToken?: string;
  /** 会话绝对到期时间（ms epoch）。 */
  private sessionExpiresAt?: number;
  /** 每轮内工具执行结果缓存，按 requestId 去重（turn 结束时清理）。 */
  private readonly toolResults = new Map<string, ToolResult>();
  /** requestId → 承载该工具调用的 LLM iter（用于 emit 事件时定位）。 */
  private readonly toolIterMap = new Map<string, LLMIter>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalMs = 30000;
  private reconnectAttempts = 0;
  private stopReconnect = false;
  private disposed = false;
  private mode: AgentMode = AgentModeEnum.Build;
  private conversationSessionId?: string;
  private activeTurnId?: string;
  private chatAbort?: AbortController;
  /** 插话通道：steer 请求的发送、消费、在途计数与 inboxId 配对都在这里。 */
  private readonly steerChannel: SteerChannel;
  /**
   * 团队成员的原始状态：member → RUNNING/DONE/FAILED（来自 team_round_update / team_member_state）。
   * 展示文案由 UI 层（session-status）负责映射。
   */
  private readonly teamStatus = new Map<string, "RUNNING" | "DONE" | "FAILED">();
  private state: AgentRuntimeState = { running: false };
  private readonly getSessionIdForHistory?: () => string | undefined;
  private readonly onSessionReset?: (sessionId: string) => void | Promise<void>;

  constructor(options: WebSocketAgentOptions, runtime: WebSocketAgentRuntimeOptions = {}) {
    this.options = { ...options, baseUrl: trimRight(options.baseUrl, "/") };
    this.key = `sessionId:${options.workspaceId}`;
    this.tools = runtime.tools ?? [];
    this.sandbox = runtime.sandbox;
    this.disabled = runtime.disabled ?? (() => false);
    this.onDisabledRequest = runtime.onDisabledRequest;
    this.disabledModes = runtime.disabledModes ?? [];
    this.hooks = runtime.hooks;
    this.getSeedMessages = runtime.getSeedMessages;
    this.getSessionIdForHistory = runtime.getSessionId;
    this.onSessionReset = runtime.onSessionReset;
    this.historyManager = new HistoryManager({
      history: runtime.history ?? null,
      key: runtime.history ? (runtime.historyKey ?? this.key) : undefined,
    });
    this.steerChannel = new SteerChannel({
      openStream: (body, signal) => this.openChatStream(body, signal),
      readStream: (response, signal, onEvent) => this.readChatStream(response, signal, onEvent),
      uploadAttachments: (attachments, signal) => this.uploadAttachments(attachments, signal),
      getSessionId: () => this.conversationSessionId ?? this.sessionId,
      getAgentCode: () => this.options.agentCode,
      buildVariables: (extra) => this.buildStreamVariables(extra),
      beginTurn: (text, clientMessageId, submittedAt) => this.beginSteerState(text, clientMessageId, submittedAt),
      appendDelta: (state, delta) => this.appendDelta(state, delta),
      finishStream: (state, finalAnswer) => this.finishStream(state, finalAnswer),
      closeIter: (iter) => this.closeLLMIter(iter, true),
      finishTurn: (turn, status, error) => this.finishTurn(turn, status, error),
      notifyRunning: () => this.refreshRunningState(),
    });
    // 优先使用传入的 sessionId，其次从持久化 KV 读取。
    const initialSessionId = options.sessionId ?? kv.get<PersistedSession>(this.persistedSessionKey())?.sessionId;
    if (initialSessionId) {
      this._sessionId = initialSessionId;
      this.conversationSessionId = initialSessionId;
    }
  }

  /** 外部完成依赖绑定（如 sessionId getter）后调用，触发历史加载。 */
  start(): void {
    void this.ensureHistoryReady();
  }

  private persistedSessionKey(): string {
    return this.key;
  }

  private persistSession(): void {
    if (!this.sessionId) {
      kv.remove(this.persistedSessionKey());
      return;
    }
    kv.set<PersistedSession>(this.persistedSessionKey(), {
      sessionId: this.sessionId,
    });
  }

  /** 清空本地会话痕迹，下一轮重新走 POST /sessions。 */
  private resetSession(): void {
    const previousSessionId = this._sessionId;
    this._sessionId = undefined;
    this.sessionToken = undefined;
    this.channelUrl = undefined;
    this.sessionExpiresAt = undefined;
    this.conversationSessionId = undefined;
    kv.remove(this.persistedSessionKey());
    if (previousSessionId && this.onSessionReset) {
      try {
        const result = this.onSessionReset(previousSessionId);
        if (result && typeof result.then === "function") {
          result.catch((error) => console.warn("[WebSocketAgent] onSessionReset failed:", error));
        }
      } catch (error) {
        console.warn("[WebSocketAgent] onSessionReset failed:", error);
      }
    }
  }

  // ─── UI 依赖的公开面（对齐 HttpAgent） ──────────────────────────────────
  getMode(): AgentMode { return this.mode; }
  setMode(mode: AgentMode, reason?: string): void {
    if (this.disabledModes.includes(mode)) return;
    const previousMode = this.mode;
    this.mode = mode;
    if (previousMode !== mode) this.events.emit("mode:change", { mode, previousMode, reason });
  }
  getAvailableModes(): AgentMode[] {
    return ([AgentModeEnum.Build, AgentModeEnum.Plan] as AgentMode[]).filter((mode) => !this.disabledModes.includes(mode));
  }
  getTools(): Tool[] { return this.tools; }
  setTools(tools: Tool[]): void { this.tools = tools; }
  getToolUI(): ToolUIChannel { return this.toolUI; }
  getTurns(): TurnRecord[] { return this.turns; }
  getHistory(): BoundHistory | null { return this.historyManager.getBoundHistory(); }
  getCompactRecord(): CompactRecord | null { return null; }

  /**
   * 与 CodeAgent 对齐：读取本地 sandbox 的 .agent/plans/ 目录，返回当前 active 计划。
   * 未提供 sandbox 时返回 null（不阻塞 usePlanState 的调用）。
   */
  async getPlanFile(): Promise<ActivePlanFile | null> {
    if (!this.sandbox) return null;
    return getActivePlanFile(this.sandbox.getFiles.bind(this.sandbox));
  }

  /**
   * 与 CodeAgent 对齐：把指定计划文件的 frontmatter status 改为 abandoned。
   * 通过 sandbox.updateFiles 写回，未提供 sandbox 时静默忽略。
   */
  async abandonPlan(path: string, content: string): Promise<void> {
    if (!this.sandbox) return;
    const { fmText, body } = splitFrontmatter(content);
    if (!fmText) return;
    const newFmText = /^status\s*:/m.test(fmText)
      ? fmText.replace(/^(status\s*:).+$/m, "$1 abandoned")
      : `${fmText}\nstatus: abandoned`;
    const newContent = `---\n${newFmText}\n---\n${body}`;
    await this.sandbox.updateFiles([{ path, content: newContent }]);
  }
  getTurnsPage(): { hasMore: boolean; oldestTurnId: string | null } {
    return { hasMore: this.historyManager.getSnapshot().hasMore, oldestTurnId: this.turns[0]?.id ?? null };
  }
  async loadOlderTurns(limit = 20): Promise<{ turns: TurnRecord[]; hasMore: boolean }> {
    const before = this.turns[0]?.id;
    const page = await this.historyManager.loadTurns({ ...(before ? { before } : {}), limit });
    if (!page) return { turns: [], hasMore: false };
    const known = new Set(this.turns.map((turn) => turn.id));
    const older = page.turns.filter((turn) => !known.has(turn.id));
    this.turns.unshift(...older);
    this.historyManager.markReady({ hasMore: page.hasMore });
    return { turns: older, hasMore: page.hasMore };
  }
  getSessionState(): AgentRuntimeState { return this.state; }
  subscribeSessionState(listener: (state: AgentRuntimeState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private async ensureHistoryReady(): Promise<void> {
    try {
      const result = await this.historyManager.ensureLoaded();
      if (result) {
        const known = new Set(this.turns.map((turn) => turn.id));
        this.turns.unshift(...result.turns.filter((turn) => !known.has(turn.id)));
        this.historyManager.markReady();
      }
    } catch (error) {
      console.warn("[WebSocketAgent] history load failed:", error);
    }
  }

  /**
   * 首轮真实对话之前，向会话补齐旧数据上下文（必须在 ensureToolChannel 之后调用，此时 sessionId 已由服务端返回）：
   * 若本地已有 history（旧数据），把它拍平为一条 user 消息补进会话，让模型看到过往脉络。
   *
   * 动态配置消息（开发指南/环境信息）不再走追加消息端点，改为每轮 /chat/stream
   * 全程只跑一次，通过 KV 持久化标记与 conversationInit 单飞防并发。
   */
  /**
   * 旧数据同步已废弃：智能体会自动保存上下文，无需再向会话追加 seed 消息。
   */
  private ensureConversationInitialized(_historyTurns: TurnRecord[]): Promise<void> {
    return Promise.resolve();
  }

  // ─── 对话入口 ──────────────────────────────────────────────────────────
  async requestAI(params: WebSocketAgentRequestAIParams): Promise<void> {
    if (this.blockIfDisabled()) return;
    if (this.activeTurnId) throw new Error("A WebSocket Agent turn is already running");
    // 兼容单消息（message）与双消息（displayMessage/modelMessage）两种入参。
    const displayText = "message" in params && params.message !== undefined ? params.message : params.displayMessage;
    const modelText = "modelMessage" in params && params.modelMessage !== undefined ? params.modelMessage : displayText;
    const turnId = createId("turn");
    const turn: TurnRecord = {
      id: turnId,
      startTime: Date.now(),
      userText: displayText,
      // 记录发给模型的组装文本,供 retry 重发时使用(display 与 model 分离)
      ...(modelText !== displayText ? { userFormattedText: modelText } : {}),
      userAttachments: params.attachments ?? [],
      ...(params.meta ? { meta: params.meta } : {}),
      ...(params.extra ? { extra: params.extra } : {}),
      iterations: [],
      status: "success",
    };
    this.turns.push(turn);
    this.activeTurnId = turnId;
    // 新一轮开始：清空上一轮的成员/轮状态，避免"已完成"残留。
    this.teamStatus.clear();
    this.setMode(params.mode ?? AgentModeEnum.Build, "requestAI");

    await this.hooks?.beforeTurn?.({
      message: displayText,
      formattedMessage: modelText,
      attachments: params.attachments ?? [],
      meta: params.meta,
      extra: params.extra,
    });
    await this.hooks?.beforeRequest?.({ meta: params.meta, extra: params.extra });

    this.setState({ running: true, turnId, stage: { key: WEBSOCKET_AGENT_SESSION_STAGE.PREPARING } });
    this.events.emit("turn:start", {
      turnId,
      message: displayText,
      attachments: params.attachments,
      meta: params.meta,
      startTime: turn.startTime,
    });

    const abort = new AbortController();
    this.chatAbort = abort;
    const externalAbort = () => abort.abort();
    params.signal?.addEventListener("abort", externalAbort, { once: true });

    try {
      await this.ensureToolChannel();
      this.setState({ running: true, turnId, stage: { key: WEBSOCKET_AGENT_SESSION_STAGE.AWAITING_MODEL } });
      await this.consumeChatStream(turn, { message: modelText, attachments: params.attachments, variables: params.variables }, abort.signal);
    } catch (error) {
      if (abort.signal.aborted) {
        this.finishTurn(turn, "abort");
      } else {
        this.finishTurn(turn, "error", error);
        throw error;
      }
    } finally {
      params.signal?.removeEventListener("abort", externalAbort);
      this.chatAbort = undefined;
      if (this.activeTurnId === turn.id) this.activeTurnId = undefined;
      // 统一按"有轮在跑 / 有 steer 在途"计算运行态：任何异常路径都不能卡在 true，
      // 也不能在 steer 还没落位时提前放行本地队列。
      this.refreshRunningState();
    }
  }

  /** 按团队成员状态刷新阶段文案；全无记录时回到等待模型。 */
  private refreshTeamStage(): void {
    const entries = Array.from(this.teamStatus, ([member, status]) => ({ member, status }))
      .sort((a, b) => a.member.localeCompare(b.member)); // 稳定顺序，避免图标跳动
    this.state = {
      ...this.state,
      stage: entries.length
        ? { key: WEBSOCKET_AGENT_SESSION_STAGE.TEAM_RUNNING, meta: { members: entries } }
        : { key: WEBSOCKET_AGENT_SESSION_STAGE.AWAITING_MODEL },
    };
    for (const listener of this.stateListeners) listener(this.state);
  }

  /** 统一计算运行态：有轮在跑或有 steer 在途 → running；否则置空闲。 */
  private refreshRunningState(error?: unknown): void {
    const running = !!(this.activeTurnId || this.steerChannel.busy);
    const err = error !== undefined ? error : this.state.error;
    this.setState({ running, ...(err !== undefined ? { error: err } : {}) });
  }

  async retry(turnId: string): Promise<void> {
    if (this.blockIfDisabled()) return;
    const index = this.turns.findIndex((item) => item.id === turnId);
    if (index === -1) return;
    const [turn] = this.turns.splice(index, 1);
    // 历史还原的 turn 携带 userFormattedText(原始组装文本):展示用 userText,
    // 模型消息用组装文本,避免重发 [[chip:]] 占位符或把组装文本当展示文本。
    // meta.chips 需一并透传,重试重建的 turn 才能继续渲染占位符对应的 chip。
    await this.requestAI({
      ...(turn.userFormattedText && turn.userFormattedText !== turn.userText
        ? { displayMessage: turn.userText, modelMessage: turn.userFormattedText }
        : { message: turn.userText }),
      attachments: turn.userAttachments,
      ...(turn.meta ? { meta: turn.meta } : {}),
      mode: this.mode,
    });
  }

  async abort(): Promise<void> {
    this.chatAbort?.abort();
    // steer 是独立请求，不受 chatAbort 管辖，必须一起掐掉。
    this.steerChannel.abortAll();
    await this.stopRemoteGeneration();
  }

  /**
   * 轮中插话（平台原生 steer:true）：不打断当前轮，平台自行决定
   * 插进这一轮的下一个工具步骤（steer_delivered，正文在原请求的流上），
   * 还是滚成下一轮（steer_dropped，正文从本条 steer 流返回）。
   * 具体协议处理见 SteerChannel。
   */
  async steer(params: SteerParams): Promise<void> {
    await this.steerChannel.run(params);
  }

  async clearHistory(): Promise<void> {
    if (this.blockIfDisabled()) return;
    this.turns.splice(0, this.turns.length);
    // 关闭远程会话（用会话自身 token），再清空本地通道与缓存。
    void this.closeSession();
    this.socket?.close(1000);
    this.socket = null;
    this.socketReady = false;
    this.clearTimers();
    this.resetSession();
    await this.historyManager.clear();
  }

  deleteTurn(turnId: string): void {
    const index = this.turns.findIndex((item) => item.id === turnId);
    if (index !== -1) this.turns.splice(index, 1);
    void this.historyManager.update(turnId, { deleted: true } as Partial<TurnRecord>);
    this.events.emit("turn:delete", { turnId });
  }

  /**
   * 仅断开本地通道，不删除远程会话——会话与 seed 标记已持久化到 KV，
   * 刷新/重新挂载后可凭 wsUrl 直接恢复（会话有效期内）。
   * 如需彻底销毁会话请调用 clearHistory()。
   */
  dispose(): void {
    this.disposed = true;
    this.stopReconnect = true;
    this.clearTimers();
    this.socket?.close(1000);
    this.socket = null;
    this.socketReady = false;
  }
  // ─── SSE 对话流 ────────────────────────────────────────────────────────
  /** 组装 /chat/stream 的业务变量：合并配置的 projectId/appType；无 agentCode 时不发送。 */
  private buildStreamVariables(extra?: Record<string, any>): Record<string, any> | undefined {
    const variables: Record<string, any> = { ...(extra ?? {}) };
    if (this.options.projectId !== undefined) variables.projectId = this.options.projectId;
    if (this.options.appType !== undefined) variables.appType = this.options.appType;
    return Object.keys(variables).length > 0 && this.options.agentCode ? variables : undefined;
  }

  private async consumeChatStream(
    turn: TurnRecord,
    params: { message: string; attachments?: any[]; variables?: Record<string, any> },
    signal: AbortSignal,
  ): Promise<void> {
    // 上传附件到会话文件接口（平台智能体会自动查询，不需要在 stream body 里再传）
    const fileResults = await this.uploadAttachments(params.attachments ?? [], signal);
    const fileNames = fileResults ? [...fileResults.keys()] : [];

    // variables 需在智能体 businessVariables 声明集内，且携带时 agentCode 必填。
    const response = await this.openChatStream(
      {
        message: params.message,
        agentCode: this.options.agentCode,
        sessionId: this.conversationSessionId,
        variables: this.buildStreamVariables(params.variables),
        ...(fileNames.length > 0 ? { attachments: fileNames } : {}),
      },
      signal,
    );

    // 远程平台整轮只走一条 SSE，正文与工具交替到达：工具执行后正文重新出现
    // 视为新一轮 LLM 输出，届时切新 iter（见 applyChatEvent 的 delta 分支），
    // 保证渲染层按时间顺序交错展示正文与工具（对齐本地 CodeAgent 每 step 一个 iter）。
    const state: ChatStreamState = { turn, iter: this.startLLMIter(turn), segment: "", answer: "" };
    const terminal = await this.readChatStream(response, signal, (event) => this.applyChatEvent(state, event));
    if (!terminal) {
      if (signal.aborted) return; // 被 abort，交由上层 finishTurn(abort)
      throw new Error("Chat stream closed before a terminal event");
    }
  }

  /**
   * 构建鉴权 headers：token 必传，以 "token" header 发送；
   * 支持传函数按请求实时取值。session 可选，存在时一并发送。
   */
  private buildAuthHeaders(): Record<string, string> {
    const token = resolveAuthValue(this.options.token);
    const session = resolveAuthValue(this.options.session);
    return { ...(token ? { token } : {}), ...(session ? { session } : {}) };
  }

  /**
   * wsUrl 追加 authToken/authSession 鉴权参数（网关在 WebSocket 握手阶段校验）。
   * 原有查询参数（服务端内嵌的 sessionId/token 等）保持不动；
   * 支持函数实时取值；URL 解析失败时退化为手动拼接。
   */
  private buildChannelUrl(): string {
    const base = this.channelUrl!;
    const token = resolveAuthValue(this.options.token);
    const session = resolveAuthValue(this.options.session);
    if (!token && !session) return base;
    try {
      const url = new URL(base);
      if (token) url.searchParams.set("authToken", token);
      if (session) url.searchParams.set("authSession", session);
      return url.toString();
    } catch {
      const params = [
        token ? `authToken=${encodeURIComponent(token)}` : "",
        session ? `authSession=${encodeURIComponent(session)}` : "",
      ].filter(Boolean).join("&");
      return base.includes("?") ? `${base}&${params}` : `${base}?${params}`;
    }
  }

  /** 发起一次 /chat/stream 请求，返回响应（body 交由调用方读取）。 */
  private async openChatStream(
    body: {
      message: string;
      agentCode?: string;
      sessionId?: string;
      variables?: Record<string, any>;
      /** 轮中插话：插进正在运行的那一轮的下一个工具步骤（平台原生能力）。 */
      steer?: boolean;
      attachments?: string[]
    },
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/chat/stream`, {
      method: "POST",
      signal,
      headers: {
        ...this.buildAuthHeaders(),
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: body.message,
        ...(body.agentCode ? { agentCode: body.agentCode } : {}),
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.steer ? { steer: true } : {}),
        ...(body.attachments ? { attachments: body.attachments } : {}),
      }),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Chat stream failed: ${response.status} ${response.statusText}`);
    }
    return response;
  }

  /**
   * 上传附件到会话文件接口（multipart/form-data）。
   * 平台智能体会自行查询该 session 下的文件，因此上传后无需在 stream body 里再引用。
   * 单个附件失败不阻塞对话：记录 warn 后继续处理下一个。
   *
   * 支持两类来源（见 attachment 结构）：
   *   - content：完整 data URI（data:image/png;base64,....）
   *   - url：远程地址，先 fetch 下载为 Blob 再上传（客户端代下）
   */
  private async uploadAttachments(attachments: any[], signal: AbortSignal): Promise<Map<string, any> | null> {
    const sessionId = this.conversationSessionId ?? this.sessionId;
    if (!sessionId || !attachments.length) return null;
    // 只处理图片类附件；agentCode 是上传接口的必填项，缺失则跳过上传。
    const agentCode = this.options.agentCode;
    if (!agentCode) {
      console.warn("[WebSocketAgent] skip attachment upload: agentCode is required by the files API");
      return null;
    }

    const fileResults = new Map<string, any>();
    for (let i = 0; i < attachments.length; i += 1) {
      const item = attachments[i];
      const isImage = item?.type === "image" || item?.mime?.startsWith?.("image/");
      if (!isImage) continue;
      try {
        const { blob, filename } = await this.attachmentToBlob(item, i, signal);
        const form = new FormData();
        form.append("file", blob, filename);
        form.append("agentCode", agentCode);
        const response = await fetch(
          `${this.options.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/files`,
          {
            method: "POST",
            signal,
            headers: this.buildAuthHeaders(),
            body: form,
          },
        );
        if (!response.ok) {
          console.warn(`[WebSocketAgent] attachment upload failed: ${response.status} ${response.statusText}`);
          continue;
        }
        const result = await response.json().catch(() => null);
        const name = result?.file?.name
        if (name) {
          fileResults.set(name, result.file);
        }
        if (result?.agentVisible === false) {
          console.warn("[WebSocketAgent] uploaded file not visible to agent:", result?.warnings);
        }
      } catch (error) {
        if (signal.aborted) throw error; // 用户主动中止，向上抛
        console.warn("[WebSocketAgent] attachment upload error, skipped:", error);
      }
    }
    return fileResults;
  }

  /** 把一个附件（data URI 或 url）转成用于上传的 Blob 及文件名。 */
  private async attachmentToBlob(
    item: any,
    index: number,
    signal: AbortSignal,
  ): Promise<{ blob: Blob; filename: string }> {
    if (typeof item?.content === "string" && item.content.startsWith("data:")) {
      const blob = dataUriToBlob(item.content);
      const ext = blob.type.split("/")[1] || "png";
      return { blob, filename: item.name ?? `attachment-${index}.${ext}` };
    }
    if (typeof item?.url === "string" && item.url) {
      // A 方案：客户端代下远程资源，再作为文件上传。
      const res = await fetch(item.url, { signal });
      if (!res.ok) throw new Error(`fetch attachment url failed: ${res.status}`);
      const blob = await res.blob();
      const urlName = item.url.split("/").pop()?.split("?")[0];
      const ext = blob.type.split("/")[1] || "png";
      return { blob, filename: item.name ?? urlName ?? `attachment-${index}.${ext}` };
    }
    throw new Error("attachment has neither data-uri content nor url");
  }

  /**
   * 逐帧读取 SSE 流，交给 onEvent 处理；onEvent 返回 true 表示遇到终止事件。
   * 返回是否读到终止事件。
   */
  private async readChatStream(
    response: Response,
    signal: AbortSignal,
    onEvent: (event: ChatEvent) => boolean,
  ): Promise<boolean> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal = false;
    try {
      while (!terminal) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const parsed = parseSseEvent(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (parsed) {
            if (onEvent(parsed)) { terminal = true; break; }
          }
          boundary = buffer.indexOf("\n\n");
        }
        if (chunk.done) break;
      }
    } finally {
      try { await reader.cancel(); } catch { /* ignore */ }
    }
    void signal;
    return terminal;
  }

  private applyChatEvent(state: ChatStreamState, event: ChatEvent): boolean {
    switch (event.name) {
      case "meta":
        // seed 阶段已确定 sessionId；这里只做对齐（平台理论上应回传同一个 id）。
        if (event.data?.sessionId && this.conversationSessionId !== event.data.sessionId) {
          console.warn(
            "[WebSocketAgent] server returned a different sessionId, adopting it:",
            event.data.sessionId,
          );
          this.conversationSessionId = event.data.sessionId;
          this.persistSession();
        }
        return false;
      case "delta":
        this.appendDelta(state, typeof event.data === "string" ? event.data : String(event.data ?? ""));
        return false;
      case "tool_start":
        this.onRemoteToolStart(state.iter, event.data ?? {});
        return false;
      case "tool_result":
        this.onRemoteToolResult(event.data ?? {});
        return false;
      case "steer_delivered": {
        // 插话已进入当前轮：暂停当前回复框，后续 delta 另起一条 turn（独立气泡 + 回复框）。
        const previousTurn = state.turn;
        const previousIter = state.iter;
        const clientMessageId = this.steerChannel.takeClientId(event.data?.inboxId);
        const next = this.beginSteerState(String(event.data?.text ?? ""), clientMessageId);
        state.turn = next.turn;
        state.iter = next.iter;
        state.segment = "";
        state.answer = "";
        this.sealTurn(previousTurn, previousIter);
        return false;
      }
      case "steer_dropped": {
        // 插话没赶上工具步骤，已被平台滚成下一轮；本轮不受影响，正文继续走本条流。
        // 该插话不会再走 delivered，顺带清掉它的 inboxId 映射，避免累积。
        this.steerChannel.forget(event.data?.inboxId);
        return false;
      }
      case "done":
        this.finishStream(state, event.data?.answer);
        return true;
      case "stopped":
        state.iter.endTime = Date.now();
        this.finishTurn(state.turn, "abort");
        return true;
      case "error":
        throw new Error(String(event.data?.message ?? event.data ?? "Remote agent error"));
      case "team_round_update": {
        const { member, status } = event.data ?? {};
        if (typeof member === "string" && member && typeof status === "string") {
          if (status === "RUNNING" || status === "DONE" || status === "FAILED") {
            this.teamStatus.set(member, status);
            this.refreshTeamStage();
          }
        }
        return false;
      }
      case "team_member_state": {
        const { member, status } = event.data ?? {};
        // 成员开始干活 → 执行中；IDLE（或退出）时直接从展示中移除，不再显示该成员。
        if (typeof member === "string" && member) {
          if (status === "RUNNING") this.teamStatus.set(member, "RUNNING");
          else this.teamStatus.delete(member);
          this.refreshTeamStage();
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** 为插话创建独立的一轮（独立气泡 + 回复框）；push 进 turns 供 UI 重新对齐时识别为 pending。 */
  private createSteerTurn(text: string, clientMessageId?: string, submittedAt?: number): TurnRecord {
    const turn: TurnRecord = {
      id: createId("turn"),
      // 沿用用户提交时刻（占位上屏时间），保证时间线/排序与提交顺序一致。
      startTime: submittedAt ?? Date.now(),
      userText: text,
      userAttachments: [],
      iterations: [],
      status: "success",
      ...(clientMessageId ? { clientMessageId } : {}),
    };
    this.turns.push(turn);
    this.activeTurnId = turn.id;
    this.events.emit("turn:start", {
      turnId: turn.id,
      message: text,
      startTime: turn.startTime,
      ...(clientMessageId ? { clientMessageId } : {}),
    });
    return turn;
  }

  /** 建立插话轮并开好首个 iter，返回完整的流式状态（广播 turn:start / llm:start）。 */
  private beginSteerState(text: string, clientMessageId?: string, submittedAt?: number): ChatStreamState {
    const turn = this.createSteerTurn(text, clientMessageId, submittedAt);
    const iter = this.startLLMIter(turn);
    this.setState({ running: true, turnId: turn.id });
    return { turn, iter, segment: "", answer: "" };
  }

  /** 追加正文片段：当前 iter 已含工具调用时视为新的 LLM 输出，另起一段。 */
  private appendDelta(state: ChatStreamState, delta: string): void {
    if (state.iter.toolCalls.length > 0) {
      this.closeLLMIter(state.iter);
      state.iter = this.startLLMIter(state.turn);
      state.segment = "";
    }
    state.segment += delta;
    state.answer += delta;
    state.iter.content = state.segment;
    this.events.emit("llm:content", { delta, content: state.segment, step: 1, iterId: state.iter.iterId });
  }

  /** 收尾一次流：无 delta 时用 done.answer 兜底正文，关闭 iter 并结束 turn。 */
  private finishStream(state: ChatStreamState, finalAnswer?: unknown): void {
    if (!state.answer && typeof finalAnswer === "string" && finalAnswer) {
      state.iter.content = finalAnswer;
      this.events.emit("llm:content", { delta: finalAnswer, content: finalAnswer, step: 1, iterId: state.iter.iterId });
    }
    this.closeLLMIter(state.iter, true);
    this.finishTurn(state.turn, "success");
  }

  /**
   * 封口一个已完成的 turn：写结束态、落库、关闭 iter。
   * closeLLMIter(done=true) 会让 UI 从 agent.turns 重新对齐，
   * 因此调用前要确保"接管的 turn"已经就位。
   */
  private sealTurn(turn: TurnRecord, iter: LLMIter): void {
    turn.status = "success";
    turn.endTime = Date.now();
    void this.persistTurn(turn);
    this.closeLLMIter(iter, true);
  }

  /** 新开一个 LLM 迭代并广播 llm:start（对齐本地 CodeAgent 每 step 一个 iter 的结构）。 */
  private startLLMIter(turn: TurnRecord): LLMIter {
    const iter: LLMIter = { iterId: createId("iter"), content: "", toolCalls: [], startTime: Date.now(), mode: this.mode };
    turn.iterations.push(iter);
    this.events.emit("llm:start", { step: 1, startTime: iter.startTime, iterId: iter.iterId });
    return iter;
  }

  /** 关闭一个 LLM 迭代；done=true 表示整轮最后一个 iter。 */
  private closeLLMIter(iter: LLMIter, done = false): void {
    iter.endTime = Date.now();
    this.events.emit("llm:complete", { step: 1, finishReason: "stop", done, endTime: iter.endTime, iterId: iter.iterId });
  }

  /** 远程侧已执行的工具（如 manatee-connector）：只做进度展示。 */
  private onRemoteToolStart(iter: LLMIter, data: any): void {
    if (!data.callId) return;
    // 跨 iter 全局去重：WS TOOL_CALL（executeTool）可能先注册同一 callId。
    if (this.toolIterMap.has(data.callId)) return;
    const startTime = Date.now();
    iter.toolCalls.push({
      callId: data.callId,
      name: data.name ?? "",
      args: parseArgs(data.arguments),
      status: "pending",
      execStartTime: startTime,
      execEndTime: 0,
    });
    this.toolIterMap.set(data.callId, iter);
    this.events.emit("tool:call", {
      callId: data.callId,
      name: data.name ?? "",
      args: parseArgs(data.arguments),
      step: 1,
      startTime,
      iterId: iter.iterId,
    });
  }

  private onRemoteToolResult(data: any): void {
    if (!data.callId) return;
    // 结果可能晚于 iter 切换到达，按 callId 找回承载它的 iter。
    const iter = this.toolIterMap.get(data.callId);
    if (!iter) return;
    const call = iter.toolCalls.find((item) => item.callId === data.callId);
    const endTime = Date.now();
    if (data.success === false) {
      if (call) { call.status = "error"; call.error = String(data.result ?? ""); call.execEndTime = endTime; }
      this.events.emit("tool:error", { callId: data.callId, name: data.name ?? "", error: String(data.result ?? ""), step: 1, endTime, iterId: iter.iterId });
    } else {
      const result = { output: String(data.result ?? "") };
      if (call) { call.status = "success"; call.result = result; call.execEndTime = endTime; }
      this.events.emit("tool:result", { callId: data.callId, name: data.name ?? "", result, step: 1, endTime, iterId: iter.iterId });
    }
  }
  // ─── WebSocket 工具通道 ────────────────────────────────────────────────
  private async ensureToolChannel(): Promise<void> {
    if (this.socketReady && this.socket?.readyState === WebSocket.OPEN) return;
    if (this.socketPromise) return this.socketPromise;
    this.stopReconnect = false;
    this.socketPromise = new Promise<void>((resolve, reject) => {
      void this.openToolChannel(resolve, reject);
    });
    try {
      await this.socketPromise;
    } finally {
      this.socketPromise = null;
    }
  }

  private async openToolChannel(resolve: () => void, reject: (error: Error) => void): Promise<void> {
    try {
      if (!this._sessionId) {
        const response = await fetch(`${this.options.baseUrl}/api/v1/sessions`, {
          method: "POST",
          headers: { ...this.buildAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            clientType: this.options.clientType,
            meta: { workspaceId: this.options.workspaceId, ...(this.options.meta ?? {}) },
          }),
        });
        if (!response.ok) throw new Error(`MCP session creation failed: ${response.status} ${response.statusText}`);
        const session = await response.json();
        if (!session?.wsUrl || !session?.sessionId) {
          throw new Error("MCP session response missing sessionId/wsUrl");
        }
        // 直接采用服务端返回的 sessionId 与 wsUrl（wsUrl 已内嵌 sessionId 与 token）。
        this._sessionId = session.sessionId as string;
        this.sessionToken = session.token as string | undefined;
        this.channelUrl = session.wsUrl as string;
        this.sessionExpiresAt = parseExpiresAt(session.expiresAt);
        this.conversationSessionId = this.conversationSessionId ?? session.sessionId;
        if (Number(session.heartbeatIntervalMs) > 0) this.heartbeatIntervalMs = Number(session.heartbeatIntervalMs);
        this.persistSession();
      } else if (!this.channelUrl || isExpired(this.sessionExpiresAt)) {
        // 复用传入或缓存的 sessionId，通过 sessions 接口获取 wsUrl 等连接信息。
        const response = await fetch(`${this.options.baseUrl}/api/v1/sessions`, {
          method: "POST",
          headers: { ...this.buildAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this._sessionId,
            clientType: this.options.clientType ?? "mybricks-designer",
            meta: { workspaceId: this.options.workspaceId, ...(this.options.meta ?? {}) },
          }),
        });
        if (!response.ok) throw new Error(`MCP session creation failed: ${response.status} ${response.statusText}`);
        const session = await response.json();
        if (!session?.wsUrl || !session?.sessionId) {
          throw new Error("MCP session response missing sessionId/wsUrl");
        }
        this.sessionToken = session.token as string | undefined;
        this.channelUrl = session.wsUrl as string;
        this.sessionExpiresAt = parseExpiresAt(session.expiresAt);
        this.conversationSessionId = this.conversationSessionId ?? session.sessionId;
        if (Number(session.heartbeatIntervalMs) > 0) this.heartbeatIntervalMs = Number(session.heartbeatIntervalMs);
      }
      const url = this.channelUrl;
      if (!url) throw new Error("Missing channel url");
      const socket = new WebSocket(this.buildChannelUrl());
      this.socket = socket;
      // 仅在收到 WELCOME 后才 resolve，避免与 socketReady 竞态导致重复建连被 4001 顶替。
      socket.onopen = () => { /* 等待 WELCOME */ };
      socket.onmessage = (message) => this.handleWsMessage(message.data, resolve);
      socket.onerror = () => { reject(new Error("Tool WebSocket connection failed")); };
      socket.onclose = (event) => this.handleWsClose(event.code);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleWsMessage(raw: any, onWelcome?: () => void): void {
    let message: WsEnvelope;
    try { message = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return; }
    switch (message.type) {
      case "WELCOME": {
        this.socketReady = true;
        this.reconnectAttempts = 0;
        const interval = Number(message.payload?.heartbeatIntervalMs);
        if (interval > 0) this.heartbeatIntervalMs = interval;
        this.startHeartbeat();
        onWelcome?.();
        break;
      }
      case "PONG":
        this.armPongTimeout();
        break;
      case "TOOL_CALL":
        this.armPongTimeout();
        void this.executeTool(message);
        break;
      case "ERROR":
        console.warn("[WebSocketAgent] channel ERROR:", message.payload ?? message);
        break;
      case "REPLACED":
        this.stopReconnect = true;
        break;
      default:
        break;
    }
  }

  private handleWsClose(code: number): void {
    this.socketReady = false;
    this.socket = null;
    this.clearTimers();
    if (this.disposed || this.stopReconnect) return;
    if (code === 4001) return; // 被同会话新连接顶替，不重连
    if (code === 4003) { this.resetSession(); return; } // 会话终结：清空会话与 seed 标记，下轮重建
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts += 1;
    setTimeout(() => {
      if (this.disposed || this.stopReconnect) return;
      this.socketPromise = new Promise<void>((resolve, reject) => { void this.openToolChannel(resolve, reject); });
      this.socketPromise.catch(() => { /* 交由下一次 close 继续退避 */ }).finally(() => { this.socketPromise = null; });
    }, delay);
  }

  private startHeartbeat(): void {
    this.clearTimers();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ v: 1, type: "PING", ts: Date.now() }));
        this.armPongTimeout();
      }
    }, this.heartbeatIntervalMs);
  }

  /** 连续 2 个心跳周期无入站消息则主动断开触发重连。 */
  private armPongTimeout(): void {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      if (!this.disposed) this.socket?.close(4002);
    }, this.heartbeatIntervalMs * 2);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.pongTimer) { clearTimeout(this.pongTimer); this.pongTimer = null; }
  }

  // ─── 工具执行（落到本地 sandbox） ──────────────────────────────────────
  private async executeTool(message: WsEnvelope): Promise<void> {
    const requestId = message.requestId ?? "";
    const payload = message.payload ?? {};
    const cached = this.toolResults.get(requestId);
    if (cached) { this.sendToolResult(requestId, cached); return; }

    const iter = this.toolIterMap.get(requestId) ?? this.currentIter();
    const startTime = Date.now();
    let result: ToolResult;
    let toolRecord: ToolCallRecord | undefined;
    try {
      const tool = this.tools.find((item) => item.name === payload.toolName);
      const turn = this.turns.find((item) => item.id === this.activeTurnId);
      if (!tool) throw new Error(`Tool not found: ${payload.toolName}`);
      if (!turn || !iter) {
        console.warn(`[WebSocketAgent] TOOL_CALL ${requestId} arrived after turn ended, executing without UI binding`);
      }

      if (iter) {
        toolRecord = {
          callId: requestId,
          name: payload.toolName,
          args: payload.arguments ?? {},
          status: "pending",
          execStartTime: startTime,
          execEndTime: 0,
        };
        iter.toolCalls.push(toolRecord);
        this.toolIterMap.set(requestId, iter);
      }
      this.events.emit("tool:call", { callId: requestId, name: payload.toolName, args: payload.arguments ?? {}, step: 1, startTime, iterId: iter?.iterId ?? "" });

      const context: ToolExecutionContext = {
        turnId: turn?.id ?? "unknown",
        callId: requestId,
        signal: this.chatAbort?.signal ?? new AbortController().signal,
        iterations: turn?.iterations ?? [],
        getUserMessage: () => ({ message: turn?.userText ?? "", attachments: turn?.userAttachments ?? [] }),
        getAgent: () => this as any,
        mode: this.mode,
        getMode: () => this.mode,
        setMode: (mode: AgentMode, reason?: string) => this.setMode(mode, reason),
        emitProgress: (data: any) => this.events.emit("tool:progress", { callId: requestId, name: payload.toolName, data, step: 1, iterId: iter?.iterId ?? "" }),
        waitUIRender: <T>() => this.toolUI.wait<T>(requestId, {}),
      };
      tool.validate?.(payload.arguments ?? {}, context);
      const output = await tool.execute(payload.arguments ?? {}, context);
      result = { ok: true, result: { output: output.output, metadata: output.metadata } };
      if (toolRecord) {
        toolRecord.status = "success";
        toolRecord.result = { output: output.output, metadata: output.metadata };
        toolRecord.execEndTime = Date.now();
      }
      this.events.emit("tool:result", { callId: requestId, name: payload.toolName, result: result.result, step: 1, endTime: Date.now(), iterId: iter?.iterId ?? "" });
    } catch (error) {
      const messageText = String((error as any)?.message ?? error);
      result = { ok: false, error: { code: "TOOL_EXECUTION_FAILED", message: messageText } };
      if (toolRecord) { toolRecord.status = "error"; toolRecord.error = messageText; toolRecord.execEndTime = Date.now(); }
      if (iter) this.events.emit("tool:error", { callId: requestId, name: payload.toolName, error: messageText, step: 1, endTime: Date.now(), iterId: iter.iterId });
    }
    this.toolResults.set(requestId, result);
    this.sendToolResult(requestId, result);
  }

  private currentIter(): LLMIter | undefined {
    const turn = this.turns.find((item) => item.id === this.activeTurnId);
    if (!turn) return undefined;
    for (let i = turn.iterations.length - 1; i >= 0; i -= 1) {
      const iter = turn.iterations[i];
      if (!("type" in iter)) return iter as LLMIter;
    }
    return undefined;
  }

  private sendToolResult(requestId: string, payload: ToolResult): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ v: 1, type: "TOOL_RESULT", requestId, ts: Date.now(), payload }));
    }
  }

  /** 通知平台停止本轮生成（SESSION_BUSY 场景亦用此端点）。 */
  private async stopRemoteGeneration(): Promise<void> {
    if (!this.conversationSessionId) return;
    try {
      await fetch(`${this.options.baseUrl}/api/v1/chat/stop`, {
        method: "POST",
        headers: { ...this.buildAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.conversationSessionId }),
      });
    } catch (error) {
      console.warn("[WebSocketAgent] stop generation failed:", error);
    }
  }

  /**
   * 主动关闭 MCP 会话。鉴权必须使用该会话自己的 token（创建会话时返回），
   * 用 apiKey 会得到 401。调用后通道以 4003 断开、token 作废。
   */
  private async closeSession(): Promise<void> {
    const sessionId = this.sessionId;
    const token = this.sessionToken;
    if (!sessionId || !token) return;
    try {
      await fetch(`${this.options.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* best-effort */ }
  }

  private finishTurn(turn: TurnRecord, status: "success" | "abort" | "error", error?: any): void {
    if (turn.endTime) return;
    turn.status = status;
    turn.endTime = Date.now();
    if (error) turn.error = String((error as any)?.message ?? error);
    // 插话轮（steer 流 / delivered 后新开的一轮）也会设置 activeTurnId，必须在这里释放，
    // 否则下一次正常发送会被 requestAI 的互斥守卫拦下（"turn is already running"）。
    if (this.activeTurnId === turn.id) this.activeTurnId = undefined;
    this.toolResults.clear();
    // 延迟清理 toolIterMap：给迟到的 TOOL_CALL 一个短暂窗口，避免竞争条件导致找不到 iter
    const iterMap = this.toolIterMap;
    setTimeout(() => { iterMap.clear(); }, 5000);
    void this.persistTurn(turn);
    // 运行态统一由 refreshRunningState 计算：steer 在途时即使本轮结束也不能置空闲，
    // 否则本地队列会立刻 drain，把后面的消息插到插话前面。
    this.refreshRunningState(error ? error : undefined);
    if (status === "success") this.events.emit("turn:complete", {});
    else if (status === "abort") this.events.emit("turn:abort", {});
    else this.events.emit("turn:error", { error });
    void this.hooks?.afterTurn?.(turn);
  }

  private async persistTurn(turn: TurnRecord): Promise<void> {
    if (!this.historyManager.hasStorage()) return;
    try { await this.historyManager.append(turn); }
    catch (error) { console.warn("[WebSocketAgent] persist turn failed:", error); }
  }

  private blockIfDisabled(): boolean {
    if (!this.disabled()) return false;
    this.onDisabledRequest?.();
    return true;
  }

  private setState(state: AgentRuntimeState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }
}

function parseSseEvent(raw: string): ChatEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(":")) continue; // 忽略 SSE 注释行（如心跳 : ping）
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5));
  }
  if (!data.length) return null;
  const text = data.join("\n");
  try { return { name, data: JSON.parse(text) }; }
  catch { return { name, data: text }; }
}

function parseArgs(value: any): any {
  if (typeof value !== "string") return value ?? {};
  try { return JSON.parse(value); }
  catch { return { _argsRaw: value }; }
}

/** 把 data URI（data:image/png;base64,....）解码成 Blob。 */
function dataUriToBlob(dataUri: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUri);
  if (!match) throw new Error("invalid data URI");
  const mime = match[1] || "application/octet-stream";
  const isBase64 = !!match[2];
  const data = match[3] ?? "";
  if (isBase64) {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(data)], { type: mime });
}

function trimRight(value: string, char: string): string {
  let result = value;
  while (result.endsWith(char)) result = result.slice(0, -char.length);
  return result;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 解析 expiresAt（ISO 字符串），失败返回 undefined 表示不做过期判断。 */
function parseExpiresAt(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

/** 留 60s 余量，避免边界时刻拿着即将失效的会话去建连。 */
function isExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - 60_000;
}

export function isWebSocketAgent(agent: unknown): agent is WebSocketAgent {
  return !!agent && typeof agent === "object" && (agent as any).kind === "websocket";
}
