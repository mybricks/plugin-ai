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

export interface WebSocketAgentOptions {
  /** MCP Server 地址，例如 http://112.17.139.222:8106 */
  baseUrl: string;
  /** 智能体平台鉴权 token（Bearer），用于 /chat/stream。 */
  apiKey: string;
  /** 工作空间 ID，写入会话 meta 供审计。 */
  workspaceId: string;
  /** 目标智能体 code；留空走默认智能体。 */
  agentCode?: string;
  /** 业务变量：项目 ID，随 /chat/stream 的 variables 发送。 */
  projectId?: string | number;
  /** 业务变量：用户 ID，随 /chat/stream 的 variables 发送。 */
  userId?: string | number;
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
type LLMIter = {
  iterId: string;
  content: string;
  toolCalls: ToolCallRecord[];
  startTime: number;
  endTime?: number;
  mode?: AgentMode;
};

interface PersistedSession {
  /** POST /api/v1/sessions 返回的会话 ID（sess_ 前缀），同时用作对话 sessionId。 */
  sessionId: string;
  /** 会话 JWT，用于 DELETE /sessions/{id}（wsUrl 里已内嵌一份）。 */
  token?: string;
  /** 服务端拼好的 WebSocket 通道地址，刷新后直接复用。 */
  wsUrl: string;
  /** 会话绝对到期时间（ms epoch），过期后不再复用缓存。 */
  expiresAt?: number;
  /** 平台实际采用的对话 sessionId（一般与 sessionId 相同）。 */
  conversationSessionId?: string;
  /** 旧 history 是否已同步到该会话。 */
  legacySynced: boolean;
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
  private socket: WebSocket | null = null;
  private socketPromise: Promise<void> | null = null;
  private socketReady = false;
  /** 服务端返回的 WebSocket 通道地址（已内嵌 sessionId 与 token）。 */
  private channelUrl?: string;
  /** POST /sessions 返回的会话 ID（sess_ 前缀）。 */
  private sessionId?: string;
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
  /** 旧 history 是否已同步到远程会话（兼容旧数据）。 */
  private legacySynced = false;
  /** 兼容同步只跑一次的守卫，避免并发首轮重复注入。 */
  private conversationInit?: Promise<void>;
  private activeTurnId?: string;
  private chatAbort?: AbortController;
  private state: AgentRuntimeState = { running: false };

  constructor(options: WebSocketAgentOptions, runtime: WebSocketAgentRuntimeOptions = {}) {
    this.options = { ...options, baseUrl: trimRight(options.baseUrl, "/") };
    this.key = `websocket:${options.baseUrl}:${options.workspaceId}:${options.agentCode ?? "default"}`;
    this.tools = runtime.tools ?? [];
    this.sandbox = runtime.sandbox;
    this.disabled = runtime.disabled ?? (() => false);
    this.onDisabledRequest = runtime.onDisabledRequest;
    this.disabledModes = runtime.disabledModes ?? [];
    this.hooks = runtime.hooks;
    this.getSeedMessages = runtime.getSeedMessages;
    this.historyManager = new HistoryManager({
      history: runtime.history ?? null,
      key: runtime.history ? (runtime.historyKey ?? this.key) : undefined,
    });
    // 从持久化 KV 恢复会话：未过期时直接复用 sessionId / wsUrl，避免刷新页面重建会话。
    const persisted = kv.get<PersistedSession>(this.persistedSessionKey());
    if (persisted?.sessionId && persisted.wsUrl && !isExpired(persisted.expiresAt)) {
      this.sessionId = persisted.sessionId;
      this.sessionToken = persisted.token;
      this.channelUrl = persisted.wsUrl;
      this.sessionExpiresAt = persisted.expiresAt;
      this.conversationSessionId = persisted.conversationSessionId ?? persisted.sessionId;
      this.legacySynced = !!persisted.legacySynced;
    } else if (persisted) {
      kv.remove(this.persistedSessionKey());
    }
    void this.ensureHistoryReady();
  }

  private persistedSessionKey(): string {
    return `@plugin-ai/websocket-session:${this.key}`;
  }

  private persistSession(): void {
    if (!this.sessionId || !this.channelUrl) {
      kv.remove(this.persistedSessionKey());
      return;
    }
    kv.set<PersistedSession>(this.persistedSessionKey(), {
      sessionId: this.sessionId,
      ...(this.sessionToken ? { token: this.sessionToken } : {}),
      wsUrl: this.channelUrl,
      ...(this.sessionExpiresAt ? { expiresAt: this.sessionExpiresAt } : {}),
      ...(this.conversationSessionId ? { conversationSessionId: this.conversationSessionId } : {}),
      legacySynced: this.legacySynced,
    });
  }

  /** 清空本地会话痕迹，下一轮重新走 POST /sessions。 */
  private resetSession(): void {
    this.sessionId = undefined;
    this.sessionToken = undefined;
    this.channelUrl = undefined;
    this.sessionExpiresAt = undefined;
    this.conversationSessionId = undefined;
    this.legacySynced = false;
    kv.remove(this.persistedSessionKey());
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
   * 经 variables.extra_prompt 传递（见 consumeChatStream）。
   * 全程只跑一次，通过 KV 持久化标记与 conversationInit 单飞防并发。
   */
  private ensureConversationInitialized(historyTurns: TurnRecord[]): Promise<void> {
    if (this.legacySynced) return Promise.resolve();
    if (this.conversationInit) return this.conversationInit;

    this.conversationInit = (async () => {
      const sessionId = this.conversationSessionId ?? this.sessionId;
      if (!sessionId) throw new Error("Cannot sync history without a sessionId");
      // 兼容旧数据：本地 history 里已有轮次时，压成一条 user 背景注入（不含当前正要发送的消息）。
      const legacy = summarizeHistoryForSeed(historyTurns);
      this.legacySynced = true;
      this.persistSession();
      if (!legacy) return;
      await this.appendConversationMessages(sessionId, [{ role: "user", content: legacy }]);
    })();
    void this.conversationInit.catch((error) => {
      console.warn("[WebSocketAgent] ensureConversationInitialized failed:", error);
    }).finally(() => {
      this.conversationInit = undefined;
    });
    return this.conversationInit;
  }

  private async appendConversationMessages(
    sessionId: string,
    messages: Array<{ role: "user" | "tool"; content: string; callId?: string }>,
  ): Promise<void> {
    if (!messages.length) return;
    try {
      const response = await fetch(
        `${this.options.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages }),
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`append messages failed: ${response.status} ${response.statusText} ${text}`);
      }
    } catch (error) {
      // 同步失败回滚标记：下次刷新时 legacySynced 重置以便重试。
      this.legacySynced = false;
      this.persistSession();
      throw error;
    }
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
      userAttachments: params.attachments ?? [],
      ...(params.meta ? { meta: params.meta } : {}),
      ...(params.extra ? { extra: params.extra } : {}),
      iterations: [],
      status: "success",
    };
    // 快照 push 前的 turns，作为兼容旧数据的 seed 素材：既不含当前用户消息，也不含刚新建的空 turn。
    const historyForSeed = this.turns.slice();
    this.turns.push(turn);
    this.activeTurnId = turnId;
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
    this.events.emit("turn:start", { turnId, message: displayText, attachments: params.attachments, meta: params.meta });

    const abort = new AbortController();
    this.chatAbort = abort;
    const externalAbort = () => abort.abort();
    params.signal?.addEventListener("abort", externalAbort, { once: true });

    try {
      await this.ensureToolChannel();
      // 追加 seed 消息必须先于 /chat/stream，否则流式已开始，seed 无法保证在本轮对模型可见。
      await this.ensureConversationInitialized(historyForSeed);
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
      this.activeTurnId = undefined;
    }
  }

  async retry(turnId: string): Promise<void> {
    if (this.blockIfDisabled()) return;
    const index = this.turns.findIndex((item) => item.id === turnId);
    if (index === -1) return;
    const [turn] = this.turns.splice(index, 1);
    await this.requestAI({ message: turn.userText, attachments: turn.userAttachments, mode: this.mode });
  }

  async abort(): Promise<void> {
    this.chatAbort?.abort();
    await this.stopRemoteGeneration();
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
  private async consumeChatStream(
    turn: TurnRecord,
    params: { message: string; attachments?: any[]; variables?: Record<string, any> },
    signal: AbortSignal,
  ): Promise<void> {
    // 上传附件到会话文件接口（平台智能体会自动查询，不需要在 stream body 里再传）
    await this.uploadAttachments(params.attachments ?? [], signal);

    // variables 需在智能体 businessVariables 声明集内，且携带时 agentCode 必填。
    // 配置的 projectId/userId 作为业务变量合并进 variables；
    // 原 seed 消息（开发指南/环境信息）改为每轮经 extra_prompt 传递，调用方已传时不覆盖。
    const variables: Record<string, any> = { ...(params.variables ?? {}) };
    if (this.options.projectId !== undefined) variables.projectId = this.options.projectId;
    if (this.options.userId !== undefined) variables.userId = this.options.userId;
    if (!variables.extra_prompt && this.getSeedMessages) {
      try {
        const seeds = (await this.getSeedMessages()) ?? [];
        const extra = seeds
          .filter((content): content is string => typeof content === "string" && !!content.trim())
          .join("\n\n");
        if (extra) variables.extra_prompt = extra;
      } catch (error) {
        console.warn("[WebSocketAgent] build extra_prompt failed:", error);
      }
    }
    const useVariables = Object.keys(variables).length > 0 && !!this.options.agentCode;
    const response = await this.openChatStream(
      {
        message: params.message,
        agentCode: this.options.agentCode,
        sessionId: this.conversationSessionId,
        ...(useVariables ? { variables } : {}),
      },
      signal,
    );

    const iterId = createId("iter");
    const iter: LLMIter = { iterId, content: "", toolCalls: [], startTime: Date.now(), mode: this.mode };
    turn.iterations.push(iter);
    this.events.emit("llm:start", { step: 1, startTime: iter.startTime, iterId });

    let answer = "";
    const terminal = await this.readChatStream(response, signal, (event) => {
      const result = this.applyChatEvent(turn, iter, event, answer);
      answer = result.answer;
      return result.terminal;
    });
    if (!terminal) {
      if (signal.aborted) return; // 被 abort，交由上层 finishTurn(abort)
      throw new Error("Chat stream closed before a terminal event");
    }
  }

  /** 发起一次 /chat/stream 请求，返回响应（body 交由调用方读取）。 */
  private async openChatStream(
    body: {
      message: string;
      agentCode?: string;
      sessionId?: string;
      variables?: Record<string, any>;
    },
    signal: AbortSignal,
  ): Promise<Response> {
    const response = await fetch(`${this.options.baseUrl}/api/v1/chat/stream`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: body.message,
        ...(body.agentCode ? { agentCode: body.agentCode } : {}),
        ...(body.sessionId ? { sessionId: body.sessionId } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
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
  private async uploadAttachments(attachments: any[], signal: AbortSignal): Promise<void> {
    const sessionId = this.conversationSessionId ?? this.sessionId;
    if (!sessionId || !attachments.length) return;
    // 只处理图片类附件；agentCode 是上传接口的必填项，缺失则跳过上传。
    const agentCode = this.options.agentCode;
    if (!agentCode) {
      console.warn("[WebSocketAgent] skip attachment upload: agentCode is required by the files API");
      return;
    }

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
            headers: { Authorization: `Bearer ${this.options.apiKey}` },
            body: form,
          },
        );
        if (!response.ok) {
          console.warn(`[WebSocketAgent] attachment upload failed: ${response.status} ${response.statusText}`);
          continue;
        }
        const result = await response.json().catch(() => null);
        if (result?.agentVisible === false) {
          console.warn("[WebSocketAgent] uploaded file not visible to agent:", result?.warnings);
        }
      } catch (error) {
        if (signal.aborted) throw error; // 用户主动中止，向上抛
        console.warn("[WebSocketAgent] attachment upload error, skipped:", error);
      }
    }
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

  private applyChatEvent(turn: TurnRecord, iter: LLMIter, event: ChatEvent, answer: string): { answer: string; terminal: boolean } {
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
        return { answer, terminal: false };
      case "delta": {
        const delta = typeof event.data === "string" ? event.data : String(event.data ?? "");
        const next = answer + delta;
        iter.content = next;
        this.events.emit("llm:content", { delta, content: next, step: 1, iterId: iter.iterId });
        return { answer: next, terminal: false };
      }
      case "tool_start":
        this.onRemoteToolStart(iter, event.data ?? {});
        return { answer, terminal: false };
      case "tool_result":
        this.onRemoteToolResult(iter, event.data ?? {});
        return { answer, terminal: false };
      case "done": {
        const finalAnswer = event.data?.answer;
        if (!answer && typeof finalAnswer === "string") {
          iter.content = finalAnswer;
          this.events.emit("llm:content", { delta: finalAnswer, content: finalAnswer, step: 1, iterId: iter.iterId });
        }
        iter.endTime = Date.now();
        this.events.emit("llm:complete", { step: 1, finishReason: "stop", done: true, endTime: iter.endTime, iterId: iter.iterId });
        this.finishTurn(turn, "success");
        return { answer: answer || finalAnswer || "", terminal: true };
      }
      case "stopped":
        iter.endTime = Date.now();
        this.finishTurn(turn, "abort");
        return { answer, terminal: true };
      case "error":
        throw new Error(String(event.data?.message ?? event.data ?? "Remote agent error"));
      default:
        return { answer, terminal: false };
    }
  }

  /** 远程侧已执行的工具（如 manatee-connector）：只做进度展示。 */
  private onRemoteToolStart(iter: LLMIter, data: any): void {
    if (!data.callId) return;
    if (iter.toolCalls.some((item) => item.callId === data.callId)) return;
    const startTime = Date.now();
    iter.toolCalls.push({
      callId: data.callId,
      name: data.name ?? "",
      args: parseArgs(data.arguments),
      status: "pending",
      execStartTime: startTime,
      execEndTime: 0,
    });
    this.events.emit("tool:call", {
      callId: data.callId,
      name: data.name ?? "",
      args: parseArgs(data.arguments),
      step: 1,
      startTime,
      iterId: iter.iterId,
    });
  }

  private onRemoteToolResult(iter: LLMIter, data: any): void {
    if (!data.callId) return;
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
      if (!this.channelUrl || isExpired(this.sessionExpiresAt)) {
        const response = await fetch(`${this.options.baseUrl}/api/v1/sessions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            clientType: this.options.clientType ?? "mybricks-designer",
            meta: { workspaceId: this.options.workspaceId, ...(this.options.meta ?? {}) },
          }),
        });
        if (!response.ok) throw new Error(`MCP session creation failed: ${response.status} ${response.statusText}`);
        const session = await response.json();
        if (!session?.wsUrl || !session?.sessionId) {
          throw new Error("MCP session response missing sessionId/wsUrl");
        }
        // 直接采用服务端返回的 sessionId 与 wsUrl（wsUrl 已内嵌 sessionId 与 token）。
        this.sessionId = session.sessionId as string;
        this.sessionToken = session.token as string | undefined;
        this.channelUrl = session.wsUrl as string;
        this.sessionExpiresAt = parseExpiresAt(session.expiresAt);
        // 首次建会话时，对话 sessionId 默认沿用返回的 sessionId；后续 /chat/stream 的 meta 若不同再对齐。
        this.conversationSessionId = this.conversationSessionId ?? session.sessionId;
        if (Number(session.heartbeatIntervalMs) > 0) this.heartbeatIntervalMs = Number(session.heartbeatIntervalMs);
        // 新会话意味着旧 history 同步标记失效，需要重新同步。
        this.legacySynced = false;
        this.persistSession();
      }
      const url = this.channelUrl;
      if (!url) throw new Error("Missing channel url");
      const socket = new WebSocket(url);
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

    const iter = this.currentIter();
    const startTime = Date.now();
    let result: ToolResult;
    let toolRecord: ToolCallRecord | undefined;
    try {
      const tool = this.tools.find((item) => item.name === payload.toolName);
      const turn = this.turns.find((item) => item.id === this.activeTurnId);
      if (!tool) throw new Error(`Tool not found: ${payload.toolName}`);
      if (!turn || !iter) throw new Error("Active turn not found");

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
      this.events.emit("tool:call", { callId: requestId, name: payload.toolName, args: payload.arguments ?? {}, step: 1, startTime, iterId: iter.iterId });

      const context: ToolExecutionContext = {
        turnId: turn.id,
        iterations: turn.iterations,
        getUserMessage: () => ({ message: turn.userText, attachments: turn.userAttachments }),
        getAgent: () => this as any,
        getAiRole: () => undefined,
        setAiRole: () => undefined,
        mode: this.mode,
        getMode: () => this.mode,
        setMode: (mode: AgentMode, reason?: string) => this.setMode(mode, reason),
        emitProgress: (data: any) => this.events.emit("tool:progress", { callId: requestId, name: payload.toolName, data, step: 1, iterId: iter.iterId }),
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
      this.events.emit("tool:result", { callId: requestId, name: payload.toolName, result: result.result, step: 1, endTime: Date.now(), iterId: iter.iterId });
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
        headers: { Authorization: `Bearer ${this.options.apiKey}`, "Content-Type": "application/json" },
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
    this.toolResults.clear();
    this.toolIterMap.clear();
    void this.persistTurn(turn);
    this.setState({ running: false, ...(error ? { error } : {}) });
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
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return null;
  const text = data.join("\n");
  try { return { name, data: JSON.parse(text) }; }
  catch { return { name, data: text }; }
}

/**
 * 把本地历史轮次拍平成一条可注入的 user 背景消息。
 * append 端点只接受 role=user/tool，因此 AI 回复以摘要形式并入同一条文本，
 * 让模型看到过往脉络，而非严格的多轮结构。返回空串表示无需同步。
 */
function summarizeHistoryForSeed(turns: TurnRecord[]): string {
  const valid = turns.filter((turn) => !(turn as any).deleted && (turn.userText?.trim() || turn.iterations?.length));
  if (!valid.length) return "";
  const blocks: string[] = [];
  for (const turn of valid) {
    const parts: string[] = [];
    if (turn.userText?.trim()) parts.push(`用户：${turn.userText.trim()}`);
    const answer = turn.iterations
      .map((iter) => ("content" in iter ? (iter as any).content : ""))
      .filter((text) => typeof text === "string" && text.trim())
      .join("\n")
      .trim();
    if (answer) parts.push(`助手：${answer}`);
    if (parts.length) blocks.push(parts.join("\n"));
  }
  if (!blocks.length) return "";
  return [
    "<history-context note=\"以下是本次会话迁移前的历史对话，供你了解上下文，无需重复回答\">",
    blocks.join("\n\n"),
    "</history-context>",
  ].join("\n");
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
