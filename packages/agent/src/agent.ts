import { randomUUID } from "./uuid";
import type { RequestAsStreamFn, ToolDescriptor } from "../../request/src";
import { AgentEvents } from "./events";
import type { CompactRecord, Message, History, Tool, TurnRecord, ToolCallRecord, BoundHistory, TokenUsage, WarmupIter, TurnSender } from "./types";
import { turnsToMessages, bindHistory, getLLMIterations } from "./types";
import { maskMessages, computeHandoffTurnIds, type MaskOptions } from "./mask";
import { wrapRequestWithRetry, type RetryOptions } from "./retry";

export { AgentEvents };
export type { Message, History, Tool, TurnRecord, ToolCallRecord, WarmupIter };
export type { CompactRecord, MaskOptions, BoundHistory };

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

// ─── ToolExecutionContext ─────────────────────────────────────────────────────

/**
 * 工具执行时的运行时上下文，由 Agent 在调用工具前构造并传入。
 * 工具可通过此上下文获取本轮 turn 的历史信息，用于重复调用检测等策略判断。
 */
export interface ToolExecutionContext {
  /** 当前 turn 的唯一 ID */
  turnId: string;
  /**
   * 当前 turn 到此刻为止的迭代记录（只读快照）。
   * 供工具自行做重试/重复调用检测等策略判断。
   */
  iterations: ReadonlyArray<TurnRecord["iterations"][number]>;
  /** 获取当前 turn 的用户消息（message + attachments） */
  getUserMessage: () => { message: string; attachments?: any[] };
  /** 获取当前 Agent 实例 */
  getAgent: () => Agent;
  /** 读取当前 turn 后续 step 使用的 aiRole（未指定时返回 undefined） */
  getAiRole: () => string | undefined;
  /**
   * 设置后续 step 使用的 aiRole（仅当前 turn 生效）。
   * 传空字符串或 undefined 可清空，恢复默认路由。
   */
  setAiRole: (aiRole?: string) => void;
  /**
   * 发送工具流式进度更新（用于长时间运行的工具）。
   * 触发 tool:progress 事件，UI 层可据此实时更新工具卡片状态。
   *
   * @param data 自定义进度数据，由工具定义结构（如 SubAgent 可传递子 agent 的流式输出）
   */
  emitProgress: (data: any) => void;
}

// ─── AgentHooks ──────────────────────────────────────────────────────────────

export interface AgentHooks {
  /**
   * 用户发送消息后、一轮 turn 开始时的钩子，在 buildMessages 之前调用。
   * 可用于初始化快照、收集日志等准备工作。
   */
  beforeTurn?: (params: { message: string; attachments: any[] }) => Promise<void> | void;
  /**
   * 每次 LLM 请求前触发（每个 step 都会调用）。
   * 可用于动态修改请求参数、注入上下文等。
   */
  beforeRequest?: (params: { meta?: any }) => Promise<void> | void;
  /**
   * 每轮 turn 结束后的钩子（无论成功、取消还是错误）。
   * 在 turn:complete / turn:abort / turn:error 事件触发后同步调用。
   * 可用于记录日志、上报埋点等收尾工作。
   */
  afterTurn?: (turn: TurnRecord) => Promise<void> | void;
  /**
   * 本轮 turn 的 summary 生成完成后的钩子（仅 summary.enabled=true 且成功生成时触发）。
   */
  afterTurnSummary?: (turn: TurnRecord, summary: string) => Promise<void> | void;
}

// ─── AgentOptions ─────────────────────────────────────────────────────────────

export interface AgentOptions {
  /** 系统 prompt */
  system?: string;
  /**
   * agents.md：项目规范/规则文档。
   *
   * 对标 claude-code 的 CLAUDE.md 机制：
   *   - claude-code 从文件系统遍历加载 CLAUDE.md，通过 prependUserContext 以
   *     第一条 user 消息（包裹在 <system-reminder> 中）注入到每轮对话。
   *   - 此处采用相同方式：agentsMd 不追加到 system prompt，而是作为独立的
   *     user 消息插在历史记录之前，LLM 会将其视为背景上下文而非强制指令。
   *
   * 由 plugin 初始化时由调用方以字符串方式传入。
   */
  agentsMd?: string;
  /**
   * 动态上下文注入（异步）。
   * 每次请求前调用，返回的消息列表会插入到对话历史末尾、用户消息之前。
   */
  getContextMessages?: () => Promise<Message[]>;
  /**
   * @experimental
   * 实时上下文注入（异步）。
  * 每个 step 请求前调用，返回的消息列表插入在用户消息之后、本轮已积累的
  * assistant/tool 消息（tail）之前，使 LLM 在每次推理前都能感知到最新的运行时状态。
   * 不参与 prompt cache，适合高频变化的状态（如当前资源代码、运行时快照等）。
   */
  getRealtimeMessages?: () => Promise<Message[]>;
  /**
   * @experimental
   * 用户自定义上下文注入（异步）。
   * 每个 turn 开始时调用，返回的消息列表插入在用户消息之前，
   * 适合注入用户自定义的背景信息。
   * - 返回字符串数组：每个元素构造为一条独立的 user 消息注入。
   */
  getUserContextMessages?: () => Promise<Message[]>;
  /** 工具列表（plugin 初始化时注册额外工具） */
  tools?: Tool[];
  /** 历史记录实现 */
  history?: History;
  /** 流式请求函数 */
  request: RequestAsStreamFn;
  /** Agent key（用于历史记录隔离，通常取 comId） */
  key?: string;
  /**
   * ReAct 循环最大 step 数（防止无限循环）。
   * 对标 opencode 的 agent.steps，默认 Infinity（不限制）。
   * 每次 LLM 响应 + 工具执行算一个 step。
   */
  maxSteps?: number;
  /**
   * Doom loop 检测阈值：连续多少次相同工具+参数视为死循环，触发 turn:doom 事件。
   * 默认 3，对标 opencode 的 DOOM_LOOP_THRESHOLD。
   * 触发后中断循环，以当前状态 complete。
   */
  doomLoopThreshold?: number;
  /**
   * 历史消息遮蔽配置。
   * 满足轮次或时间条件的历史 turn，其工具调用结果消息会被替换为占位符，
   * 用户附件也会被替换为文字占位符，以减少发给 LLM 的 token 量。
   * 不传则不遮蔽。
   */
  mask?: MaskOptions | false;
  /**
   * 生命周期 hooks。
   */
  hooks?: AgentHooks;
  /**
   * 摘要配置（best-effort，失败只 log 不影响主流程）。
   * 每个 turn:complete 后异步 fork 一个 Agent，生成本轮摘要并写入 TurnRecord.summary。
   */
  summary?: {
    /** 是否启用自动摘要，默认 true（未传 summary 配置时） */
    enabled: boolean;
  };
  /**
   * compact 配置。
   * 触发条件：优先通过 token 阈值判断（需 usage 字段有值）；usage 缺失时降级为轮次判断。
   * 触发时机：双时机策略——
   *   1. turn 结束后异步（fire-and-forget），尽早完成压缩
   *   2. requestAI 前同步阻塞（buildMessages 之前），确保 compactRecord 最新
   *      若后置已压缩好（compactRecord 游标覆盖最新 success turn），前置直接跳过
   */
  compact?: {
    /** 是否启用自动 compact，默认 true */
    enabled?: boolean;
    /**
     * 模型上下文窗口大小（token 数），用于计算 compact 触发阈值。
     * 阈值 = contextWindow - 20000（预留输出）- 13000（缓冲区）
     * 默认 200,000
     */
    contextWindow?: number;
    /**
     * usage 不可用时的降级：超过多少轮成功 turn 时触发 compact。
     * 默认 15
     */
    maxTurns?: number;
  };
  /**
   * 用户消息格式化函数（异步）。
   * 在 turn 开始时、buildBaseMessages 之前调用，对用户输入进行后处理。
   * 入参：requestAI 的完整参数（message、attachments、meta?）。
   * 出参：处理后的 { message, attachments, meta }，可用于注入 focus 上下文等。
   */
  formatUserMessage?: (params: RequestAIOptions) => Promise<FormatUserMessageResult> | FormatUserMessageResult;
  /**
   * 重试配置（用于网络瞬时故障自动重试）。
   * 只要 emits.error 被调用就重试，不做额外的错误类型判断。
   */
  retry?: RetryOptions;
}

/** formatUserMessage 的返回值类型 */
export interface FormatUserMessageResult {
  message: string;
  attachments?: any[];
  meta?: Record<string, any>;
  sender?: TurnSender;
}

// ─── ForkOptions ─────────────────────────────────────────────────────────────

/**
 * fork 配置项。
 * fork 出的 Agent 是完全独立的实例（随机 key、独立 events、不写 History），
 * 可作为 subAgent 基础设施或 autoSummary / autoCompact 的底层机制。
 */
export interface ForkOptions {
  /**
   * 截取 turns 快照的配置。
   * - 不传：全量复制当前 turns
   * - `{ from: "end", count: N }`：取最后 N 轮（适用于 autoSummary 等只需近期历史的场景）
   * - `{ from: "start", count: N }`：取前 N 轮（适用于 autoCompact 二分重试等从历史开头压缩的场景）
   */
  turnsSlice?: { from: "start" | "end"; count: number };
  /**
   * 覆盖工具列表。
   * - 不传（undefined）：继承父 Agent 的 tools
   * - 传 []：无工具（LLM 直接返回文本，适合摘要场景）
   * - 传具体列表：替换为指定工具（适合 subAgent 场景）
   */
  tools?: Tool[];
  /**
   * 覆盖系统 prompt。
   * 不传则继承父 Agent 的 system。
   */
  system?: string;
  /**
   * 覆盖遮蔽配置。
   * - 不传（undefined）：继承父 Agent 的 mask
   * - 传 false：关闭遮蔽（适合 compact 场景，需要看到完整历史）
   * - 传具体配置：使用指定遮蔽参数
   */
  mask?: MaskOptions | false;
  /**
   * 覆盖重试配置。
   * - 不传（undefined）：继承父 Agent 的 retry
   * - 传 false 或 { maxRetries: 0 }：禁用重试
   * - 传具体配置：使用指定重试参数
   */
  retry?: RetryOptions | false;
}

// ─── ForkAgent ────────────────────────────────────────────────────────────────

export interface RequestAIOptions {
  message: string;
  attachments?: any[];
  /** UI 附加元数据，存入 TurnRecord.meta，不参与 LLM 上下文构建 */
  meta?: Record<string, any>;
  [key: string]: any;
}

// ─── 构建消息列表 ──────────────────────────────────────────────────────────────

/**
 * 构建本轮请求的基础 messages（在 turn 开始时调用一次）：
 *   [0]       system message（仅包含内置系统提示词）
 *   [1]       agentsMd user message（仅当 agentsMd 非空时存在）
 *   [2]       动态上下文（getContextMessages，仅在 turn 开始时调用一次）
 *   [3..4]    compact 摘要消息对（仅当有 compactRecord 时）
 *   [5..N]    历史对话（从 TurnRecord[] 重建，compact 游标后的部分）
 *
 * 后续每个 step 会在这些基础上追加用户消息和本轮对话尾部（assistant + tool）。
 */
async function buildMessages(
  options: AgentOptions,
  turns: TurnRecord[],
  compactRecord?: CompactRecord | null
): Promise<{ baseMessages: Message[]; historyStartIndex: number }> {
  const { system, agentsMd, getContextMessages } = options;

  const systemMessage: Message | null = system
    ? { role: "system", content: system }
    : null;

  // agentsMd 以独立 user 消息注入，对标 claude-code 的 prependUserContext 机制：
  // 包裹在 <system-reminder> 中，告知 LLM 此上下文可能与当前任务相关或无关。
  const agentsMdMessage: Message | null = agentsMd
    ? {
        role: "user",
        content:
          `<system-reminder>\n` +
          `As you answer the user's questions, you can use the following context:\n` +
          `# agents.md\n${agentsMd}\n\n` +
          `IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n` +
          `</system-reminder>`,
      }
    : null;

  // 动态上下文（仅在 turn 开始时调用一次，放在静态前缀之后、历史对话之前）
  const contextMessages: Message[] = getContextMessages
    ? await getContextMessages()
    : [];

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
    ? computeHandoffTurnIds(turns, options.mask)
    : new Set<string>();

  const historyMessages = turnsToMessages(turns, compactRecord, handoffTurnIds);

  // ── prompt cache 断点 ────────────────────────────────────────────────────
  // 断点 1：system message 单独打 cache（几乎不变，命中率最高）
  const cachedSystemMessage: Message | null = systemMessage
    ? { ...systemMessage, cache: true }
    : null;

  // 断点 2：agentsMd + context + compact 最后一条打 cache
  const staticRest: Message[] = [
    ...(agentsMdMessage ? [agentsMdMessage] : []),
    ...contextMessages,
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

  // historyStartIndex：assembled 数组中，静态前缀（system/agentsMd/context/compact）之后的起始索引
  // mask 时只对 index >= historyStartIndex 的消息做遮蔽，前缀不受影响
  const historyStartIndex = (systemMessage ? 1 : 0) + (agentsMdMessage ? 1 : 0) + contextMessages.length + compactMessages.length;

  return { baseMessages, historyStartIndex };
}

/**
 * 每次 LLM 请求前组装完整 messages 列表：
 *   baseMessages（静态前缀 + 动态上下文 + 历史）+ 用户上下文消息 + 用户消息 + 本轮已积累的对话尾部 + 实时消息
 *
 * @param baseMessages       assembleBaseMessages 返回的基础部分
 * @param historyStartIndex  assembled 数组中历史消息的起始索引（mask 时跳过静态前缀）
 * @param options            AgentOptions
 * @param turns              当前 turns 快照（用于 mask）
 * @param params             本轮用户请求参数
 * @param tail               本轮已积累的 assistant + tool 消息（step > 1 时非空）
 * @param userContextMessages  用户自定义上下文消息，插入在用户消息之前（@experimental）
 * @param realtimeMessages   每 step 实时获取的消息，插入在 tail 末尾（@experimental）
 */
function assembleMessages(
  baseMessages: Message[],
  historyStartIndex: number,
  options: AgentOptions,
  turns: TurnRecord[],
  params: RequestAIOptions,
  tail: Message[],
  userContextMessages: Message[],
  realtimeMessages: Message[]
): Message[] {
  const { message, attachments } = params;

  let userContent: Message["content"] = message;
  if (attachments?.length) {
    userContent = [
      { type: "text", text: message },
      ...attachments.map((a: any) => ({
        type: "image_url",
        image_url: { url: a.url ?? a.content },
      })),
    ];
  }
  const userMessage: Message = { role: "user", content: userContent };

  // userContextMessages 放在 userMessage 之前
  // realtimeMessages 放在 tail 末尾，模拟工具调用返回最新代码仓库信息
  const assembled = [...baseMessages, ...userContextMessages, userMessage, ...tail, ...realtimeMessages];

  // ── prompt cache 断点 3：排除 realtimeMessages 后的最后一条消息 ──────────────
  // tail 非空时最后一条为 role: "tool"，空时为 userMessage (role: "user")
  // role: "assistant" 不加 cache（工具调用响应消息不是断点）
  const cacheTargetIndex = baseMessages.length + userContextMessages.length + tail.length;
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
    const maskedRest = maskMessages(rest, turns, maskOpts);
    return [...prefix, ...maskedRest];
  }

  return assembled;
}

// ─── 构建工具描述列表 ──────────────────────────────────────────────────────────

function buildToolDescriptors(tools?: Tool[]): ToolDescriptor[] | undefined {
  return tools?.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

// ─── 单次 LLM 请求结果 ─────────────────────────────────────────────────────────

interface LLMCallResult {
  content: string;
  thinkingContent: string;
  toolCalls: Array<{ id: string; name: string; args: any }>;
  /**
   * LLM 本次停止原因（来自 finish_reason）。
   * - "stop"       正常结束
   * - "tool_calls" 有工具调用需继续
   * - "length"     token 超限
   * - "unknown"    未知 / 模型未返回
   */
  finishReason: string;
  usage?: any;
  aborted: boolean;
}


function callLLM(
  options: AgentOptions,
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
    let toolCalls: Array<{ id: string; name: string; args: any }> = [];
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
          // 流式接口：indexToCallInfo 已累积完整参数字符串，用它作为主路径：
          //   先将字面量 \\uXXXX 还原为真正的 Unicode 字符，再 JSON.parse。
          //   无参数工具（累积串为空/空白/"{}"）直接给 {}。
          //   parse 失败则回退用网络层已解析的 args。
          // 非流式接口：indexToCallInfo 为空，直接沿用网络层已解析好的 args。
          if (indexToCallInfo.size > 0) {
            toolCalls = calls.map((call) => {
              const info = [...indexToCallInfo.values()].find(
                (v) => v.callId === call.id
              );
              if (!info) return call;
              const raw = info.argsRaw.trim();
              if (!raw || raw === "{}") return { ...call, args: {} };
              try {
                const fixed = raw.replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) => {
                  const result = String.fromCharCode(parseInt(hex, 16));
                  return result;
                });
                return { ...call, args: JSON.parse(fixed) };
              } catch (parseErr) {
                return { ...call, args: { _argsParseError: true, _argsRaw: raw, _parseErrMsg: String((parseErr as any)?.message ?? parseErr) } };
              }
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
 * 检查最近 N 次工具调用历史中是否有连续相同的调用。
 * 遍历整个历史（所有 steps），找出针对某个工具的最近连续相同 args 序列长度。
 */
function getDoomLoopCount(
  toolHistory: Array<{ name: string; argsKey: string }>,
  toolName: string,
  argsKey: string
): number {
  let count = 0;
  // 从最新往前找连续匹配
  for (let i = toolHistory.length - 1; i >= 0; i--) {
    const entry = toolHistory[i];
    if (entry.name === toolName && entry.argsKey === argsKey) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class Agent {
  readonly events = new AgentEvents();
  readonly key: string | undefined;
  protected options: AgentOptions;
  /** 历史调用记录（SSE 事件粒度），从 History 加载，每轮 complete/abort/error 后 append */
  protected turns: TurnRecord[] = [];
  /**
   * compact 记录缓存（从 History 加载）。
   * buildMessages 时传给 turnsToMessages，用于游标分割历史。
   */
  protected compactRecord: CompactRecord | null = null;
  private _abortController: AbortController | null = null;

  constructor(options: AgentOptions) {
    // 仅在调用方”未声明该字段”时注入默认值；
    // 若调用方显式传入 summary/compact（即便是 undefined），按原值保留。
    const hasSummary = Object.prototype.hasOwnProperty.call(options, "summary");
    const hasCompact = Object.prototype.hasOwnProperty.call(options, "compact");
    const hasRetry = Object.prototype.hasOwnProperty.call(options, "retry");

    const retryOpts = hasRetry ? (options.retry ?? DEFAULT_RETRY) : DEFAULT_RETRY;

    this.options = {
      ...options,
      request: wrapRequestWithRetry(options.request, retryOpts, this.events),
      ...(hasSummary ? {} : { summary: DEFAULT_SUMMARY }),
      ...(hasCompact ? {} : { compact: DEFAULT_COMPACT }),
      ...(hasRetry ? {} : { retry: retryOpts }),
    };
    this.key = options.key;
  }

  /** 加载历史调用记录（同时加载 compact 记录） */
  async loadHistory(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) {
      this.turns = await history.load(key);
      this.compactRecord = await history.loadCompact(key);
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
    const turn = this.turns.find(t => t.id === turnId);
    if (!turn || turn.status !== "error") {
      return;
    }

    // 第一步失败（无 LLM iter）：打 retried 标记，不再参与消息构建，重新发起请求
    if (getLLMIterations(turn.iterations).length === 0) {
      turn.retried = true;
      await this._persistTurn(turn);
      await this.requestAI({
        message: turn.userText,
        attachments: turn.userAttachments,
        meta: turn.meta,
      });
      return;
    }

    // 中途失败：从失败点继续执行
    await this._continueFromError(turn);
  }

  /** 从失败的 turn 继续执行 */
  private async _continueFromError(turn: TurnRecord): Promise<void> {
    // retry 续跑：把当前失败 turn 从历史中排除（它将被续跑替代，不能带入上下文）
    const turnsWithoutRetried = this.turns.filter(t => t.id !== turn.id);
    const context = await buildMessages(this.options, turnsWithoutRetried, this.compactRecord);

    // 从 iterations 重建 tail，跳过 warmup iter（无 LLM 内容，不参与消息重建）
    const initialTail: Message[] = [];
    const llmIters = getLLMIterations(turn.iterations);
    for (const iter of llmIters) {
      const assistantMsg: Message = {
        role: "assistant",
        content: iter.content,
        ...(iter.thinkingContent ? { reasoning_content: iter.thinkingContent } : {}),
        tool_calls: iter.toolCalls.map(tc => ({
          id: tc.callId,
          type: "function" as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.args) },
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

    // 重置状态
    turn.status = "success";
    turn.error = undefined;

    this.events.emit("turn:resume", { turnId: turn.id });

    // 从失败点继续执行（startStep 只计 LLM iter 数量，不含 warmup iter）
    await this._runReActLoop({
      context,
      initialTail,
      startStep: llmIters.length + 1,
      turn,
      userParams: { message: turn.userText, attachments: turn.userAttachments, meta: turn.meta },
    });
  }

  /** ReAct 循环核心逻辑（requestAI 和 retry 共用） */
  private async _runReActLoop(opts: {
    /** buildMessages 的返回值，包含基础消息和前缀数量 */
    context: { baseMessages: Message[]; historyStartIndex: number };
    /** 初始 tail：从已有 iterations 重建的 assistant+tool 消息序列（全新请求传 []） */
    initialTail: Message[];
    /** 本次循环从第几步开始（全新请求传 1，retry 续传则传失败前的步数 + 1） */
    startStep: number;
    /** 当前 turn 记录（用于写入迭代结果、持久化） */
    turn: TurnRecord;
    /** 用户侧消息参数（message、attachments、meta），用于组装消息和 turn:start 事件 */
    userParams: { message: string; attachments?: any[]; meta?: any };
    /** 透传给 callLLM 的其余参数（aiRole 等） */
    llmRest?: Record<string, any>;
  }): Promise<void> {
    const { context: { baseMessages, historyStartIndex }, initialTail, startStep, turn, userParams, llmRest = {} } = opts;
    // 复用 requestAI 中创建的 AbortController（已确保 warmup 阶段也能取消）
    const signal = this._abortController!.signal;
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

    const { key, history } = this.options;
    const maxSteps = this.options.maxSteps ?? 50;
    const doomLoopThreshold = this.options.doomLoopThreshold ?? 3;

    // 获取 formattedParams（如果需要）
    const formattedParams = turn.userFormattedText
      ? { ...userParams, message: turn.userFormattedText }
      : userParams;

    const tail = [...initialTail];
    const toolCallHistory: Array<{ name: string; argsKey: string }> = [];

    // @experimental 用户上下文消息：每 turn 获取一次，放在用户消息之前
    const userContextMessages: Message[] = this.options.getUserContextMessages
      ? await this.options.getUserContextMessages()
      : [];

    // 收集已有工具调用历史（用于 doom loop 检测）
    for (const iter of getLLMIterations(turn.iterations)) {
      for (const tc of iter.toolCalls) {
        toolCallHistory.push({ name: tc.name, argsKey: JSON.stringify(tc.args) });
      }
    }

    try {
      for (let step = startStep; step <= maxSteps; step++) {
        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._persistTurn(turn);
          this.events.emit("turn:abort", {});
          this._onTurnEnd(turn);
          return;
        }

        const llmIterations = getLLMIterations(turn.iterations);
        const stepLLMStartTime = step === startStep && llmIterations.length === 0
          ? turn.startTime
          : Date.now();

        if (step > startStep || llmIterations.length === 0) {
          this.events.emit("llm:start", { step, startTime: stepLLMStartTime });
        }

        // 执行 beforeRequest hook
        try {
          await this.options.hooks?.beforeRequest?.({
            meta: userParams.meta,
          });
        } catch (e) {
          console.warn("[Agent] hooks.beforeRequest failed:", e);
        }

        // @experimental 实时消息：每 step 获取最新值，追加在 tail 末尾
        const realtimeMessages: Message[] = this.options.getRealtimeMessages
          ? await this.options.getRealtimeMessages()
          : [];

        // 组装 messages
        const messages = assembleMessages(
          baseMessages,
          historyStartIndex,
          this.options,
          this.turns,
          formattedParams,
          tail,
          userContextMessages,
          realtimeMessages
        );

        // 调用 LLM
        const { rest: stepLLMRest, effectiveAiRole } = buildStepLLMRest();
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
          await this._persistTurn(turn);
          this.events.emit("turn:error", { error: e });
          this._onTurnEnd(turn);
          throw e;
        }

        if (llmResult.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._persistTurn(turn);
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
          ...(llmResult.usage ? { usage: llmResult.usage } : {}),
        };
        turn.iterations.push(currentIter);
        turn.thinkingContent += llmResult.thinkingContent;
        if (llmResult.usage) turn.usage = llmResult.usage;

        // 判断是否终止：只有存在实际工具调用时才继续循环
        const hasToolCalls = llmResult.toolCalls.length > 0;
        const shouldContinueWithTools = hasToolCalls;
        const modelFinished = !shouldContinueWithTools;
        if (modelFinished) {
          turn.content = llmResult.content;
          turn.endTime = iterEndTime;
          turn.status = "success";
          await this._persistTurn(turn);
          this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: turn.usage, done: true, endTime: turn.endTime });
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
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
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

          // Doom loop 检测
          const argsKey = JSON.stringify(tc.args);
          toolCallHistory.push({ name: tc.name, argsKey });
          const doomCount = getDoomLoopCount(toolCallHistory, tc.name, argsKey);
          if (doomCount > doomLoopThreshold) {
            this.events.emit("turn:doom", { toolName: tc.name, args: tc.args, count: doomCount });
            doomLoopTriggered = true;
            doomLoopInfo = { toolName: tc.name, count: doomCount };
            break;
          }

          const tool = this.options.tools?.find(t => t.name === tc.name);
          const execStartTime = Date.now();
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
          this.events.emit("tool:call", { callId: tc.id, name: tc.name, args: tc.args, step, startTime: execStartTime });

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
            emitProgress: (data: any) => {
              this.events.emit("tool:progress", { callId: tc.id, name: tc.name, data, step });
            },
          };

          // TODO: 兼容 LLM 返回未解码 \uXXXX 字面量或无效 JSON 的情况
          // if (tc.args?._argsParseError) {
          //   const raw = tc.args._argsRaw ?? "";
          //   const err = new Error(
          //     `Invalid JSON in tool arguments for "${tc.name}". ` +
          //     `Raw content: ${raw.slice(0, 200)}${raw.length > 200 ? "…" : ""}. ` +
          //     `Please re-issue the tool call with valid JSON arguments.`
          //   );
          //   toolRecord.status = "error";
          //   toolRecord.error = err.message;
          //   toolRecord.execEndTime = Date.now();
          //   toolResultContent = `Error: ${err.message}`;
          //   this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: err, step, endTime: toolRecord.execEndTime });
          // } else
          if (tc.args?._argsParseError) {
            const raw: string = tc.args._argsRaw ?? "";
            const parseErrMsg: string = tc.args._parseErrMsg ?? "unknown parse error";
            const err = new Error(
              `Tool "${tc.name}" received invalid JSON arguments: ${parseErrMsg}. ` +
              `Raw content: ${raw} ` +
              `Please re-issue the tool call with valid JSON arguments.`
            );
            toolRecord.args = { _argsRaw: raw };
            toolRecord.status = "error";
            toolRecord.error = err.message;
            toolRecord.execEndTime = Date.now();
            toolResultContent = `Error: ${err.message}`;
            this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: err, step, endTime: toolRecord.execEndTime });
          } else if (!tool) {
            const err = new Error(`Tool not found: ${tc.name}`);
            toolRecord.status = "error";
            toolRecord.error = err.message;
            toolRecord.execEndTime = Date.now();
            toolResultContent = `Error: ${err.message}`;
            this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: err, step, endTime: toolRecord.execEndTime });
          } else {
            try {
              tool.validate?.(tc.args, toolContext);
              const result = await tool.execute(tc.args, toolContext);
              if (signal.aborted) {
                toolRecord.status = "error";
                toolRecord.error = "用户已取消";
                toolRecord.execEndTime = Date.now();
                toolResultContent = `Error: 用户已取消`;
                this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: "用户已取消", step, endTime: toolRecord.execEndTime });
              } else {
                toolRecord.result = { output: result.output, metadata: result.metadata };
                toolRecord.status = "success";
                toolRecord.execEndTime = Date.now();
                toolResultContent = result.output;
                this.events.emit("tool:result", { callId: tc.id, name: tc.name, result: toolRecord.result, step, endTime: toolRecord.execEndTime });
              }
            } catch (e) {
              toolRecord.status = "error";
              toolRecord.error = signal.aborted ? "用户已取消" : String((e as any)?.message ?? e);
              toolRecord.execEndTime = Date.now();
              toolResultContent = `Error: ${toolRecord.error}`;
              this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: e, step, endTime: toolRecord.execEndTime });
            }
          }

          toolResultMessages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResultContent,
          });
        }

        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await this._persistTurn(turn);
          this.events.emit("turn:abort", {});
          this._onTurnEnd(turn);
          return;
        }

        if (doomLoopTriggered && doomLoopInfo) {
          const lastIter = turn.iterations[turn.iterations.length - 1];
          turn.content = lastIter?.content ?? "";
          turn.endTime = Date.now();
          turn.status = "error";
          turn.error = `连续调用，已自动中断，可重新发起消息`;
          await this._persistTurn(turn);
          this.events.emit("turn:error", { error: new Error(turn.error) });
          this._onTurnEnd(turn);
          return;
        }

        tail.push(...toolResultMessages);
      }

      // 超出 maxSteps
      const lastIter = turn.iterations[turn.iterations.length - 1];
      turn.content = lastIter?.content ?? "";
      turn.endTime = Date.now();
      turn.status = "success";
      await this._persistTurn(turn);
      this.events.emit("llm:complete", { step: maxSteps, finishReason: "length", usage: turn.usage, done: true, endTime: turn.endTime });
      this.events.emit("turn:complete", {});
      this._onTurnEnd(turn);
    } catch (e) {
      if (turn.status === "success") {
        // 未被内层 catch 处理（如 buildMessages、hook 等抛出的异常）
        turn.endTime = Date.now();
        turn.status = "error";
        turn.error = String((e as any)?.message ?? e);
        await this._persistTurn(turn);
        this.events.emit("turn:error", { error: e });
        this._onTurnEnd(turn);
      }
      throw e;
    }
  }

  /** 持久化单个 turn */
  private async _persistTurn(turn: TurnRecord): Promise<void> {
    const { history, key } = this.options;
    if (history && key) {
      // 更新 turns 数组中的 turn
      const idx = this.turns.findIndex(t => t.id === turn.id);
      if (idx >= 0) {
        this.turns[idx] = turn;
      } else {
        this.turns.push(turn);
      }
      await history.append(key, turn).catch(console.error);
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
   */
  async requestAI(params: RequestAIOptions): Promise<void> {
    const { message, attachments, ...rest } = params;
    // 有图片附件时，自动将 aiRole 覆盖为 "image"，使请求层路由到支持视觉的模型
    if (attachments?.length) {
      rest.aiRole = "image";
    }

    // TODO: 临时：强制所有请求使用 aiRole=image
    // rest.aiRole = "image";
    
    // ── 提前创建 AbortController（确保 warmup 阶段也能取消）
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    
    // ── 格式化用户消息（在构建 TurnRecord 之前执行，格式化结果写入 turn）
    // formatUserMessage 返回 { message, attachments?, meta? }，可覆盖原始参数
    // 注意：turn.userText 保留原始 message（UI 展示用），LLM 收到的是 formattedParams.message
    let formattedParams = params;
    if (this.options.formatUserMessage) {
      try {
        const result = await this.options.formatUserMessage(params);
        formattedParams = {
          ...params,
          message: result.message,
          ...(result.attachments !== undefined ? { attachments: result.attachments } : {}),
          ...(result.meta !== undefined ? { meta: { ...params.meta, ...result.meta } } : {}),
          ...(result.sender !== undefined ? { sender: result.sender } : {}),
        };
      } catch (e) {
        console.warn("[Agent] options.formatUserMessage failed:", e);
      }
    }

    // ── 构建本轮 TurnRecord（使用格式化后的 attachments / meta）
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const formattedMeta = formattedParams.meta;
    const formattedAttachments = formattedParams.attachments ?? attachments ?? [];
    const userAttachments = formattedAttachments.map((a: any) => ({
      type: a.type ?? "image",
      content: a.url ?? a.content ?? "",
    }));

    const turn: TurnRecord = {
      id: turnId,
      startTime: Date.now(),
      userText: message,
      ...(formattedParams.message !== message ? { userFormattedText: formattedParams.message } : {}),
      userAttachments,
      ...(formattedMeta ? { meta: formattedMeta } : {}),
      ...(formattedParams.sender ? { sender: formattedParams.sender } : {}),
      content: "",
      thinkingContent: "",
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

    // ── 执行 beforeTurn hook（在 buildMessages 之前，确保快照时机正确）
    try {
      await this.options.hooks?.beforeTurn?.({ message, attachments: attachments ?? [] });
    } catch (e) {
      console.warn("[Agent] hooks.beforeTurn failed:", e);
    }

    // ── warmup 阶段（buildMessages 之前执行）
    const warmupAborted = await this._runWarmup(turn, signal);
    if (warmupAborted) return;

    // 构建基础 messages（system + agentsMd + context + compact + history），每轮 turn 只算一次
    let context: { baseMessages: Message[]; historyStartIndex: number };
    try {
      context = await buildMessages(this.options, this.turns, this.compactRecord);
    } catch (e) {
      // buildMessages 失败时也要持久化 turn
      turn.endTime = Date.now();
      turn.status = "error";
      turn.error = String((e as any)?.message ?? e);
      await this._persistTurn(turn);
      this.events.emit("turn:error", { error: e });
      this._onTurnEnd(turn);
      throw e;
    }

    // 调用共用的 ReAct 循环逻辑
    await this._runReActLoop({
      context,
      initialTail: [],
      startStep: 1,
      turn,
      userParams: { message, attachments: formattedParams.attachments ?? attachments, meta: formattedMeta },
      llmRest: rest,
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
   */
  createFork(forkOptions?: ForkAgentOptions): ForkAgent {
    const { turnsSlice, tools, aiRole, mask, retry } = forkOptions ?? {};

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
      key: randomUUID(),     // 随机隔离 key
      history: undefined,    // fork 不写历史
      // tools：不传=继承父；传了（含 []）则覆盖
      ...(forkOptions && "tools" in forkOptions ? { tools } : {}),
      // system：不传=继承父；传了则覆盖
      ...(system !== undefined ? { system } : {}),
      // mask：不传=继承父；传了（含 false）则覆盖
      ...(mask !== undefined ? { mask } : {}),
      // retry：不传=继承父；传了则覆盖（false 或具体配置）
      ...(retry !== undefined ? { retry: retry === false ? { maxRetries: 0 } : retry } : {}),
      // fork 强制关闭 summary/compact，防止递归 fork
      summary: { enabled: false },
      compact: { enabled: false },
      // fork 不继承 beforeTurn / beforeRequest hook（快照启动，无需初始化）
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
   *   - 支持通过 SubAgentConfig 覆盖 system
   *   - 全量继承父 turns 历史
   */
  createSubAgent(config: import("./sub-agent").SubAgentConfig): ForkAgent {
    const fork = this.createFork({
      tools: [],
      ...(config.system !== undefined ? { system: config.system } : {}),
      ...(config.aiRole !== undefined ? { aiRole: config.aiRole } : {}),
    });
    (fork as any).options.maxSteps = 1;
    return fork;
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

    if (summary?.enabled) {
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
    const SUMMARY_PROMPT = `IMPORTANT: 不要调用工具！
你有两个任务

1. 生成一份总结
<总结生成规则>
用 1-3 句话对本轮对话进行总结，内容用 <summary></summary> 标签包裹。
关注点：做了什么有效的事情。

比如
<summary>
修改整体为卡通风格
1. 将卡片的风格改成了卡通风格，涉及对卡片的样式代码和结构进行修改；
2. 将字体调整至卡通风格字体；
</summary>

</总结生成规则>

2. 为后续对话生成一份「可延续对话摘要」。目标是让另一个 agent 读完这份摘要后，能无缝接手并继续当前工作。

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

</可延续对话摘要生成规则>

IMPORTANT: 不要调用工具！
`;
    const fork = this.createFork({ tools: [], turnsSlice: { from: "end", count: 1 }, retry: { maxRetries: 0 } });
    (fork as any).options.getUserContextMessages = undefined;
    (fork as any).options.formatUserMessage = undefined;

    let lastContent = "";
    fork.events.on("llm:content", ({ content }) => {
      lastContent = content;
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

    if (!summaryText && !handoffText) return;

    if (summaryText) turn.summary = summaryText;
    if (handoffText) turn.handoff = handoffText;

    const { history, key } = this.options;
    if (history && key) {
      await history.update(key, turn.id, {
        ...(summaryText ? { summary: summaryText } : {}),
        ...(handoffText ? { handoff: handoffText } : {}),
      });
    }

    void Promise.resolve(this.options.hooks?.afterTurnSummary?.(turn, summaryText)).catch((e) => {
      console.warn("[Agent] hooks.afterTurnSummary failed:", e);
    });
  }

  // ─── warmup ─────────────────────────────────────────────────────────────

  /**
   * warmup 阶段：在 buildMessages 之前执行预处理步骤。
   * 
   * 目前包含 compact 压缩，未来可扩展其他预处理步骤。
   * 所有步骤共享同一个 WarmupIter，错误在各步骤内部消化，不向外抛出。
   * 
   * @returns true 表示用户取消，调用方应 return；false 表示继续主流程
   */
  private async _runWarmup(turn: TurnRecord, signal: AbortSignal): Promise<boolean> {
    // 判断是否需要执行任何 warmup 步骤
    const needCompact = this._shouldAutoCompact() && !this._isAlreadyCompacted();
    if (!needCompact) return false;

    const warmupStartTime = Date.now();
    const warmupIter: WarmupIter = {
      type: "warmup",
      status: "loading",
      content: "启动中，当前正在压缩上下文...",
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
        await this._persistTurn(turn);
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
      await this._persistTurn(turn);
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
   */
  private _shouldAutoCompact(): boolean {
    const cfg = this.options.compact;
    if (!cfg || cfg.enabled === false) return false;

    const successTurns = this.turns.filter((t) => t.status === "success");

    // 优先：token 阈值判断
    const lastUsage = [...successTurns].reverse().find((t) => t.usage)?.usage;
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
    return successTurns.length > maxTurns;
  }

  /**
   * 判断 compactRecord 是否已覆盖当前所有 success turns（即后置已压缩好）。
   * 依据：compactRecord.upToTurnId === 最新 success turn 的 id
   */
  private _isAlreadyCompacted(): boolean {
    if (!this.compactRecord) return false;
    const lastTurn = this.turns[this.turns.length - 1];
    if (!lastTurn) return false;
    return this.compactRecord.upToTurnId === lastTurn.id;
  }

  /**
   * 执行 autoCompact：fork 一个无工具 Agent 对所有历史生成完整摘要，
   * 将摘要以 CompactRecord 形式单独存储到 History（不替换 turns）。
   * buildMessages 时会读取 compactRecord，用游标分割历史：
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

    const totalTurns = this.turns.length;
    if (totalTurns === 0) return false;

    const MAX_RETRY = enableRetry ? 3 : 0;

    // 从 compactRecord 游标之后开始，只压缩尚未压缩的新增 turns。
    // compactedIndex：游标 turn 在 this.turns 中的索引；-1 表示无 compactRecord。
    const compactedIndex = this.compactRecord
      ? this.turns.findIndex((t) => t.id === this.compactRecord!.upToTurnId)
      : -1;
    // startFromIndex：新增部分的起始索引（游标之后第一个 turn）
    const startFromIndex = compactedIndex + 1;
    // newTurnsCount：待压缩的 turn 数量（二分在此区间内收缩）
    const newTurnsCount = totalTurns - startFromIndex;
    if (newTurnsCount <= 0) return false;

    // firstTurns：传给 turnsSlice 的绝对数量（含游标前），二分时只缩减新增部分
    let firstNewTurns = newTurnsCount;

    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      if (attempt > 0) {
        onRetry?.(attempt);
      }

      // turnsSlice 绝对数量 = 游标前已有部分 + 本次要压缩的新增部分
      const sliceCount = startFromIndex + firstNewTurns;
      // 游标 = fork 实际看到的最后一条 turn 的 id（与 fork 视野严格对齐）
      const forkTurns = this.turns.slice(0, sliceCount);
      const upToTurnId = forkTurns[forkTurns.length - 1].id;

      // fork 继承 compactRecord（由 createFork 联动处理：游标在截取范围内则保留）
      const fork = this.createFork({ tools: [], mask: false, retry: { maxRetries: 0 }, turnsSlice: { from: "start", count: sliceCount } });
      (fork as any).options.getUserContextMessages = undefined;
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

      if (!apiOk || !lastContent) {
        // 场景A：接口报错或空返回 → 二分缩减新增区间，下次历史更短
        firstNewTurns = Math.max(1, Math.floor(firstNewTurns / 2));
        continue;
      }

      // 解析 <compact>...</compact> 标签内容
      const match = lastContent.match(/<compact>([\s\S]*?)<\/compact>/);
      const compactText = match?.[1]?.trim();
      if (!compactText) {
        // 场景B：未按标签返回 → 保持相同 firstTurns 重试
        console.warn(`[Agent] autoCompact missing/empty <compact> tag (attempt ${attempt})`);
        continue;
      }

      // 成功，写 compactRecord（upToTurnId 与本次 fork 视野严格对齐）
      const compactRecord: CompactRecord = {
        upToTurnId,
        content: compactText,
        createdAt: Date.now(),
      };

      this.compactRecord = compactRecord;

      // 持久化到 History 的独立存储槽
      const { history, key } = this.options;
      if (history && key) {
        try {
          await history.saveCompact(key, compactRecord);
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

// ─── ForkAgent ────────────────────────────────────────────────────────────────

/**
 * ForkAgent 配置项。
 * 继承 ForkOptions，额外支持 aiRole 用于指定模型角色。
 */
export interface ForkAgentOptions extends ForkOptions {
  /**
   * 指定 aiRole（模型角色），如 "image" 表示使用支持视觉的模型。
   */
  aiRole?: string;
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
    const { message, attachments, ...rest } = params;
    // 有图片附件时，自动将 aiRole 覆盖为 "image"
    if (attachments?.length) {
      rest.aiRole = "image";
    } else if (this._forkAiRole) {
      // 否则使用 fork 时指定的 aiRole
      rest.aiRole = this._forkAiRole;
    }
    return super.requestAI({ message, attachments, ...rest });
  }
}
