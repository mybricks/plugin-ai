import type { RequestAsStreamFn } from "./request";
import type { Agent } from "../agent";
import type { HandoffOptions } from "../handoff";
import type { MaskOptions } from "../mask";
import type { RetryOptions } from "../retry";
import type {
  AgentMode,
  BoundHistory,
  CompactRecord,
  History,
  Message,
  TokenUsage,
  Tool,
  ToolCallRecord,
  TurnRecord,
  TurnSender,
  WarmupIter,
} from "./index";

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
  /** 读取当前 turn 后续 step 显式设置的 aiRole；未设置时请求层会兜底为 "default"。 */
  getAiRole: () => string | undefined;
  /**
   * 设置后续 step 使用的 aiRole（仅当前 turn 生效）。
   * 传空字符串或 undefined 可清空，恢复默认路由。
   */
  setAiRole: (aiRole?: string) => void;
  /** 当前工具执行时的 Agent 模式 */
  mode: AgentMode;
  /** 当前 turn 的取消信号；可传给可取消的外部操作。 */
  signal: AbortSignal;
  /** 读取 Agent 当前模式 */
  getMode: () => AgentMode;
  /** 切换 Agent 当前模式 */
  setMode: (mode: AgentMode, reason?: string) => void;
  /**
   * 发送工具流式进度更新（用于长时间运行的工具）。
   * 触发 tool:progress 事件，UI 层可据此实时更新工具卡片状态。
   *
   * @param data 自定义进度数据，由工具定义结构（如 SubAgent 可传递子 agent 的流式输出）
   */
  emitProgress: (data: any) => void;
  /**
   * 等待当前工具卡片通过 Agent 持有的运行期通道回传数据。
   */
  waitUIRender?: <T>() => Promise<T | null>;
}

// ─── AgentHooks ──────────────────────────────────────────────────────────────

/** 自动摘要任务的最终结果。 */
export type TurnSummaryResult =
  | { status: "success"; versionId?: string }
  | { status: "error"; error: unknown };

export interface AgentHooks {
  /**
   * 用户发送消息后、一轮 turn 开始时的钩子，在构建 turn 级消息快照之前调用。
   * 可用于初始化快照、收集日志等准备工作。
   */
  beforeTurn?: (params: {
    /** 原始用户输入，用于 UI 展示和历史记录 */
    message: string;
    /** 经过 chip format / formatUserMessage 后，实际发送给 LLM 的用户文本 */
    formattedMessage: string;
    attachments: any[];
    meta?: any;
    extra?: Record<string, any>;
  }) => Promise<void> | void;
  /**
   * 每次 LLM 请求前触发（每个 step 都会调用）。
   * 可用于动态修改请求参数、注入上下文等。
   * 返回 `additionalMessages` 时，这些消息会在本次 LLM 请求前追加到 tail。
   */
  beforeRequest?: (params: { meta?: any; extra?: Record<string, any> }) => Promise<{
    additionalMessages?: Message[];
  } | void> | { additionalMessages?: Message[] } | void;
  /**
   * 每轮 turn 结束后的钩子（无论成功、取消还是错误）。
   * 在 turn:complete / turn:abort / turn:error 事件触发后同步调用。
   * 可用于记录日志、上报埋点等收尾工作。
   */
  afterTurn?: (turn: TurnRecord) => Promise<void> | void;
  /**
   * 本轮 turn 的 summary 任务结束后的钩子（仅 summary.enabled=true 时触发）。
   *
   * 前两个参数保持既有兼容性：成功但无可解析摘要时 summary 为空字符串。
   * 第三个参数用于区分成功与失败；远端成功事件可额外携带 versionId。
   * 失败时 summary 为空字符串。
   */
  afterTurnSummary?: (
    turn: TurnRecord,
    summary: string,
    result?: TurnSummaryResult,
  ) => Promise<void> | void;
  /**
   * 成功 turn 的全部后台后处理结束后的钩子。
   * 此时 summary / compact 均已完成（无论 summary 成功或失败）。
   */
  afterTurnSettled?: (turn: TurnRecord) => Promise<void> | void;
}

// ─── MessageSection ───────────────────────────────────────────────────────────

/**
 * 单个提示词段落（字符串）。
 * 多个段落组成 MessageSection[] 后，join("\n\n") 拼接为一条 role: "user" 消息注入到 LLM 上下文。
 * 用于 getAttachmentContextMessages 等需要组合多段提示词的场景。
 */
export type MessageSection = string;

// ─── AgentOptions ─────────────────────────────────────────────────────────────

export interface AgentOptions {
  /** 系统 prompt */
  system?: string;
  /**
   * 初始运行模式。
   * - build：智能模式，允许直接修改
   * - plan：计划模式，先制定方案，方案通过后再操作
   */
  mode?: AgentMode;
  /** 禁用的运行模式；当只剩一种可用模式时不会注册模式切换工具。 */
  disabledModes?: AgentMode[];
  /**
   * 静态背景上下文注入（异步）。
   * 每个 turn 开始时获取一次，返回的消息列表插入到历史对话之前（静态前缀层），
   * 适合注入几乎不变的背景信息（如开发规范、设计风格）。
   * 享受 prompt cache 断点，命中率较高。
   */
  getStableContextMessages?: () => Promise<Message[]>;
  /**
   * 随消息携带的动态上下文注入（异步，带模式上下文）。
   * 每个 turn 开始时获取一次，返回的字符串数组会拼接为一条 user 消息插在用户消息正前方，
   * 适合注入每轮可能变化的上下文（如当前项目文件快照、模式提示词、skills 列表等）。
   *
   * ctx 提供当前模式信息，调用方可在此自行组装模式提示词、skill 列表等所有环境内容。
   */
  getAttachmentContextMessages?: (ctx: {
    mode: AgentMode;
    previousMode: AgentMode | null;
  }) => MessageSection[] | Promise<MessageSection[]>;
  /** 工具列表（plugin 初始化时注册额外工具） */
  tools?: Tool[];
  /** 历史记录实现 */
  history?: History;
  /** 流式请求函数 */
  request?: RequestAsStreamFn;
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
   * 当前 iter 执行完成后，如果此前已有阈值次数的连续相同工具调用序列，则中断为 error。
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
   * 历史消息 handoff 配置。
   * 启用后，带有 turn.handoff 的历史轮次会替换为 userText + handoff。
   * 默认不启用。
   */
  handoff?: HandoffOptions | false;
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
    /**
     * 是否启用建议选项（best-effort，依赖 summary.enabled 为 true）。
     * 在 autoSummary fork 的同一次 LLM 调用中，让 LLM 判断需求是否完成；
     * 若未完成则输出 <ask> 块，解析后写入 TurnRecord.suggestions。
     * 前端只在最后一条 turn 上展示，用户发下一轮消息后自然消失。
     * 默认 false。
     */
    suggestions?: boolean;
  };
  /**
   * compact 配置。
   * 触发条件：优先通过 token 阈值判断（需 usage 字段有值）；usage 缺失时降级为轮次判断。
   * 触发时机：双时机策略——
   *   1. turn 结束后异步（fire-and-forget），尽早完成压缩
   *   2. requestAI 前同步阻塞（iter 级 messages 构建之前），确保 compactRecord 最新
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
   * 在 turn 开始时、buildBaseMessages 之前调用，对模型输入进行后处理。
   * 入参中的 message 始终是模型文本：单消息请求时等于 requestAI.message，
   * 双消息请求时等于 requestAI.modelMessage。
   * 出参：处理后的 { message, attachments, meta }，可用于注入 focus 上下文等。
   */
  formatUserMessage?: (params: FormatUserMessageParams) => Promise<FormatUserMessageResult> | FormatUserMessageResult;
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
  extra?: Record<string, any>;
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
   * 覆盖 handoff 配置。
   * - 不传（undefined）：继承父 Agent 的 handoff
   * - 传 false：关闭 handoff 历史替换
   * - 传具体配置：使用指定 handoff 参数
   */
  handoff?: HandoffOptions | false;
  /**
   * 覆盖重试配置。
   * - 不传（undefined）：继承父 Agent 的 retry
   * - 传 false 或 { maxRetries: 0 }：禁用重试
   * - 传具体配置：使用指定重试参数
   */
  retry?: RetryOptions | false;
  /**
   * 覆盖运行模式。
   * - 不传：继承父 Agent 当前模式
   * - build：智能模式，允许直接修改
   * - plan：计划模式，先制定方案，方案通过后再操作
   */
  mode?: AgentMode;
  /**
   * 为 fork 显式注入 hooks（不继承父 Agent hooks，避免 afterTurn 等重复执行）。
   * 目前主要用于 SubAgent 场景，通过 beforeRequest 在每次请求前注入动态上下文。
   */
  hooks?: AgentHooks;
}

// ─── ForkAgent ────────────────────────────────────────────────────────────────

export interface RequestAICommonOptions {
  /** 外部预分配的 turnId；不传时由 Agent 内部生成。 */
  turnId?: string;
  attachments?: any[];
  /** 本次请求前切换到指定模式（可由 sender UI 传入） */
  mode?: AgentMode;
  /** 指定本次请求使用的模型角色，会透传到请求层用于智能路由。 */
  aiRole?: string;
  /** 指定本次请求使用的 provider，透传给 request 函数用于路由。 */
  providerId?: string;
  /** 指定本次请求使用的模型，透传给 request 函数用于路由。 */
  modelId?: string;
  /** UI 附加元数据，存入 TurnRecord.meta，不参与 LLM 上下文构建 */
  meta?: Record<string, any>;
  /** 业务扩展字段，存入 TurnRecord.extra，不参与 LLM 上下文构建 */
  extra?: Record<string, any>;
  [key: string]: any;
}

/**
 * 常规请求：同一份 message 同时用于 UI 展示与模型输入。
 */
export interface MessageRequestAIOptions extends RequestAICommonOptions {
  message: string;
  displayMessage?: never;
  modelMessage?: never;
}

/**
 * 双消息请求：displayMessage 用于 UI，modelMessage 会继续经过 formatUserMessage 后发给模型。
 * 适用于 Chip 等由调用方预处理、但 Agent 不感知其具体实现的富文本能力。
 */
export interface DisplayModelRequestAIOptions extends RequestAICommonOptions {
  displayMessage: string;
  modelMessage: string;
  message?: never;
}

/** requestAI 支持常规单消息请求，或显式分离展示/模型文本的双消息请求。 */
export type RequestAIOptions = MessageRequestAIOptions | DisplayModelRequestAIOptions;

/** formatUserMessage 接收到的始终是模型消息；保持既有 params.message 语义。 */
export interface FormatUserMessageParams extends RequestAICommonOptions {
  message: string;
}

export type TurnPersistMode = "append" | "update";

// ─── 构建消息列表 ──────────────────────────────────────────────────────────────

export interface TurnMessageSnapshot {
  /** 当前 turn 可见的历史 turns 快照 */
  historyTurns: TurnRecord[];
  /** 静态背景上下文：每轮开始时获取一次，后续 iter 复用（位于历史对话之前的静态前缀层） */
  stableContextMessages: Message[];
  /** 随消息携带的动态上下文：每轮开始时获取一次，拼接为一条 user 消息插在当前用户消息之前 */
  attachmentContextMessages: MessageSection[];
  /** 当前 turn 开始时的运行模式 */
  mode: AgentMode;
}

// ─── 单次 LLM 请求结果 ─────────────────────────────────────────────────────────

export interface LLMCallResult {
  content: string;
  thinkingContent: string;
  toolCalls: Array<{ id: string; name: string; args: any; argsRaw?: string }>;
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

// ─── ForkAgent 配置 ─────────────────────────────────────────────────────────

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
