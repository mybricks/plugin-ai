import { randomUUID } from "./uuid";
import { createRequestAsStream } from "../../request/src";
import type { ToolDescriptor } from "../../request/src";
import { AgentEvents } from "./events";
import type {
  AgentMode,
  AgentOptions,
  AgentsMdConfig,
  BoundHistory,
  CompactRecord,
  ForkAgentOptions,
  FormatUserMessageResult,
  History,
  LLMCallResult,
  Message,
  MessageSection,
  RequestAIOptions,
  TokenUsage,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  TurnMessageSnapshot,
  TurnPersistMode,
  TurnRecord,
  WarmupIter,
} from "./types";
import { turnsToMessages, bindHistory, getLLMIterations, hasNoToolCalls, serializeToolCallArgumentsFromIter, serializeToolCallArgumentsFromLLMResult, attachmentToMessagePart } from "./types";
import { maskMessages, computeHandoffTurnIds, buildProtectedAttachmentTurnIds, type MaskOptions } from "./mask";
import { wrapRequestWithRetry, type RetryOptions } from "./retry";
import { CALL_SUB_AGENT_TOOL_NAME } from "./sub-agent";
import { getTurnMode } from "./utils/core";
import { getAvailableAgentModes, AgentModeEnum } from "./mode-manager";

export { AgentEvents };
export type { AgentMode, Message, History, Tool, TurnRecord, ToolCallRecord, WarmupIter };
export type {
  AgentOptions,
  AgentsMdConfig,
  AgentsMdConfigResolver,
  AgentHooks,
  CompactRecord,
  ForkAgentOptions,
  ForkOptions,
  FormatUserMessageResult,
  RequestAIOptions,
  ToolExecutionContext,
  BoundHistory,
} from "./types";
export type { MaskOptions } from "./mask";

// ─── 默认配置常量 ────────────────────────────────────────────────────────────
/** 默认上下文窗口大小（token 数） */
const DEFAULT_CONTEXT_WINDOW = 200_000;
/** 预留给模型输出的 token 数 */
const COMPACT_RESERVE_OUTPUT = 20_000;
/** 缓冲区大小（防止精确边界触发） */
const COMPACT_BUFFER = 13_000;
/** 默认重试配置 */
const DEFAULT_RETRY: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};
/** 默认摘要配置 */
const DEFAULT_SUMMARY = { enabled: true as const };
/** 默认 compact 配置 */
const DEFAULT_COMPACT = { enabled: true as const, maxTurns: 15 };

type InternalAgentOptions = AgentOptions & { request: NonNullable<AgentOptions["request"]> };

function normalizeAgentMode(mode: any): AgentMode {
  return mode === AgentModeEnum.Plan ? AgentModeEnum.Plan : AgentModeEnum.Build;
}

function normalizeAllowedAgentMode(mode: any, options: AgentOptions): AgentMode {
  const availableModes = getAvailableAgentModes(options);
  const normalized = normalizeAgentMode(mode);
  return availableModes.includes(normalized) ? normalized : availableModes[0];
}

/**
 * 构建 turn 级消息快照（在 turn 开始时调用一次）：
 *   [snapshot.historyTurns]              历史 turns 快照
 *   [snapshot.agentsMdMessage]           agents.md 上下文（仅获取一次）
 *   [snapshot.stableContextMessages]     静态背景上下文（getStableContextMessages，仅获取一次）
 *   [snapshot.attachmentContextMessages] 随消息携带的动态上下文（getAttachmentContextMessages，仅获取一次）
 *
 * 注意：compact 摘要和历史 messages 不在此处固化。
 * 它们依赖 compactRecord，必须在每个 iter 请求前用最新 compactRecord 重新构建。
 */
async function buildTurnMessageSnapshot(
  options: AgentOptions,
  historyTurns: TurnRecord[],
  mode: AgentMode,
  previousMode?: AgentMode | null
): Promise<TurnMessageSnapshot> {
  const agentsMdMessage = await buildAgentsMdMessage(options.agentsMdConfig);

  const stableContextMessages: Message[] = options.getStableContextMessages
    ? await options.getStableContextMessages()
    : [];

  const attachmentContextMessages: MessageSection[] = options.getAttachmentContextMessages
    ? await options.getAttachmentContextMessages({ mode, previousMode: previousMode ?? null })
    : [];

  return {
    historyTurns,
    agentsMdMessage,
    stableContextMessages,
    attachmentContextMessages,
    mode,
  };
}

function formatAgentsMdEntry(entry: AgentsMdConfig): string {
  const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<agents-md path="${escapeAttr(entry.path)}">\n${entry.content}\n</agents-md>`;
}

async function buildAgentsMdMessage(
  agentsMdConfig: AgentOptions["agentsMdConfig"]
): Promise<Message | null> {
  const entries = (agentsMdConfig ? await agentsMdConfig() : [])
    .map((entry) => ({
      ...entry,
      content: entry.content?.trim() ?? "",
    }))
    .filter((entry) => entry.content);

  if (!entries.length) return null;

  const content = `# agents.md\n\n${entries.map(formatAgentsMdEntry).join("\n\n")}\n\n`;

  return {
    role: "user",
    content:
      `<system-reminder>\n` +
      `As you answer the user's questions, you can use the following context:\n` +
      content +
      `IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n` +
      `</system-reminder>`,
  };
}

/**
 * 构建单次 iter 请求的基础 messages（每个 iter 请求前调用一次）：
 *   [0]       system message（仅包含内置系统提示词）
 *   [1]       agentsMd user message（仅当 agentsMd 非空时存在）
 *   [2..A]    turn 级动态上下文（snapshot.contextMessages）
 *   [A..B]    compact 摘要消息（仅当当前 compactRecord 非空时存在）
 *   [B..N]    历史对话（从 snapshot.historyTurns 重建，compact 游标后的部分）
 *
 * 每个 iter 会在这些基础上追加：
 *   [N+1..C]  用户自定义上下文（snapshot.userContextMessages）
 *   [C+1]     当前用户消息
 *   [C+2..D]  本轮已积累的 tail（assistant/tool）
 */
function buildIterationBaseMessages(
  options: AgentOptions,
  snapshot: TurnMessageSnapshot,
  compactRecord?: CompactRecord | null
): { baseMessages: Message[]; historyStartIndex: number } {
  const { system } = options;
  const { historyTurns, agentsMdMessage, stableContextMessages } = snapshot;

  const systemMessage: Message | null = system
    ? { role: "system", content: system }
    : null;

  // compact 摘要消息对（放在历史对话之前，游标后的 turns 正常展开）
  const compactMessages: Message[] = compactRecord
    ? [
        {
          role: "user",
          content: `<system-reminder>\nThe following is a summary of the conversation history that has been compacted:\n${compactRecord.content}\n</system-reminder>`,
        },
      ]
    : [];

  // 计算命中 handoff 条件的 turn id 集合（未启用或 turn 无 handoff 内容时不加入）
  const handoffTurnIds = options.mask
    ? computeHandoffTurnIds(historyTurns, options.mask)
    : new Set<string>();

  const historyMessages = turnsToMessages(historyTurns, compactRecord, handoffTurnIds);

  // ── prompt cache 断点 ────────────────────────────────────────────────────
  // 断点 1：system message 单独打 cache（几乎不变，命中率最高）
  const cachedSystemMessage: Message | null = systemMessage
    ? { ...systemMessage, cache: true }
    : null;

  // 断点 2：agentsMd + stableContext + compact 最后一条打 cache
  const staticRest: Message[] = [
    ...(agentsMdMessage ? [agentsMdMessage] : []),
    ...stableContextMessages,
    ...compactMessages,
  ];
  if (staticRest.length > 0) {
    staticRest[staticRest.length - 1] = {
      ...staticRest[staticRest.length - 1],
      cache: true,
    };
  }

  const staticPrefix: Message[] = [
    ...(cachedSystemMessage ? [cachedSystemMessage] : []),
    ...staticRest,
  ];

  const baseMessages = [
    ...staticPrefix,
    ...historyMessages,
  ];

  // historyStartIndex：assembled 数组中，静态前缀（system/agentsMd/stableContext/compact）之后的起始索引
  // mask 时只对 index >= historyStartIndex 的消息做遮蔽，前缀不受影响
  const historyStartIndex = (systemMessage ? 1 : 0) + (agentsMdMessage ? 1 : 0) + stableContextMessages.length + compactMessages.length;

  return { baseMessages, historyStartIndex };
}

/**
 * 每次 LLM 请求前组装完整 messages 列表：
 *   baseMessages（静态前缀 + 静态背景上下文 + 历史）
 *   + 前置上下文消息（attachmentContextMessages 合并为一条 user 消息，可选）
 *   + 用户消息
 *   + 本轮已积累的对话尾部
 *
 * @param baseMessages                buildIterationBaseMessages 返回的基础部分
 * @param historyStartIndex           assembled 数组中历史消息的起始索引（mask 时跳过静态前缀）
 * @param options                     AgentOptions
 * @param turns                       当前 turns 快照（用于 mask）
 * @param params                      本轮用户请求参数
 * @param tail                        本轮已积累的 assistant + tool 消息（step > 1 时非空）
 * @param attachmentContextMessages   随消息携带的动态上下文段落（MessageSection[]，join 后插在用户消息正前方）
 */
function assembleMessages(
  baseMessages: Message[],
  historyStartIndex: number,
  options: AgentOptions,
  turns: TurnRecord[],
  params: RequestAIOptions,
  tail: Message[],
  attachmentContextMessages: MessageSection[]
): Message[] {
  const { message, attachments } = params;

  let userContent: Message["content"] = message;
  if (attachments?.length) {
    userContent = [
      { type: "text", text: message },
      ...attachments.map(attachmentToMessagePart),
    ];
  }
  const userMessage: Message = { role: "user", content: userContent };

  // attachmentContextMessages（string[]）拼接为一条前置 user 消息（为空则不插入）
  const prefixText = attachmentContextMessages.filter(Boolean).join("\n\n");
  const prefixMessage: Message | null = prefixText
    ? { role: "user", content: prefixText }
    : null;

  const assembled = [
    ...baseMessages,
    ...(prefixMessage ? [prefixMessage] : []),
    userMessage,
    ...tail,
  ];

  // ── prompt cache 断点 3：当前请求尾部最后一条消息 ──────────────
  // tail 非空时最后一条为 role: "tool"，空时为 userMessage (role: "user")
  // role: "assistant" 不加 cache（工具调用响应消息不是断点）
  const cacheTargetIndex = baseMessages.length + (prefixMessage ? 1 : 0) + tail.length;
  // 等价于 userMessage 在 assembled 中的索引 + tail.length（tail 为空则指向 userMessage 自身）
  const cacheTarget = assembled[cacheTargetIndex];
  if (cacheTarget && (cacheTarget.role === "user" || cacheTarget.role === "tool")) {
    assembled[cacheTargetIndex] = { ...cacheTarget, cache: true };
  }

  // 应用遮蔽（默认开启，可通过 mask: false 显式关闭）
  // 遮蔽时跳过前缀（system/agentsMd/context/compact，不在 turns 中，不应被遮蔽）
  if (options.mask !== false) {
    const maskOpts: MaskOptions = options.mask && typeof options.mask === "object" ? options.mask : {};
    const prefix = assembled.slice(0, historyStartIndex);
    const rest = assembled.slice(historyStartIndex);
    // 计算附件保护集合：尾部连续 plan 轮的 user 附件不参与遮蔽
    const protectedTurnIds = buildProtectedAttachmentTurnIds(turns);
    const maskedRest = maskMessages(rest, turns, maskOpts, protectedTurnIds);
    return [...prefix, ...maskedRest];
  }

  return assembled;
}

// ─── 构建工具描述列表 ──────────────────────────────────────────────────────────

function buildToolDescriptors(tools?: Tool[]): ToolDescriptor[] {
  // 即使没有工具也必须返回空数组而非 undefined，
  // 否则某些大模型 API 会因缺少 tools 字段而报错。
  if (!tools || tools.length === 0) return [];
  return tools.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

function callLLM(
  options: InternalAgentOptions,
  messages: Message[],
  signal: AbortSignal,
  rest: Record<string, any>,
  step: number,
  onContent: (delta: string, content: string, thinkingDelta?: string, thinkingContent?: string) => void,
  onToolStreaming: (callId: string, name: string, delta: string, content: string) => void
): Promise<LLMCallResult> {
  return new Promise<LLMCallResult>((resolve, reject) => {
    let content = "";
    let thinkingContent = "";
    let toolCalls: Array<{ id: string; name: string; args: any; argsRaw?: string }> = [];
    let finishReason = "unknown";
    let aborted = false;
    let usageFromCallback: TokenUsage | undefined = undefined;
    // index → { callId, name, argsRaw } 映射（在 callLLM 内累积，用于 JSON 解析）
    const indexToCallInfo = new Map<number, { callId: string; name: string; argsRaw: string }>();

    if (signal.aborted) {
      resolve({ content, thinkingContent, toolCalls, finishReason, aborted: true });
      return;
    }

    const onAbort = () => {
      aborted = true;
      resolve({ content, thinkingContent, toolCalls, finishReason, aborted: true });
    };
    signal.addEventListener("abort", onAbort);

    options.request({
      messages,
      tools: buildToolDescriptors(options.tools),
      emits: {
        write: (chunk: string) => {
          if (aborted) return;
          content += chunk;
          onContent(chunk, content);
        },
        complete: (usage?: any) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted) return;
          const isValidUsage = (u: any): u is TokenUsage =>
            u != null && typeof u === "object" && "promptTokens" in u;
          const safeUsage = isValidUsage(usage) ? usage : isValidUsage(usageFromCallback) ? usageFromCallback : undefined;
          resolve({ content, thinkingContent, toolCalls, finishReason, usage: safeUsage, aborted: false });
        },
        error: (e: any) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted) return;
          reject(e);
        },
        cancel: (fn: () => void) => {
          signal.addEventListener("abort", fn);
        },
        onThinking: (chunk: string) => {
          if (aborted) return;
          thinkingContent += chunk;
          onContent("", content, chunk, thinkingContent);
        },
        onToolCalls: (calls) => {
          if (aborted) return;
          // 流式接口：indexToCallInfo 已累积完整参数字符串，透传 argsRaw 到执行阶段，由 try/catch 统一处理 parse。
          // 无参数工具（累积串为空/空白/"{}"）直接给 {}。
          // 非流式接口：indexToCallInfo 为空，直接沿用网络层已解析好的 args。
          if (indexToCallInfo.size > 0) {
            toolCalls = calls.map((call) => {
              const info = [...indexToCallInfo.values()].find(
                (v) => v.callId === call.id
              );
              if (!info) return call;
              const raw = info.argsRaw.trim();
              if (!raw || raw === "{}") return { ...call, args: {}, argsRaw: raw };
              // 不在此处 parse，将 raw 透传到执行阶段，由 try/catch 统一处理
              return { ...call, args: null, argsRaw: raw };
            });
          } else {
            toolCalls = calls;
          }
        },
        onToolCallStream: (delta) => {
          if (aborted) return;
          const { index, id, name, argsChunk } = delta;
          if (id && name && !indexToCallInfo.has(index)) {
            // 首帧：记录 callId + name，开始累积参数字符串
            indexToCallInfo.set(index, { callId: id, name, argsRaw: argsChunk ?? "" });
            onToolStreaming(id, name, argsChunk ?? "", argsChunk ?? "");
          } else if (argsChunk) {
            // 后续帧：继续累积参数字符串，回调传增量 + 全量
            const info = indexToCallInfo.get(index);
            if (info) {
              info.argsRaw += argsChunk;
              onToolStreaming(info.callId, info.name, argsChunk, info.argsRaw);
            }
          }
        },
        onFinishReason: (reason: string) => {
          if (aborted) return;
          finishReason = reason;
        },
        onUsage: (usage: TokenUsage) => {
          if (aborted) return;
          usageFromCallback = usage;
        },
      },
      ...rest,
    });
  });
}

// ─── Doom loop 检测辅助 ────────────────────────────────────────────────────────

/**
 * 检查最近 N 个 iter 的工具调用集合是否连续相同。
 * 每个 iter 的 tool calls 被序列化为一个 key（按调用顺序），
 * 从最新 iter 往前找连续匹配的 iter 数量（不含当前 iter 本身）。
 */
function getDoomLoopCount(
  iterHistory: Array<string>,
  currentIterKey: string
): number {
  let count = 0;
  for (let i = iterHistory.length - 1; i >= 0; i--) {
    if (iterHistory[i] === currentIterKey) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getLastRecordedMode(turns: TurnRecord[]): AgentMode | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const iters = getLLMIterations(turns[i].iterations);
    for (let j = iters.length - 1; j >= 0; j--) {
      const mode = iters[j].mode;
      if (mode) return mode;
    }
  }
  return null;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class Agent {
  readonly events = new AgentEvents();
  readonly key: string | undefined;
  protected options: InternalAgentOptions;
  private _mode: AgentMode;
  /**
   * 调用方传入的原始 request。
   * options.request 会在构造时包一层 retry；fork 时必须回到 rawRequest，
   * 否则父 Agent 的 retry wrapper 会和 fork 自己的 retry 配置叠套。
   */
  protected readonly rawRequest: NonNullable<AgentOptions["request"]>;
  /** 历史调用记录（SSE 事件粒度），从 History 加载，每轮 complete/abort/error 后 append */
  protected turns: TurnRecord[] = [];
  /**
   * compact 记录缓存（从 History 加载）。
   * 每个 iter 构建 messages 时传给 turnsToMessages，用于游标分割历史。
   */
  protected compactRecord: CompactRecord | null = null;
  private _abortController: AbortController | null = null;
  /** 确保 _abortController 存在且可用；如已失效或不存在则新建 */
  private _ensureAbortController(): AbortController {
    if (!this._abortController || this._abortController.signal.aborted) {
      this._abortController = new AbortController();
    }
    return this._abortController;
  }

  constructor(options: AgentOptions) {
    // 仅在调用方”未声明该字段”时注入默认值；
    // 若调用方显式传入 summary/compact（即便是 undefined），按原值保留。
    const hasSummary = Object.prototype.hasOwnProperty.call(options, "summary");
    const hasCompact = Object.prototype.hasOwnProperty.call(options, "compact");
    const hasRetry = Object.prototype.hasOwnProperty.call(options, "retry");

    const retryOpts = hasRetry ? (options.retry ?? DEFAULT_RETRY) : DEFAULT_RETRY;
    // llmProvider 存在时优先使用其 request，否则沿用传入的 request（向后兼容）
    const effectiveRequest = options.llmProvider ? options.llmProvider.request : (options.request ?? createRequestAsStream());
    this.rawRequest = effectiveRequest;

    this.options = {
      ...options,
      mode: normalizeAllowedAgentMode(options.mode, options),
      request: wrapRequestWithRetry(this.rawRequest, retryOpts, this.events),
      ...(hasSummary ? {} : { summary: DEFAULT_SUMMARY }),
      ...(hasCompact ? {} : { compact: DEFAULT_COMPACT }),
      ...(hasRetry ? {} : { retry: retryOpts }),
    };
    this._mode = normalizeAllowedAgentMode(options.mode, options);
    this.key = options.key;
  }

  /** 获取当前运行模式。 */
  getMode(): AgentMode {
    return this._mode;
  }

  /** 获取当前可用的运行模式列表（基于 disabledModes 配置）。 */
  getAvailableModes(): AgentMode[] {
    return getAvailableAgentModes(this.options);
  }

  /** 设置当前运行模式。 */
  setMode(mode: AgentMode, reason?: string): void {
    const nextMode = normalizeAllowedAgentMode(mode, this.options);
    const previousMode = this._mode;
    this._mode = nextMode;
    this.options.mode = nextMode;
    if (previousMode !== nextMode) {
      this.events.emit("mode:change", { mode: nextMode, previousMode, reason });
    }
  }

  /** 加载历史调用记录（同时加载 compact 记录） */
  async loadHistory(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) {
      const loadedTurns = await history.load(key);
      // 面板可能在请求进行中才挂载；此时未结束的 turn 还没持久化，不能被历史覆盖掉。
      const loadedIds = new Set(loadedTurns.map((turn) => turn.id));
      const activeTurns = this.turns.filter((turn) => !turn.endTime && !loadedIds.has(turn.id));
      this.turns = [...loadedTurns, ...activeTurns];
      let compactRecord = await history.loadCompact(key);
      if (compactRecord && typeof compactRecord === "string") {
        try {
          const parsed = JSON.parse(compactRecord as any);
          if (parsed && "upToTurnId" in parsed) compactRecord = parsed;
        } catch {}
      }
      this.compactRecord = compactRecord;
    }
  }

  /** 清除历史（同时清除 compact 记录缓存） */
  async clearHistory(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.clear(key);
    this.turns = [];
    this.compactRecord = null;
  }

  /** 获取历史调用记录（供 UI 直接使用） */
  getTurns(): TurnRecord[] {
    return this.turns;
  }

  /** 主动关闭某轮建议选项展示。 */
  async dismissSuggestions(turnId: string): Promise<void> {
    const turn = this.turns.find((t) => t.id === turnId);
    if (turn) {
      turn.suggestionsDismissed = true;
    }

    const { history, key } = this.options;
    if (history && key) {
      await history.update(key, turnId, { suggestionsDismissed: true });
    }

    this.events.emit("turn:suggestions:dismiss", { turnId });
  }

  /** 获取 compact 记录（供 UI 或外部读取） */
  getCompactRecord(): CompactRecord | null {
    return this.compactRecord;
  }

  /**
   * 获取与当前 agentKey 绑定的 History 视图（BoundHistory）。
   * 所有方法已隐藏 key 参数，供 sandbox 等外部调用方直接使用。
   * 未配置 history 或未设置 key 时返回 null。
   */
  getHistory(): BoundHistory | null {
    const { history } = this.options;
    const key = this.key;
    if (!history || !key) return null;
    return bindHistory(history, key);
  }

  /**
   * 获取当前 agent 的工具列表。
   * 供 UI 层按需查找工具定义（如自定义渲染函数）。
   */
  getTools(): Tool[] {
    return this.options.tools ?? [];
  }

  /** 主动取消当前请求，触发 turn:abort */
  abort() {
    this._abortController?.abort();
  }

  /**
   * 重试失败的 turn。
   * 
   * - 第一步失败（iterations 为空）：清除历史，重新 requestAI
   * - 中途失败（有 iterations）：从失败点继续执行
   */
  async retry(turnId: string): Promise<void> {
    const turn = this.turns[this.turns.length - 1];
    if (!turn || turn.id !== turnId || turn.status !== "error") {
      return;
    }

    // 无 LLM iter：清空 iterations，复用 turn，从头重跑（含 beforeTurn/warmup）
    if (getLLMIterations(turn.iterations).length === 0) {
      turn.iterations = [];
    }

    this.events.emit("turn:resume", { turnId: turn.id });

    // 统一走 _runTurn，由它根据 turn.iterations 决定是否跑 beforeTurn/warmup
    await this._runTurn(turn, {
      userParams: { message: turn.userText, attachments: turn.userAttachments, meta: turn.meta, extra: turn.extra },
      persistMode: "update",
    });
  }

  /**
   * 统一 turn 执行入口（requestAI 和 retry 共用）。
   * - getLLMIterations(turn.iterations).length === 0：从头执行，跑 beforeTurn
   * - getLLMIterations(turn.iterations).length > 0：续跑，跳过 beforeTurn
   * warmup（compact 等）统一由 _runReActLoop 在每次 llm:start 之前判断执行。
   */
  private async _runTurn(
    turn: TurnRecord,
    opts: {
      userParams: { message: string; attachments?: any[]; meta?: any; extra?: Record<string, any> };
      llmRest?: Record<string, any>;
      persistMode: TurnPersistMode;
    }
  ): Promise<void> {
    const { userParams, llmRest, persistMode } = opts;
    const isFromStart = getLLMIterations(turn.iterations).length === 0;

    // 重置 turn 状态
    turn.status = "success";
    turn.error = undefined;

    const signal = this._ensureAbortController().signal;

    if (isFromStart) {
      // 执行 beforeTurn hook
      try {
        await this.options.hooks?.beforeTurn?.({
          message: userParams.message,
          attachments: userParams.attachments ?? [],
          meta: userParams.meta,
          extra: userParams.extra,
        });
      } catch (e) {
        console.warn("[Agent] hooks.beforeTurn failed:", e);
      }
    }

    // 构建 turn 级消息快照：historyTurns 是当前 turn 可见的历史上下文
    const historyTurns = this.turns.filter(t => t.id !== turn.id);
    const turnStartMode = this.getMode();
    const previousMode = getLastRecordedMode(historyTurns);
    let messageSnapshot: TurnMessageSnapshot;
    try {
      messageSnapshot = await buildTurnMessageSnapshot(this.options, historyTurns, turnStartMode, previousMode);
    } catch (e) {
      turn.endTime = Date.now();
      turn.status = "error";
      turn.error = String((e as any)?.message ?? e);
      await this._saveTurnRecord(turn, persistMode);
      this.events.emit("turn:error", { error: e });
      this._onTurnEnd(turn);
      throw e;
    }

    await this._runReActLoop({ messageSnapshot, turn, userParams, llmRest, persistMode });
  }

  /** ReAct 循环核心逻辑（requestAI 和 retry 共用） */
  private async _runReActLoop(opts: {
    /** turn 级消息快照；每个 iter 会基于它和最新 compactRecord 重新构建 messages */
    messageSnapshot: TurnMessageSnapshot;
    /** 当前 turn 记录（用于写入迭代结果、持久化） */
    turn: TurnRecord;
    /** 用户侧消息参数（message、attachments、meta、extra），用于组装消息和 hooks */
    userParams: { message: string; attachments?: any[]; meta?: any; extra?: Record<string, any> };
    /** 透传给 callLLM 的其余参数（aiRole 等） */
    llmRest?: Record<string, any>;
    /** 本次执行对持久化层的写入语义：新 turn 首次保存 append，retry 复用旧 turn update */
    persistMode: TurnPersistMode;
  }): Promise<void> {
    const { messageSnapshot, turn, userParams, llmRest = {}, persistMode } = opts;

    // 从 turn.iterations 自动推导 initialTail 和 startStep
    const llmItersOnEntry = getLLMIterations(turn.iterations);
    const initialTail: Message[] = [];
    for (const iter of llmItersOnEntry) {
      const assistantMsg: Message = {
        role: "assistant",
        content: iter.content,
        ...(iter.thinkingContent ? { reasoning_content: iter.thinkingContent } : {}),
        tool_calls: iter.toolCalls.map(tc => ({
          id: tc.callId,
          type: "function" as const,
          function: { name: tc.name, arguments: serializeToolCallArgumentsFromIter(tc) },
        })),
      };
      initialTail.push(assistantMsg);
      for (const tc of iter.toolCalls) {
        initialTail.push({
          role: "tool",
          tool_call_id: tc.callId,
          content: tc.status === "error" ? `Error: ${tc.error}` : tc.result?.output ?? "",
        });
      }
    }
    const startStep = llmItersOnEntry.length + 1;
    // 确保 AbortController 可用（retry 续跑时 _abortController 可能为 null 或已 abort）
    const signal = this._ensureAbortController().signal;
    // 每次进入 ReAct 循环都从入口参数初始化一份 turn 级 aiRole，
    // 循环结束后自然销毁，不污染下一次 request/retry。
    const baseLlmRest: Record<string, any> = { ...llmRest };
    const initialAiRole = baseLlmRest.aiRole as string | undefined;
    let turnAiRole: string | undefined = initialAiRole || undefined;
    const buildStepLLMRest = (): { rest: Record<string, any>; effectiveAiRole?: string } => {
      const rest = { ...baseLlmRest };
      const effectiveAiRole = turnAiRole;
      if (effectiveAiRole) {
        rest.aiRole = effectiveAiRole;
      } else {
        delete rest.aiRole;
      }
      return { rest, effectiveAiRole };
    };

    const maxSteps = this.options.maxSteps ?? 50;
    const doomLoopThreshold = this.options.doomLoopThreshold ?? 3;

    // 获取 formattedParams（如果需要）
    const formattedParams = turn.userFormattedText
      ? { ...userParams, message: turn.userFormattedText }
      : userParams;

    const tail = [...initialTail];
    // 每个元素代表一个 iter 的全部 tool calls 的序列化 key，用于 doom loop 检测
    const iterCallHistory: Array<string> = [];

    // 收集已有 iter 调用历史（用于 doom loop 检测，_continueFromError 续跑时需要）
    // 只保留最近 doomLoopThreshold 条，超出部分无意义
    const existingIters = getLLMIterations(turn.iterations);
    for (const iter of existingIters.slice(-doomLoopThreshold)) {
      const iterKey = iter.toolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.args)}`).join("|");
      iterCallHistory.push(iterKey);
    }

    try {
      for (let step = startStep; step <= maxSteps; step++) {
        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("turn:abort", {});
          this._onTurnEnd(turn);
          return;
        }

        // 每次 LLM 请求之前判断是否需要 warmup（compact 等预处理）
        if (this._shouldAutoCompact() && !this._isAlreadyCompacted()) {
          const warmupAborted = await this._runWarmup(turn, signal, persistMode);
          if (warmupAborted) return;
        }

        const llmIterations = getLLMIterations(turn.iterations);
        const stepLLMStartTime = step === startStep && llmIterations.length === 0
          ? turn.startTime
          : Date.now();

        this.events.emit("llm:start", { step, startTime: stepLLMStartTime });

        // 执行 beforeRequest hook
        try {
          await this.options.hooks?.beforeRequest?.({
            meta: userParams.meta,
            extra: userParams.extra,
          });
        } catch (e) {
          console.warn("[Agent] hooks.beforeRequest failed:", e);
        }

        // 每个 iter 都使用最新 compactRecord 重新构建基础 messages。
        // 若 warmup 刚完成 compact，这里会立即使用新的 compact 摘要和游标。
        const { baseMessages, historyStartIndex } = buildIterationBaseMessages(
          this.options,
          messageSnapshot,
          this.compactRecord
        );

        // 组装 messages
        const messages = assembleMessages(
          baseMessages,
          historyStartIndex,
          this.options,
          messageSnapshot.historyTurns,
          formattedParams,
          tail,
          messageSnapshot.attachmentContextMessages
        );

        // 调用 LLM
        const { rest: stepLLMRest, effectiveAiRole } = buildStepLLMRest();
        const stepMode = this.getMode();
        let llmResult: LLMCallResult;
        try {
          llmResult = await callLLM(
            this.options,
            messages,
            signal,
            { ...stepLLMRest, _step: step, turnId: turn?.id }, // 传递 step 用于 retry 事件，turnId 用于 SSE 请求头
            step,
            (delta, content, thinkingDelta, thinkingContent) => {
              this.events.emit("llm:content", { delta, content, thinkingDelta, thinkingContent, step });
            },
            (callId, name, delta, content) => {
              this.events.emit("tool:args", { callId, name, delta, content, step });
            }
          );
        } catch (e) {
          turn.endTime = Date.now();
          turn.status = "error";
          turn.error = String((e as any)?.message ?? e);
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("turn:error", { error: e });
          this._onTurnEnd(turn);
          throw e;
        }

        if (llmResult.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("turn:abort", {});
          this._onTurnEnd(turn);
          return;
        }

        // 记录本次迭代
        const iterToolCallRecords: ToolCallRecord[] = [];
        const iterEndTime = Date.now();
        const currentIter: TurnRecord["iterations"][number] = {
          content: llmResult.content,
          toolCalls: iterToolCallRecords,
          startTime: stepLLMStartTime,
          endTime: iterEndTime,
          ...(llmResult.thinkingContent ? { thinkingContent: llmResult.thinkingContent } : {}),
          ...(effectiveAiRole ? { aiRole: effectiveAiRole } : {}),
          mode: stepMode,
          ...(llmResult.usage ? { usage: llmResult.usage } : {}),
        };
        turn.iterations.push(currentIter);
        // 判断是否终止：只有存在实际工具调用时才继续循环
        const hasToolCalls = llmResult.toolCalls.length > 0;
        const shouldContinueWithTools = hasToolCalls;
        const modelFinished = !shouldContinueWithTools;
        if (modelFinished) {
          turn.endTime = iterEndTime;
          turn.status = "success";
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: llmResult.usage, done: true, endTime: turn.endTime });
          this.events.emit("turn:complete", {});
          this._onTurnEnd(turn);
          return;
        }

        // 有工具调用
        this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: llmResult.usage, done: false, endTime: iterEndTime });

        // 追加 assistant message 到 tail
        const assistantMsg: Message = {
          role: "assistant",
          content: llmResult.content,
          ...(llmResult.thinkingContent ? { reasoning_content: llmResult.thinkingContent } : {}),
          tool_calls: llmResult.toolCalls.map(tc => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: serializeToolCallArgumentsFromLLMResult(tc) },
          })),
        };
        tail.push(assistantMsg);

        // 执行工具
        const toolResultMessages: Message[] = [];
        let doomLoopTriggered = false;
        let doomLoopInfo: { toolName: string; count: number } | null = null;

        for (let tcIdx = 0; tcIdx < llmResult.toolCalls.length; tcIdx++) {
          const tc = llmResult.toolCalls[tcIdx];
          if (signal.aborted) break;

          const tool = this.options.tools?.find(t => t.name === tc.name);
          const execStartTime = Date.now();
          let argsParseError: unknown = null;
          if (tc.argsRaw != null && tc.args === null) {
            try {
              tc.args = JSON.parse(tc.argsRaw);
            } catch (e) {
              argsParseError = e;
              tc.args = { _argsRaw: tc.argsRaw };
            }
          }
          const toolRecord: ToolCallRecord = {
            callId: tc.id,
            name: tc.name,
            title: tool?.title,
            args: tc.args,
            status: "pending",
            execStartTime,
            execEndTime: 0,
          };
          iterToolCallRecords.push(toolRecord);
          this.events.emit("tool:call", { callId: tc.id, name: tc.name, args: tc.args ?? undefined, step, startTime: execStartTime });

          let toolResultContent: string;
          const toolContext: ToolExecutionContext = {
            turnId: turn.id,
            iterations: turn.iterations,
            getUserMessage: () => ({
              message: userParams.message,
              attachments: userParams.attachments,
            }),
            getAgent: () => this,
            getAiRole: () => turnAiRole,
            setAiRole: (aiRole?: string) => {
              turnAiRole = aiRole || undefined;
            },
            mode: this.getMode(),
            getMode: () => this.getMode(),
            setMode: (mode: AgentMode, reason?: string) => {
              this.setMode(mode, reason);
            },
            emitProgress: (data: any) => {
              this.events.emit("tool:progress", { callId: tc.id, name: tc.name, data, step });
            },
          };

          try {
            if (!tool) throw new Error(`Tool not found: ${tc.name}`);
            if (argsParseError) {
              toolRecord.errorType = "invalid_args";
              throw argsParseError;
            }
            tool.validate?.(tc.args, toolContext);
            const result = await tool.execute(tc.args, toolContext);
            if (signal.aborted) {
              toolRecord.status = "error";
              toolRecord.errorType = "normal";
              toolRecord.error = `Error: 用户已取消`;
              toolResultContent = toolRecord.error
              toolRecord.execEndTime = Date.now();
              this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: toolRecord.error, errorType: toolRecord.errorType, step, endTime: toolRecord.execEndTime });
            } else {
              toolRecord.result = { output: result.output, metadata: result.metadata };
              toolRecord.status = "success";
              toolRecord.execEndTime = Date.now();
              toolResultContent = result.output;
              this.events.emit("tool:result", { callId: tc.id, name: tc.name, result: toolRecord.result, step, endTime: toolRecord.execEndTime });
            }
          } catch (e) {
            toolRecord.status = "error";
            if (!toolRecord.errorType) {
              // ToolValidationError 或 validate 抛出的错误视为 invalid_args
              toolRecord.errorType = (e as any)?.name === "ToolValidationError" ? "invalid_args" : "normal";
            }
            toolRecord.error = signal.aborted ? "Error: 用户已取消" : String((e as any)?.message ?? e);

            if (argsParseError && tc?.args?._argsRaw) {
              toolRecord.error += `\nrawContent: ${tc.args._argsRaw}`
            }

            toolResultContent = toolRecord.error;
            toolRecord.execEndTime = Date.now();
            this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: toolRecord.error, errorType: toolRecord.errorType, step, endTime: toolRecord.execEndTime });
          }

          toolResultMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResultContent,
            status: toolRecord.status,
            ...(toolRecord.errorType ? { errorType: toolRecord.errorType } : {}),
          });

        }

        // Doom loop 检测：以本次 iter 的全部 tool calls 为单位，在所有工具执行完后检测
        const currentIterKey = llmResult.toolCalls
          .map(tc => `${tc.name}:${JSON.stringify(tc.args)}`)
          .join("|");
        const doomCount = getDoomLoopCount(iterCallHistory, currentIterKey);
        iterCallHistory.push(currentIterKey);
        if (iterCallHistory.length > doomLoopThreshold) {
          iterCallHistory.shift();
        }
        if (doomCount >= doomLoopThreshold) {
          const firstTc = llmResult.toolCalls[0];
          this.events.emit("turn:doom", { toolName: firstTc?.name ?? "", args: firstTc?.args, count: doomCount });
          doomLoopTriggered = true;
          doomLoopInfo = { toolName: firstTc?.name ?? "", count: doomCount };
        }

        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("turn:abort", {});
          this._onTurnEnd(turn);
          return;
        }

        if (doomLoopTriggered && doomLoopInfo) {
          turn.endTime = Date.now();
          turn.status = "error";
          turn.error = `模型异常，已自动中断，可以点击重试或发送新的消息`;
          await this._saveTurnRecord(turn, persistMode);
          this.events.emit("turn:error", { error: new Error(turn.error) });
          this._onTurnEnd(turn);
          return;
        }

        tail.push(...toolResultMessages);
      }

      // 超出 maxSteps
      const lastIter = turn.iterations[turn.iterations.length - 1];
      const lastIterUsage = lastIter && !("type" in lastIter) ? (lastIter as any).usage : undefined;
      turn.endTime = Date.now();
      turn.status = "success";
      await this._saveTurnRecord(turn, persistMode);
      this.events.emit("llm:complete", { step: maxSteps, finishReason: "length", usage: lastIterUsage, done: true, endTime: turn.endTime });
      this.events.emit("turn:complete", {});
      this._onTurnEnd(turn);
    } catch (e) {
      if (turn.status === "success") {
        // 未被内层 catch 处理（如 iter 级 messages 构建、hook 等抛出的异常）
        turn.endTime = Date.now();
        turn.status = "error";
        turn.error = String((e as any)?.message ?? e);
        await this._saveTurnRecord(turn, persistMode);
        this.events.emit("turn:error", { error: e });
        this._onTurnEnd(turn);
      }
      throw e;
    }
  }

  /** 保存单个 turn：新 turn 首次保存 append，retry/续跑复用旧 turn update。 */
  private async _saveTurnRecord(turn: TurnRecord, mode: TurnPersistMode): Promise<void> {
    const { history, key } = this.options;
    if (history && key) {
      // 更新 turns 数组中的 turn
      const idx = this.turns.findIndex(t => t.id === turn.id);
      if (idx >= 0) {
        this.turns[idx] = turn;
      } else {
        this.turns.push(turn);
      }
      try {
        if (mode === "update") {
          await history.update(key, turn.id, turn);
        } else {
          await history.append(key, turn);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // 没有 history 时也要更新内存
      const idx = this.turns.findIndex(t => t.id === turn.id);
      if (idx >= 0) {
        this.turns[idx] = turn;
      } else {
        this.turns.push(turn);
      }
    }
  }

  /**
   * 发起 AI 请求（ReAct 循环）。
   *
   * 循环终止条件（对标 opencode prompt.ts）：
   *   1. 仅当 finishReason === "tool_calls" 且实际存在工具调用时继续；否则结束
   *   2. 超出 maxSteps
   *   3. Doom loop 触发（连续 doomLoopThreshold 次完全相同的工具调用）
   *   4. 用户 abort()
   *
   * @param params.mode 运行模式。
   *   - 传入时：切换 agent 到指定模式后执行（会持久化到 agent._mode）。
   *   - 不传时：默认使用 Build 模式（不继承 agent 当前 mode），适合外部直接调用的场景。
   *     如需继承当前模式，请显式传 `mode: agent.getMode()`。
   */
  async requestAI(params: RequestAIOptions): Promise<void> {
    const { message, attachments, mode = AgentModeEnum.Build, ...rest } = params;
    this.setMode(mode, "requestAI");
    const effectiveRequestMode = this.getMode();
    // 有图片附件时，自动将 aiRole 覆盖为 "image"，使请求层路由到支持视觉的模型。
    // 扩展：当前是 build 模式且无图片，但连续前置 plan 轮中携带过图片时，
    // 图片仍在历史 messages 里（受 buildProtectedAttachmentTurnIds 保护，未被 mask 清除），
    // 此时也需要路由到视觉模型，否则普通模型无法处理 image_url。
    const hasPlanHistoryImage = !attachments?.length && effectiveRequestMode === AgentModeEnum.Build
      ? (() => {
          for (let i = this.turns.length - 1; i >= 0; i--) {
            const t = this.turns[i];
            if (getTurnMode(t) === AgentModeEnum.Plan) {
              if (t.userAttachments?.some(a => a.type === "image")) return true;
            } else {
              break;
            }
          }
          return false;
        })()
      : false;
    if (attachments?.length || hasPlanHistoryImage) {
      rest.aiRole = "image";
    }

    // TODO: 临时：强制所有请求使用 aiRole=image
    // rest.aiRole = "image";
    
    // ── 格式化用户消息（在构建 TurnRecord 之前执行，格式化结果写入 turn）
    // formatUserMessage 返回 { message, attachments?, meta?, extra? }，可覆盖原始参数
    // 注意：turn.userText 保留原始 message（UI 展示用），LLM 收到的是 formattedParams.message
    let formattedParams: RequestAIOptions & Partial<FormatUserMessageResult> = { ...params, mode: effectiveRequestMode };
    if (this.options.formatUserMessage) {
      try {
        const result = await this.options.formatUserMessage(params);
        formattedParams = {
          ...params,
          mode: effectiveRequestMode,
          message: result.message,
          ...(result.attachments !== undefined ? { attachments: result.attachments } : {}),
          ...(result.meta !== undefined ? { meta: { ...params.meta, ...result.meta } } : {}),
          ...(result.extra !== undefined ? { extra: { ...params.extra, ...result.extra } } : {}),
          ...(result.sender !== undefined ? { sender: result.sender } : {}),
        };
      } catch (e) {
        console.warn("[Agent] options.formatUserMessage failed:", e);
      }
    }

    // ── 构建本轮 TurnRecord（使用格式化后的 attachments / meta / extra）
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const formattedMeta = formattedParams.meta;
    const formattedExtra = formattedParams.extra;
    const formattedAttachments = formattedParams.attachments ?? attachments ?? [];
    const userAttachments = formattedAttachments.map((a: any) => ({
      type: a.type ?? "image",
      ...(a.content !== undefined ? { content: a.content } : {}),
      ...(a.url !== undefined ? { url: a.url } : {}),
      ...(a.filename ?? a.title ? { filename: a.filename ?? a.title } : {}),
      ...(a.mime ? { mime: a.mime } : {}),
      ...(a.mediaType ? { mediaType: a.mediaType } : {}),
    }));

    const turn: TurnRecord = {
      id: turnId,
      startTime: Date.now(),
      userText: message,
      ...(formattedParams.message !== message ? { userFormattedText: formattedParams.message } : {}),
      userAttachments,
      ...(formattedMeta ? { meta: formattedMeta } : {}),
      ...(formattedExtra ? { extra: formattedExtra } : {}),
      ...(formattedParams.sender ? { sender: formattedParams.sender } : {}),
      iterations: [],
      status: "success",
    };

    this.events.emit("turn:start", {
      turnId,
      message,
      attachments: formattedParams.attachments ?? attachments,
      meta: formattedMeta,
      ...(formattedParams.sender ? { sender: formattedParams.sender } : {}),
      ...(formattedParams.message !== message ? { userFormattedText: formattedParams.message } : {}),
    });

    // 将 turn 加入内存（_runTurn 内的消息快照需要排除它，_saveTurnRecord 会更新它）
    this.turns.push(turn);

    await this._runTurn(turn, {
      userParams: { message, attachments: formattedParams.attachments ?? attachments, meta: formattedMeta, extra: formattedExtra },
      llmRest: rest,
      persistMode: "append",
    });
  }

  // ─── Fork / subAgent 基础设施 ─────────────────────────────────────────────

  /**
   * 创建一个 fork Agent 实例。
   *
   * fork 特性：
   *   - key = 随机 UUID（隔离 History 命名空间，不污染主 Agent）
   *   - history = undefined（fork 不写任何持久化记录）
   *   - events = 独立 AgentEvents 实例（外部监听器挂在主 Agent，不会收到 fork 事件）
   *   - turns = 主 Agent 当前 turns 的浅拷贝快照（支持 turnsSlice 截取）
   *   - options = 继承主 Agent options，forkOptions 可覆盖 tools
   *
   * 可用于 autoSummary、autoCompact、subAgent 等场景。
   *
   * TODO: fork 机制存在设计缺陷——ForkAgent 继承自 Agent 而非 CodeAgent。
   *   fork 出来的实例天然缺失 CodeAgent 的沙箱、插件、工具等完整上下文；
   *   目前通过把 CodeAgent 的 getAttachmentContextMessages、getStableContextMessages 等能力以闭包形式
   *   打包进 options 来变通传递，是绕路而非真正的 fork。
   *   真正的 subAgent 机制应该 fork 出一个完整的 CodeAgent 实例，需要重新设计。
   */
  createFork(forkOptions?: ForkAgentOptions): ForkAgent {
    const { turnsSlice, tools, aiRole, mask, retry, mode } = forkOptions ?? {};

    // turns + compactRecord 联动截取：
    // turnsSlice 截取后，compactRecord 游标若仍在截取范围内则保留，否则置 null
    let snapshotTurns: TurnRecord[];
    let snapshotCompactRecord: CompactRecord | null;

    if (turnsSlice != null) {
      snapshotTurns = turnsSlice.from === "start"
        ? this.turns.slice(0, turnsSlice.count)
        : this.turns.slice(-turnsSlice.count);

      // compactRecord 游标 turn 必须存在于截取后的 turns 中才有效
      const compactStillValid =
        this.compactRecord != null &&
        snapshotTurns.some((t) => t.id === this.compactRecord!.upToTurnId);
      snapshotCompactRecord = compactStillValid ? this.compactRecord : null;
    } else {
      snapshotTurns = [...this.turns];
      snapshotCompactRecord = this.compactRecord; // 全量继承
    }

    // options 继承 + 覆盖
    const { system } = forkOptions ?? {};
    const forkAgentOptions: AgentOptions = {
      ...this.options,
      // 使用原始 request，让 fork 的 retry 覆盖真正生效，避免继承父 Agent 已包装的 retry。
      request: this.rawRequest,
      key: randomUUID(),     // 随机隔离 key
      history: undefined,    // fork 不写历史
      // tools：不传=继承父；传了（含 []）则覆盖
      ...(forkOptions && "tools" in forkOptions ? { tools } : {}),
      // system：不传=继承父；传了则覆盖
      ...(system !== undefined ? { system } : {}),
      // mode：不传=继承父 Agent 当前模式；传了则覆盖
      mode: mode !== undefined ? mode : this.getMode(),
      // mask：不传=继承父；传了（含 false）则覆盖
      ...(mask !== undefined ? { mask } : {}),
      // retry：不传=继承父；传了则覆盖（false 或具体配置）
      ...(retry !== undefined ? { retry: retry === false ? { maxRetries: 0 } : retry } : {}),
      // fork 是 worker agent，不需要计划模式
      disabledModes: [AgentModeEnum.Plan],
      // fork 不注入随消息携带的动态上下文（模式说明、skills 等），getAttachmentContextMessages 是 CodeAgent 的箭头函数，this 永远指向父实例，无法感知 fork 的 disabledModes
      getAttachmentContextMessages: undefined,
      // fork 强制关闭 summary/compact，防止 summary fork / compact fork 再递归创建 fork。
      summary: { enabled: false },
      compact: { enabled: false },
      // fork 不继承 hooks，避免父级 beforeTurn / afterTurn 在快照任务中重复执行。
      hooks: undefined,
    };

    // 使用 ForkAgent 构造，传入 aiRole
    const fork = new ForkAgent(forkAgentOptions, aiRole);
    fork.turns = snapshotTurns;
    fork.compactRecord = snapshotCompactRecord;
    return fork;
  }

  /**
   * 创建一个 SubAgent 实例（基于 fork 机制）。
   *
   * 与 createFork 的差异：
   *   - 强制 maxSteps: 1（不允许多次 ReAct 轮询）
   *   - 强制 tools: []（不允许工具调用）
   *   - 支持通过 ForkAgentOptions 覆盖 system / tools / aiRole
   *   - 全量继承父 turns 历史
   */
  createSubAgent(config: ForkAgentOptions): ForkAgent {
    const baseTools = config.tools ?? (this.options.tools ?? []);
    const tools = baseTools.filter((t: Tool) => t.name !== CALL_SUB_AGENT_TOOL_NAME);
    return this.createFork({
      tools,
      ...(config.system !== undefined ? { system: config.system } : {}),
      ...(config.aiRole !== undefined ? { aiRole: config.aiRole } : {}),
    });
  }

  // ─── 内部 after-turn 钩子 ────────────────────────────────────────────────

  /**
   * turn 结束后的统一后处理（fire-and-forget）。
   * 在所有出口（success / abort / error）调用，失败只 log，不影响主流程。
   *
   * - hooks.afterTurn：全出口触发
   * - summary / compact：仅 success 触发
   */
  private _onTurnEnd(turn: TurnRecord): void {
    // 用户 hook：全出口触发
    void Promise.resolve(this.options.hooks?.afterTurn?.(turn)).catch((e) => {
      console.warn("[Agent] hooks.afterTurn failed:", e);
    });

    if (turn.status !== "success") return;

    const { summary, compact } = this.options;

    if (summary?.enabled && !hasNoToolCalls(turn.iterations)) {
      void this._runAutoSummary(turn).catch((e) => {
        console.warn("[Agent] summary failed:", e);
      });
    }

    if (compact != null && compact.enabled !== false) {
      if (this._shouldAutoCompact()) {
        void this._runAutoCompact();
      }
    }
  }

  // ─── autoSummary ─────────────────────────────────────────────────────────

  /**
   * fork 一个 Agent，为本轮对话生成摘要，写入 TurnRecord.summary。
   * best-effort：异步执行，调用方用 .catch() 静默失败。
   */
  private async _runAutoSummary(turn: TurnRecord): Promise<void> {
    const suggestionsEnabled = this.options.summary?.suggestions !== false;
    // ── 任务1：生成总结 ───────────────────────────────────────────────────────
    const TASK_SUMMARY = `${suggestionsEnabled ? "2" : "1"}. 生成一份总结
<总结生成规则>
用 1-3 句话对本轮对话进行总结，内容用 <summary></summary> 标签包裹。
关注点：做了什么有效的事情。

比如
<summary>
修改整体为卡通风格
1. 将卡片的风格改成了卡通风格，涉及对卡片的样式代码和结构进行修改；
2. 将字体调整至卡通风格字体；
</summary>

</总结生成规则>`;

    // ── 任务2：可延续对话摘要 ─────────────────────────────────────────────────
    const TASK_HANDOFF = `${suggestionsEnabled ? "3" : "2"}. 为后续对话生成一份「可延续对话摘要」。目标是让另一个 agent 读完这份摘要后，能无缝接手并继续当前工作。

<可延续对话摘要生成规则>
请基于下方对话历史，严格按照以下模板输出（保留二级标题与结构，只填写各节内容），并将整份摘要用 <handoff></handoff> 标签包裹：

<handoff>
## 目标

[用户想要达成的目标是什么？用 1～2 句话说明。]

## 重要指示

- [用户给出的、与任务相关的重要指示]
- [若有计划或规格说明，简要概括，便于下一 agent 按此继续]

## 关键发现

[对话过程中发现的重要信息、结论或约束，对后续 agent 继续工作有帮助的内容]

## 完成情况

[已完成的工作、进行中的工作、以及尚未完成/待办的工作]

## 相关文件

[与任务相关的文件或目录列表：已读、已编辑或已创建的文件；若某目录下文件都相关，可只写目录路径。保持结构化、便于查找。]
</handoff>

要求：
1. 信息完整、准确，便于下一 agent 理解上下文并继续执行。
2. 语言精炼，避免重复；相关文件尽量列出真实路径或文件名。
3. 直接输出上述模板的填写结果，不要额外解释。

</可延续对话摘要生成规则>`;

    // ── 任务3：建议选项（可选，由 suggestions.enabled 控制） ──────────────────
    // TODO: 在此处填写 suggestions 的提示词。
    // 格式要求：LLM 判断需求是否完成，若未完成则输出如下格式的 <ask> 块，完成时不输出：
    //
    // <ask>
    // <desc>对这组建议的说明（可选）</desc>
    // <option>建议选项1</option>
    // <option>建议选项2</option>
    // </ask>
    const TASK_SUGGESTIONS = suggestionsEnabled ? `
1. 根据本轮的模型输出和操作内容，判断是否要生成「下一步建议选项」
<下一步建议选项生成规则>
建议的内容格式为一句话 + 3个及以下的选项指令，内容用 <ask></ask> 标签包裹。

只在满足以下任一情况时输出 <ask>
1. 本轮需求出现异常/未完成情况，没有完成既定目标，也没有告知用户未完成的原因或者询问；
否则不要输出 <ask>

注意：所有建议需要和本轮对话有高度相关性，不允许揣测，关注执行情况，基于既定的事实和记录，提供建议。
1. 基于事实：基于执行情况，禁止揣测操作什么命令控制台、校验服务，根本没有这个能力；
2. 易于理解：option 的内容必须清晰，必须是一个描述清晰的需求，这个指令会作为下一步的指令给到用户；

重要：宁可不推荐，也不要推荐不合理的建议！

输出格式：
<ask>
  <desc>一句话说明为什么建议这些下一步</desc>
  <option>可直接发送的用户指令 1</option>
  <option>可直接发送的用户指令 2</option>
</ask>

比如：内容异常，并没有完成
<ask>
  <desc>发现本轮任务异常结束了，可以选择继续让模型操作</desc>
  <option>继续完成刚才未做完的部分</option>
</ask>
注意：任务异常结束，只有一个建议选项，就是继续完成。

比如：发现当前还有部分需求没有实现
<ask>
  <desc>文本大小已经调整完毕，但是距离完成目标建议处理下溢出情况</desc>
  <option>继续实现下文本溢出功能</option>
</ask>

比如：发现需要用户提供材料、或者选择方案才能继续进行，不要提供建议，输出里已经有对用户的询问内容了。

</下一步建议选项生成规则>
` : "";

    const taskCount = suggestionsEnabled ? "三" : "两";
    const SUMMARY_PROMPT = `IMPORTANT: 不要调用工具！
你有${taskCount}个任务

${suggestionsEnabled ? `${TASK_SUGGESTIONS}\n\n` : ""}${TASK_SUMMARY}

${TASK_HANDOFF}
IMPORTANT: 不要调用工具！
`;

    const fork = this.createFork({ tools: [], turnsSlice: { from: "end", count: 1 }, retry: { maxRetries: 0 } });
    (fork as any).options.getAttachmentContextMessages = undefined;
    (fork as any).options.formatUserMessage = undefined;

    let lastContent = "";
    let suggestionsResult: TurnRecord["suggestions"] | undefined;
    const { history, key } = this.options;

    const parseSuggestions = (content: string): TurnRecord["suggestions"] | undefined => {
      try {
        const askMatch = content.match(/<ask\b[^>]*>([\s\S]*?)<\/ask>/i);
        if (!askMatch) return undefined;

        const inner = askMatch[1];
        // <desc> 可选；[\s\S]*? 兼容换行/缩进等各种 LLM 输出格式
        const descMatch = inner.match(/<desc\b[^>]*>([\s\S]*?)<\/desc>/i);
        const desc = descMatch?.[1].trim();
        // 不使用 matchAll + spread：低编译目标下 iterator spread 可能被转成按 length 展开，导致结果为空。
        const options: string[] = [];
        const optionRe = /<option\b[^>]*>([\s\S]*?)<\/option>/gi;
        let optionMatch: RegExpExecArray | null;
        while ((optionMatch = optionRe.exec(inner)) !== null) {
          const option = optionMatch[1].trim();
          if (option) options.push(option);
        }

        if (options.length === 0) return undefined;
        return { options, ...(desc ? { desc } : {}) };
      } catch (e) {
        console.warn("[Agent] suggestions parse failed:", e);
        return undefined;
      }
    };

    const emitSuggestionsOnce = (suggestions: TurnRecord["suggestions"]) => {
      if (!suggestions) return;
      if (suggestionsResult) return;
      suggestionsResult = suggestions;
      turn.suggestions = suggestions;

      if (history && key) {
        void history.update(key, turn.id, { suggestions }).catch((e) => {
          console.warn("[Agent] suggestions history update failed:", e);
        });
      }

      this.events.emit("turn:suggestions", { turnId: turn.id, suggestions });
    };

    fork.events.on("llm:content", ({ content }) => {
      lastContent = content;
      if (!suggestionsEnabled || suggestionsResult || !content.includes("</ask>")) return;
      const suggestions = parseSuggestions(content);
      if (suggestions) emitSuggestionsOnce(suggestions);
    });

    try {
      await fork.requestAI({ message: SUMMARY_PROMPT });
    } finally {
      // 清除 fork 引用，释放 turns / events 等资源
      fork.turns = [];
      fork.events.removeAllListeners();
    }

    if (!lastContent) return;

    // 解析 <summary>...</summary>
    const summaryMatch = lastContent.match(/<summary>([\s\S]*?)<\/summary>/);
    const summaryText = summaryMatch?.[1].trim() ?? "";

    // 解析 <handoff>...</handoff>（可延续对话摘要）
    const handoffMatch = lastContent.match(/<handoff>([\s\S]*?)<\/handoff>/);
    const handoffText = handoffMatch?.[1].trim() ?? "";

    // 兜底：若 streaming 阶段没来得及解析，完整返回后再解析一次。
    if (suggestionsEnabled && !suggestionsResult) {
      const suggestions = parseSuggestions(lastContent);
      if (suggestions) emitSuggestionsOnce(suggestions);
    }

    if (!summaryText && !handoffText && !suggestionsResult) return;

    if (summaryText) turn.summary = summaryText;
    if (handoffText) turn.handoff = handoffText;
    if (suggestionsResult) turn.suggestions = suggestionsResult;

    if (history && key) {
      await history.update(key, turn.id, {
        ...(summaryText ? { summary: summaryText } : {}),
        ...(handoffText ? { handoff: handoffText } : {}),
        ...(suggestionsResult ? { suggestions: suggestionsResult } : {}),
      });
    }

    void Promise.resolve(this.options.hooks?.afterTurnSummary?.(turn, summaryText)).catch((e) => {
      console.warn("[Agent] hooks.afterTurnSummary failed:", e);
    });
  }

  // ─── warmup ─────────────────────────────────────────────────────────────

  /**
   * warmup 阶段：在 iter 级 messages 构建之前执行预处理步骤。
   * 
   * 目前包含 compact 压缩，未来可扩展其他预处理步骤。
   * 所有步骤共享同一个 WarmupIter，错误在各步骤内部消化，不向外抛出。
   * 
   * @returns true 表示用户取消，调用方应 return；false 表示继续主流程
   */
  private async _runWarmup(turn: TurnRecord, signal: AbortSignal, persistMode: TurnPersistMode): Promise<boolean> {
    // 判断是否需要执行任何 warmup 步骤
    const needCompact = this._shouldAutoCompact() && !this._isAlreadyCompacted();
    if (!needCompact) return false;

    const warmupStartTime = Date.now();
    const warmupIter: WarmupIter = {
      type: "warmup",
      status: "loading",
      content: "当前正在压缩上下文...",
      startTime: warmupStartTime,
      toolCalls: [],
    };
    turn.iterations.push(warmupIter);
    this.events.emit("warmup:start", { startTime: warmupStartTime, content: warmupIter.content });

    // ── compact 步骤（错误内部消化）
    if (needCompact) {
      const onRetry = (attempt: number) => {
        warmupIter.content = `正在尝试其他策略进行压缩，第 ${attempt} 次重试…`;
        this.events.emit("warmup:content", { content: warmupIter.content });
      };
      const compactOk = await this._runAutoCompact(signal, true, onRetry);
      if (!compactOk) {
        // compact 重试全部失败，以 error 终止本轮 turn
        const errorMsg = "上下文压缩失败，请重试或者点击上方清空历史记录";
        warmupIter.status = "error";
        warmupIter.content = errorMsg;
        warmupIter.endTime = Date.now();
        this.events.emit("warmup:complete", { status: "error", content: errorMsg, endTime: warmupIter.endTime });
        turn.endTime = warmupIter.endTime;
        turn.status = "error";
        turn.error = errorMsg;
        await this._saveTurnRecord(turn, persistMode);
        this.events.emit("turn:error", { error: new Error(errorMsg) });
        this._onTurnEnd(turn);
        return true;
      }
    }

    // 统一处理取消
    if (signal.aborted) {
      const warmupEndTime = Date.now();
      warmupIter.status = "error";
      warmupIter.content = "已取消";
      warmupIter.endTime = warmupEndTime;
      this.events.emit("warmup:complete", { status: "error", content: warmupIter.content, endTime: warmupEndTime });
      turn.endTime = warmupEndTime;
      turn.status = "abort";
      await this._saveTurnRecord(turn, persistMode);
      this.events.emit("turn:abort", {});
      this._onTurnEnd(turn);
      return true;
    }

    // ── 未来可在此添加更多 warmup 步骤 ──

    // warmup 全部成功
    const warmupEndTime = Date.now();
    warmupIter.status = "success";
    warmupIter.content = "上下文压缩完成。";
    warmupIter.endTime = warmupEndTime;
    this.events.emit("warmup:complete", { status: "success", content: warmupIter.content, endTime: warmupEndTime });
    return false;
  }

  // ─── autoCompact ─────────────────────────────────────────────────────────

  /**
   * 判断是否需要触发 autoCompact。
   * 优先通过 token 阈值（promptTokens）判断；usage 缺失时降级为轮次判断。
   * 注意 turnsToMessages 会保留 error / abort 轮次，失败轮次同样可能携带大量上下文。
   */
  private _shouldAutoCompact(): boolean {
    const cfg = this.options.compact;
    if (!cfg || cfg.enabled === false) return false;

    let contextTurnCount = 0;
    let lastUsage: TokenUsage | undefined;
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const turn = this.turns[i];
      if (this.compactRecord && turn.id === this.compactRecord.upToTurnId) break;
      if (turn.retried) continue;
      contextTurnCount++;
      if (!lastUsage) {
        // 从最后一个有效 LLM iter 取 usage（跳过 warmup、无 usage 的 iter）
        for (let j = turn.iterations.length - 1; j >= 0; j--) {
          const iter = turn.iterations[j];
          if (!("type" in iter) && (iter as any).usage) {
            lastUsage = (iter as any).usage;
            break;
          }
        }
      }
    }
    if (contextTurnCount === 0) return false;

    // 优先：token 阈值判断
    const rawPromptTokens = lastUsage?.promptTokens;
    const promptTokens = rawPromptTokens != null ? Number(rawPromptTokens) : NaN;
    if (!isNaN(promptTokens) && promptTokens > 0) {
      const contextWindow = cfg.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
      // 阈值 = (contextWindow - 预留输出) - 缓冲区
      const threshold = contextWindow - COMPACT_RESERVE_OUTPUT - COMPACT_BUFFER;
      // const pct = ((promptTokens / threshold) * 100).toFixed(1);
      // const remaining = threshold - promptTokens;
      // console.log(
      //   `[Agent] 上下文占比: ${pct}% (${promptTokens} / ${threshold})，距阈值还剩 ${remaining} tokens`
      // );
      return promptTokens >= threshold;
    }

    // 降级：轮次判断
    const maxTurns = cfg.maxTurns ?? 15;
    return contextTurnCount > maxTurns;
  }

  /**
   * 判断 compactRecord 是否已覆盖了本 turn 之前的所有 turns（即前置无需重复压缩）。
   * compact 永远不压缩当前正在执行的 turn（this.turns 最后一项），
   * 因此判据是：compactRecord.upToTurnId === 倒数第二个 turn 的 id。
   */
  private _isAlreadyCompacted(): boolean {
    if (!this.compactRecord) return false;
    // this.turns 最后一个是当前正在执行的 turn，倒数第二个才是上一轮
    const prevTurn = this.turns[this.turns.length - 2];
    if (!prevTurn) return true; // 没有历史 turn，无需 compact
    return this.compactRecord.upToTurnId === prevTurn.id;
  }

  /** 获取 compact 可见历史；正在执行中的当前 turn 不参与压缩。 */
  private _getCompactSourceTurns(): TurnRecord[] {
    const lastTurn = this.turns[this.turns.length - 1];
    if (lastTurn && lastTurn.endTime == null) {
      return this.turns.slice(0, -1);
    }
    return this.turns;
  }

  /**
   * 执行 autoCompact：fork 一个无工具 Agent 对所有历史生成完整摘要，
   * 将摘要以 CompactRecord 形式单独存储到 History（不替换 turns）。
   * iter 级 messages 构建时会读取 compactRecord，用游标分割历史：
   *   游标前（含）→ 替换为摘要消息；游标后 → 正常展开。
   *
   * 错误在内部消化，不向外抛出。返回 true 表示成功，false 表示失败/取消。
   *
   * @param signal       - AbortSignal，用于监听用户取消操作
   * @param enableRetry  - 是否启用重试（前置 warmup 时传 true；后置 fire-and-forget 传 false）
   * @param onRetry      - 重试时的回调，用于更新 warmup content（仅 enableRetry=true 时有意义）
   */
  private async _runAutoCompact(
    signal?: AbortSignal,
    enableRetry = false,
    onRetry?: (attempt: number) => void,
  ): Promise<boolean> {
    const COMPACT_PROMPT =
      "你的任务是创建一份详细的对话总结，重点关注用户的明确请求和你之前的操作。这份总结应全面涵盖技术细节、代码模式和架构决策，这些内容对于后续的开发工作至关重要，同时又不丢失上下文。\n" +
      "请对上方完整的对话历史进行总结，用 <compact></compact> 标签包裹内容。\n" +
      "总结将替代原有对话历史，请确保内容足够详细，以便对话可以连贯继续。不要使用工具。\n";

    const EXAMPLE_PROMPT = `可参考示例如下，其中括号中的内容代表需要填空替换的内容。
<example>

<compact>
1. 主要需求和意图：
  [描述]

2. 关键技术概念：
- [概念 1]
- [概念 2]
- [...]

3. 文件和代码块：
- [File Name 1]
  - [该文件重要性概述]
  - [该文件更改概述（如有）]
  - [重要代码片段]
- [File Name 2]
  - [重要代码片段]
- [...]

4. 错误和修复情况：
- [错误 1 ​​的详细描述]
  - [您如何修复此错误]
  - [用户对此错误的反馈（如有）]
- [...]

5. 问题解决情况：
[已解决问题的描述和正在进行的故障排除]

6. 所有用户需求：
- [非工具使用相关的用户需求详情]
- [...]

7. 待处理的任务列表：
- [任务 1]
- [任务 2]
- [...]

8.当前工作：
[当前工作的详细描述]

9. 可选的下一步：
[可选的下一步行动]
</compact>

</example>`;

    const compactSourceTurns = this._getCompactSourceTurns();
    const totalTurns = compactSourceTurns.length;
    if (totalTurns === 0) return false;

    const MAX_RETRY = enableRetry ? 3 : 0;

    // 从 compactRecord 游标之后开始，只压缩尚未压缩的新增 turns。
    // compactedIndex：游标 turn 在本次 compact 可见历史中的索引；-1 表示无 compactRecord。
    const compactedIndex = this.compactRecord
      ? compactSourceTurns.findIndex((t) => t.id === this.compactRecord!.upToTurnId)
      : -1;
    // startFromIndex：新增部分的起始索引（游标之后第一个 turn）
    const startFromIndex = compactedIndex + 1;
    // newTurnsCount：待压缩的 turn 数量（二分在此区间内收缩）
    const newTurnsCount = totalTurns - startFromIndex;
    if (newTurnsCount <= 0) return false;

    let low = 1;
    let high = newTurnsCount;
    // 优先尝试全量；若失败，再在可行区间内二分寻找最大可压缩范围。
    let firstNewTurns = newTurnsCount;
    let bestCompactRecord: CompactRecord | null = null;

    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      if (attempt > 0) {
        onRetry?.(attempt);
      }

      // turnsSlice 绝对数量 = 游标前已有部分 + 本次要压缩的新增部分
      const sliceCount = startFromIndex + firstNewTurns;
      // 游标 = fork 实际看到的最后一条 turn 的 id（与 fork 视野严格对齐）
      const forkTurns = compactSourceTurns.slice(0, sliceCount);
      const upToTurnId = forkTurns[forkTurns.length - 1].id;

      // fork 继承 compactRecord（由 createFork 联动处理：游标在截取范围内则保留）
      const fork = this.createFork({ tools: [], mask: false, retry: { maxRetries: 0 }, turnsSlice: { from: "start", count: sliceCount } });
      (fork as any).options.getAttachmentContextMessages = undefined;
      (fork as any).options.formatUserMessage = undefined;

      // 监听 signal，取消时同步中断 fork
      let abortHandler: (() => void) | undefined;
      if (signal) {
        abortHandler = () => fork.abort();
        signal.addEventListener("abort", abortHandler);
      }

      let lastContent = "";
      fork.events.on("llm:content", ({ content }) => { lastContent = content; });

      let apiOk = true;
      try {
        await fork.requestAI({ message: COMPACT_PROMPT + EXAMPLE_PROMPT });
      } catch (e) {
        apiOk = false;
        console.warn(`[Agent] autoCompact requestAI failed (attempt ${attempt}):`, e);
      } finally {
        if (abortHandler && signal) signal.removeEventListener("abort", abortHandler);
        // 清除 fork 引用，释放 turns / events 等资源
        fork.turns = [];
        fork.events.removeAllListeners();
      }

      if (signal?.aborted) return false;

      const shrinkRange = () => {
        high = firstNewTurns - 1;
        if (low > high) return false;
        firstNewTurns = Math.floor((low + high) / 2);
        return true;
      };

      if (!apiOk || !lastContent) {
        // 场景A：接口报错或空返回 → 缩小右边界，下次尝试更短历史
        const canContinue = shrinkRange();
        if (!canContinue) break;
        continue;
      }

      // 解析 <compact>...</compact> 标签内容
      const match = lastContent.match(/<compact>([\s\S]*?)<\/compact>/);
      const compactText = match?.[1]?.trim();
      if (!compactText) {
        // 场景B：未按标签返回。可能不是长度问题，保持相同 firstTurns 重试。
        console.warn(`[Agent] autoCompact missing/empty <compact> tag (attempt ${attempt})`);
        continue;
      }

      // 成功，先记录当前最大成功结果；若还不是全量，继续向右扩大尝试。
      bestCompactRecord = {
        upToTurnId,
        content: compactText,
        createdAt: Date.now(),
      };

      if (firstNewTurns >= newTurnsCount) break;

      low = firstNewTurns + 1;
      if (low > high) break;
      firstNewTurns = Math.floor((low + high) / 2);
    }

    if (bestCompactRecord) {
      this.compactRecord = bestCompactRecord;

      // 持久化到 History 的独立存储槽
      const { history, key } = this.options;
      if (history && key) {
        try {
          await history.saveCompact(key, bestCompactRecord);
        } catch (e) {
          console.warn("[Agent] autoCompact saveCompact failed:", e);
          // 持久化失败不影响内存缓存，继续
        }
      }
      return true;
    }

    return false;
  }
}

/**
 * ForkAgent 是 Agent 的子类，用于 fork 出的独立 Agent 实例。
 * 核心差异：requestAI 时会自动带上创建时指定的 aiRole。
 */
export class ForkAgent extends Agent {
  private _forkAiRole?: string;

  constructor(options: AgentOptions, aiRole?: string) {
    super(options);
    this._forkAiRole = aiRole;
  }

  /**
   * 重写 requestAI，自动注入 fork 时指定的 aiRole。
   */
  async requestAI(params: RequestAIOptions): Promise<void> {
    const { message, attachments, mode, ...rest } = params;
    // 有图片附件时，自动将 aiRole 覆盖为 "image"
    if (attachments?.length) {
      rest.aiRole = "image";
    } else if (this._forkAiRole) {
      // 否则使用 fork 时指定的 aiRole
      rest.aiRole = this._forkAiRole;
    }
    return super.requestAI({ message, attachments, ...(mode !== undefined ? { mode } : {}), ...rest });
  }
}
