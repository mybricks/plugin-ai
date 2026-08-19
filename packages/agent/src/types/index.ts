import { formatHandoffMessageContent } from "../handoff";

// ─── TokenUsage（通用 token 用量格式） ────────────────────────────────────────

/**
 * 通用 token 用量格式（驼峰命名）
 * request 层负责将各服务商的响应转换为此格式
 */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  promptTokensDetails?: {
    cachedTokens?: number;
    cacheWriteTokens?: number;
  };
  model?: string;
};

export interface IterationTrace {
  historyTurnCount: number;
  compactRecord?: {
    upToTurnId: string;
    inHistory: boolean;
  };
}

// ─── AgentMode（运行模式）────────────────────────────────────────────────────

/**
 * Agent 运行模式。
 * - build：智能模式，允许直接修改，适合快速修改和简单直接的任务
 * - plan：计划模式，修改之前先制定方案，方案通过后再进行操作
 */
export type AgentMode = "build" | "plan";

// ─── Attachment（通用附件格式） ─────────────────────────────────────────────

/**
 * 通用附件格式，贯穿整个附件数据流：
 *   requestAI({ attachments }) → TurnRecord.userAttachments
 *   → ToolCallRecord.attachments → Message.attachments
 *
 * type    附件类型，如 "image"、"pdf"
 * content 可以是 data URL 或普通 URL；url 可显式传普通 URL。
 */
export interface Attachment {
  type: string;
  /** data URL（data:mime;base64,...）或普通 URL */
  content?: string;
  /** 普通 URL */
  url?: string;
  filename?: string;
  title?: string;
  mime?: string;
  mediaType?: string;
}

function getAttachmentMime(content?: string): string | undefined {
  if (!content?.startsWith("data:")) return undefined;
  return content.split(";")[0].replace("data:", "") || undefined;
}

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

function inferMimeFromUrl(value?: string): string | undefined {
  if (!value || !isHttpUrl(value)) return undefined;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/.test(pathname)) return "image";
    if (/\.pdf$/.test(pathname)) return "application/pdf";
  } catch {
    return undefined;
  }
  return undefined;
}

function getAttachmentKind(attachment: Attachment | any): "image" | "pdf" | "file" {
  const type = attachment.type;
  const content = attachment.url ?? attachment.content;
  const mime = attachment.mime ?? attachment.mediaType ?? getAttachmentMime(content) ?? inferMimeFromUrl(content);
  if (type === "image" || type?.startsWith?.("image/") || mime?.startsWith("image/")) return "image";
  if (type === "pdf" || type === "application/pdf" || mime === "application/pdf") return "pdf";
  return "file";
}

export function attachmentToMessagePart(attachment: Attachment | any): any {
  const content = attachment.url ?? attachment.content ?? "";
  const filename = attachment.filename ?? attachment.title;
  const kind = getAttachmentKind(attachment);

  if (kind === "image") {
    return {
      type: "image_url",
      image_url: { url: content, detail: "auto" },
    };
  }

  if (isHttpUrl(content)) {
    return {
      type: "text",
      text: `Attached ${kind === "pdf" ? "PDF" : "file"} URL${filename ? ` (${filename})` : ""}: ${content}`,
    };
  }

  return {
    type: "file",
    file: {
      filename: filename ?? (kind === "pdf" ? "attachment.pdf" : "attachment"),
      file_data: content,
    },
    ...(kind === "pdf" ? { semanticType: "pdf" } : {}),
  };
}

// ─── Message（LLM 请求格式） ──────────────────────────────────────────────────

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | any[];
  /** reasoning_content：assistant 消息中的思考内容（供支持 thinking 的模型续传上下文） */
  reasoning_content?: string;
  /** tool_calls：assistant 消息中 LLM 请求工具调用时携带（OpenAI function calling 格式） */
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  /** tool_call_id：tool 角色消息关联的调用 ID */
  tool_call_id?: string;
  /**
   * 是否需要缓存该消息。
   * 在调用 LLM 时，会根据目标模型转换为对应格式：
   *   - Claude: cache_control: { type: 'ephemeral' }
   */
  cache?: boolean;
  /**
   * 工具调用结果状态（仅 role === "tool" 时有意义）。
   * 供服务端感知工具执行是否成功，发送请求前由 sanitizeMessages 移除。
   */
  status?: "success" | "error";
  /**
   * 工具调用错误类型（仅 status === "error" 时出现）。
   * - "invalid_args"：工具参数校验失败
   * - "normal"：工具执行过程中的普通错误
   */
  errorType?: "invalid_args" | "normal";
  /**
   * 工具调用结果携带的附件（仅 role === "tool" 时有意义）。
   * 由 assembleMessages 从 ToolCallRecord.attachments 透传而来。
   * 在请求层按 model capabilities 预处理（内嵌或提取为合成 user 消息），
   * sanitizeMessages 发送前会将此字段移除（不裸发到 API）。
   */
  attachments?: Attachment[];
}

// ─── WarmupIter（warmup 阶段特殊 iter） ──────────────────────────────────────

/**
 * warmup 阶段的特殊 iter，挂在 TurnRecord.iterations[] 中。
 * 不参与 LLM context 构建（turnsToMessages 会跳过）。
 * 对应事件：warmup:start → warmup:content × N → warmup:complete
 */
export interface WarmupIter {
  /** 固定为 "warmup"，用于区分普通 LLM iter */
  type: "warmup";
  /** 本次 warmup iter 的唯一 ID，与 warmup:start 事件中的 iterId 对应 */
  iterId?: string;
  /** 当前状态 */
  status: "loading" | "success" | "error";
  /** 展示给用户的描述文本（streaming 更新，与 LLM iter.content 对齐） */
  content: string;
  /** warmup 开始时间（Unix ms） */
  startTime: number;
  /** warmup 结束时间（Unix ms），进行中为 undefined */
  endTime?: number;
  /**
   * 固定为空数组，与 LLM iter 兼容，避免遍历 toolCalls 时需要 type guard。
   * warmup 没有工具调用。
   */
  toolCalls: [];
}

// ─── TurnSender ───────────────────────────────────────────────────────────────

/**
 * 消息发送者信息，由 formatUserMessage 返回并写入 TurnRecord。
 * UI 渲染时优先使用 sender，兜底使用 ChatPanel 传入的 user prop。
 */
export interface TurnSender {
  userId?: string;
  name?: string;
  avatar?: string;
  [key: string]: any;
}

// ─── TurnRecord（SSE 事件粒度的完整调用记录） ─────────────────────────────────

/**
 * 单次工具调用的记录（对应 tool:call / tool:result / tool:error 三个事件）
 *
 * 时间语义：
 *   execStartTime  工具开始执行的时间（tool:call 触发时）
 *   execEndTime    工具执行完成的时间（tool:result / tool:error 触发时）
 */
export interface ToolCallRecord {
  callId: string;
  name: string;
  /** 工具标题（可选），用于 UI 展示。来源于 Tool.title。 */
  title?: string;
  args: any;
  /** 工具执行结果（包含 output 和 metadata） */
  result?: { output: string; metadata?: any };
  error?: any;
  status: "pending" | "success" | "error";
  /**
   * 工具调用错误类型（仅 status === "error" 时出现）。
   * - "invalid_args"：JSON 参数解析失败或工具参数校验失败（ToolValidationError）
   * - "normal"：工具执行过程中的其他错误
   */
  errorType?: "invalid_args" | "normal";
  /** 工具开始执行的时间（Unix ms） */
  execStartTime: number;
  /** 工具执行完成的时间（Unix ms），执行中为 0 */
  execEndTime: number;
  /**
   * 工具执行产出的附件（图片、PDF 等）。
   * Agent 层只做数据透传，不做任何能力判断。
   * assembleMessages 时携带到 Message.attachments，
   * 由请求层按 model capabilities 做分流处理。
   */
  attachments?: Attachment[];
}

/**
 * 一轮完整的 AI 调用记录（turn:start → ... → turn:complete / turn:abort / turn:error）。
 * 存储在 History 里，兼具两个用途：
 *   1. 从中重建 LLM messages（多轮对话上下文）
 *   2. 直接映射到 UI 的 MessageRecord（历史展示 + 审计）
 *
 * ReAct 循环中，一个 turn 对应用户的一次输入，内部可包含多轮 LLM<>Tool 交互。
 * `iterations` 记录每次 LLM 请求的 assistant 文本和工具调用列表，
 * 用于在多轮对话中精确重建 messages（包含 tool_calls / tool 角色消息）。
 */
export interface TurnRecord {
  /** 本轮唯一 ID */
  id: string;
  /** 用户发起本轮的时间（Unix ms） */
  startTime: number;
  /** 本轮结束时间（Unix ms），abort/error 时也记录 */
  endTime?: number;

  /** 用户输入文本（原始，用于 UI 展示） */
  userText: string;
  /** 格式化后的用户消息文本（发给 LLM，含 focus 上下文等注入内容；未格式化时与 userText 相同） */
  userFormattedText?: string;
  /** 用户附件（图片、PDF 等） */
  userAttachments: Attachment[];
  /**
   * 用户消息的附加元数据（UI 层透传，不参与 LLM 上下文构建）。
   * 可用于存储 focus 快照、mention 信息等，供消息列表渲染使用。
   */
  meta?: Record<string, any>;
  /**
   * 用户消息的业务扩展字段（调用方透传，不参与 LLM 上下文构建）。
   * 可用于存储 trace、来源、业务对象 ID 等，供 hooks 和历史记录读取。
   */
  extra?: Record<string, any>;
  /**
   * 消息发送者信息（由 formatUserMessage 注入，UI 展示时优先使用）。
   * 不传时 UI 兜底使用 ChatPanel 的 user prop。
   */
  sender?: TurnSender;

  /**
   * ReAct 迭代记录：每次 LLM 响应对应一个 iteration，warmup 阶段插入特殊 WarmupIter。
   * WarmupIter 由 type: "warmup" 区分，不参与 LLM context 构建。
   *
   * LLM iter 时间语义：
   *   startTime     本次 LLM 请求发起的时间
   *   responseTime  LLM 首 token 到达的时间（流式开始）
   *   endTime       本次 LLM 请求完成的时间
   */
  iterations: Array<
    | WarmupIter
    | {
        /** 本次迭代的唯一 ID（由 agent 生成，与 llm:start 等事件中的 iterId 对应） */
        iterId?: string;
        /** 本次迭代 LLM 输出的纯文本 */
        content: string;
        /** 本次迭代的工具调用（若有） */
        toolCalls: ToolCallRecord[];
        /** 本次 LLM 请求发起时间（Unix ms） */
        startTime: number;
        /** LLM 首 token 到达时间（Unix ms），即响应时间 */
        responseTime?: number;
        /** 本次 LLM 请求完成时间（Unix ms） */
        endTime?: number;
        /** 本次 LLM 思考内容 */
        thinkingContent?: string;
        /** 本 step 实际使用的 aiRole；未显式指定时为 "default"。 */
        aiRole?: string;
        /** 本 step 实际运行的 Agent 模式 */
        mode?: AgentMode;
        /** 本次 LLM 请求的 token 用量 */
        usage?: TokenUsage;
        /** 本次 LLM 请求构建时记录的上下文追踪信息 */
        trace?: IterationTrace;
      }
  >;

  /** 本轮状态 */
  status: "success" | "abort" | "error";
  /** 错误信息（status === 'error' 时有值） */
  error?: string;
  /**
   * 是否已被 retry 替代（仅对 iterations 为空的 error turn 有效）。
   * 标记后该 turn 不再参与 LLM 上下文构建，但保留在历史记录中供 UI 展示。
   */
  retried?: boolean;

  /**
   * 本轮的 AI 生成摘要（由 autoSummary fork 异步写入）。
   * 用于版本记录场景。
   */
  summary?: string;
  /**
   * 本轮的可延续对话摘要（由 autoSummary fork 异步写入）。
   * 包含目标、指示、发现、已完成工作、相关文件等结构化内容，
   * 供后续 agent 接手时作为上下文使用。
   */
  handoff?: string;

  /**
   * 本轮的 AI 生成建议选项（由 autoSummary fork 异步写入）。
   * 仅当 AgentOptions.suggestions.enabled 为 true 时生成。
   * 前端只在该 turn 为最后一条时展示，用户发下一轮消息后自然消失。
   */
  suggestions?: {
    /** LLM 对这组建议的说明（可选），如"模型异常结束了" */
    desc?: string;
    /** 可点击的建议列表，点击后作为用户消息发送 */
    options: string[];
  };
  /** 用户是否主动关闭了本轮建议展示。 */
  suggestionsDismissed?: boolean;

  /**
   * 是否已被用户删除（软删除）。
   * 标记后该 turn 不进入 LLM 上下文构建，也不在 UI 中展示。
   */
  deleted?: true;

}

export type LLMIteration = Exclude<TurnRecord["iterations"][number], WarmupIter>;

// ─── VersionRecord ───────────────────────────────────────────────────────────

/**
 * 单个文件的版本快照。只存 decoded source，不存 compiled（回滚时由 sandbox 重新编译）。
 */
export interface VersionFile {
  path: string;
  /** decoded source 文本 */
  content: string;
}

/**
 * 版本元数据记录（不含 files，files 单独存储以避免 listVersions 全量读取大对象）。
 *
 * type 语义：
 *   ai        AI 生成触发（afterTurn diff 驱动）
 *   manual    用户手动保存
 *   rollback  回滚产生的版本（files 内容来源于某个历史版本）
 *
 * turnId 语义：
 *   ai / manual：本次变更对应的 TurnRecord.id
 *   rollback：被恢复的原版本的 turnId（保留关联链）
 */
export interface VersionRecord {
  /** 版本唯一 ID（uuid） */
  id: string;
  /** 关联的 TurnRecord.id */
  turnId: string;
  /** 展示标签，如 "V0" / "V1"，由调用方维护序号 */
  label: string;
  type: 'ai' | 'manual' | 'rollback' | 'init';
  /** 创建时间（Unix ms） */
  createdAt: number;
  /** AI 生成的本轮摘要（由 afterTurnSummary 异步写入） */
  summary?: string;
}

// ─── CompactRecord ────────────────────────────────────────────────────────────

/**
 * Compact 记录，关联到一个 agentKey。
 * 一个 agent 最多只有一条，单独存储在 History 的独立存储槽中（不混入 TurnRecord[]）。
 *
 * 语义：
 *   upToTurnId  压缩游标：该 turnId（含）及之前的所有 turns 已被压缩
 *   summary     由 autoCompact fork 生成的完整对话摘要
 *   createdAt   压缩时间（Unix ms）
 *
 * buildMessages 时：
 *   - 游标之前（含）的 turns → 替换为一条摘要消息对
 *   - 游标之后的 turns → 正常展开
 */
export interface CompactRecord {
  /** 压缩游标：该 turnId（含）及之前的 turns 在 buildMessages 时替换为摘要 */
  upToTurnId: string;
  /** 对话摘要内容 */
  content: string;
  /** 压缩时间（Unix ms） */
  createdAt: number;
}

// ─── History 接口 ─────────────────────────────────────────────────────────────

export interface History {
  // ── 对话记录 ──────────────────────────────────────────────────────────────

  /** 加载历史调用记录列表 */
  load(key: string): Promise<TurnRecord[]>;
  /**
   * 分页加载历史记录（可选实现）。不实现时 Agent 降级到 load() 全量加载。
   * - after：只返回该 turnId 之后的记录（不含，用于初始加载跳过 compact 边界前的内容）
   * - before：只返回该 turnId 之前的记录（不含，用于往前翻页）
   * - limit：每批条数上限（before 场景必传；after 场景不传则取全部）
   */
  loadTurns?(key: string, options: {
    after?: string;
    before?: string;
    limit?: number;
  }): Promise<{ turns: TurnRecord[]; hasMore: boolean }>;
  /** 追加一轮记录（turn 开始时调用一次；后续完整 iter 与终态通过 update 更新） */
  append(key: string, record: TurnRecord): Promise<void>;
  /**
   * 更新已有记录的部分字段（如异步写入 summary）。
   * 实现应以 turnId 定位记录并合并 patch。
   */
  update(key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void>;
  /** 清空指定 key 的历史（同时应清除对应的 compact 记录） */
  clear(key: string): Promise<void>;
  /**
   * 批量导入历史记录（覆盖写）。
   * 用于调试场景：从导出的 JSON 文件恢复历史。
   */
  import(key: string, turns: TurnRecord[]): Promise<void>;
  /**
   * 加载该 agentKey 的 compact 记录（不存在时返回 null）。
   */
  loadCompact(key: string): Promise<CompactRecord | null>;
  /**
   * 保存（覆盖写）该 agentKey 的 compact 记录。
   * 一个 agent 只保留一条最新的 compact 记录。
   */
  saveCompact(key: string, record: CompactRecord): Promise<void>;

  // ── 版本快照 ──────────────────────────────────────────────────────────────
  //
  // key 参数（出现时）均为 agentKey，用于在同一 History 实例中隔离不同 agent 的版本数据。
  // getVersion / getVersionFiles / updateVersion 以 versionId（uuid）精确定位，不需要 key。

  /**
   * 获取该 agentKey 下所有版本的元数据列表，按 createdAt 升序排列。
   * 不含 files 内容（files 通过 getVersionFiles 单独读取）。
   * 支持分页参数 { pageSize, pageNum }，不传时返回全量数据。
   */
  listVersions(
    key: string,
    params?: { pageSize?: number; pageNum?: number }
  ): Promise<{ total: number; list: VersionRecord[] }>;

  /**
   * 追加一条新版本记录（metadata + files 原子写入）。
   * metadata 和 files 底层分开存储，调用方无需关心。
   */
  addVersion(key: string, record: VersionRecord, files: VersionFile[]): Promise<void>;

  /**
   * 读取指定版本的文件列表。
   * 仅在需要展示文件内容或执行回滚时调用，避免 listVersions 全量加载大对象。
   */
  getVersionFiles(versionId: string): Promise<VersionFile[]>;

  /**
   * 读取指定版本的元数据（不含 files）。不存在时返回 null。
   */
  getVersion(versionId: string): Promise<VersionRecord | null>;

  /**
   * 更新版本的部分字段（支持 summary 和 files 的修改）。
   * 其他字段会触发 console.warn。
   */
  updateVersion(
    versionId: string,
    patch: Partial<Pick<VersionRecord, 'summary'>> & { files?: VersionFile[] }
  ): Promise<void>;
}

// ─── BoundHistory ─────────────────────────────────────────────────────────────

/**
 * agentKey 已绑定的 History 视图，所有方法不再需要传 key。
 * 通过 Agent.getHistory() 获取，供 sandbox 等外部调用方使用。
 *
 * 底层仍委托给 History 实例，只是把 key 从接口中隐藏掉。
 */
export interface BoundHistory {
  // ── 版本快照 ──────────────────────────────────────────────────────────────
  listVersions(params?: { pageSize?: number; pageNum?: number }): Promise<{ total: number; list: VersionRecord[] }>;
  addVersion(record: VersionRecord, files: VersionFile[]): Promise<void>;
  getVersionFiles(versionId: string): Promise<VersionFile[]>;
  getVersion(versionId: string): Promise<VersionRecord | null>;
  updateVersion(
    versionId: string,
    patch: Partial<Pick<VersionRecord, 'summary'>> & { files?: VersionFile[] }
  ): Promise<void>;
}

/**
 * 将 History 实例与 agentKey 绑定，返回 BoundHistory。
 * 所有需要 key 的方法自动填入 agentKey，调用方无需关心分区逻辑。
 */
export function bindHistory(history: History, agentKey: string): BoundHistory {
  return {
    listVersions: (params) => history.listVersions(agentKey, params),
    addVersion: (record, files) => history.addVersion(agentKey, record, files),
    getVersionFiles: (versionId) => history.getVersionFiles(versionId),
    getVersion: (versionId) => history.getVersion(versionId),
    updateVersion: (versionId, patch) => history.updateVersion(versionId, patch),
  };
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";
  }
}

/**
 * 工具执行结果统一格式：
 *   - title    工具卡片展示标题（简短，如文件名）
 *   - output   发给 LLM 的文本内容（function call result）
 *   - metadata 持久化元数据，前端渲染可用（如路径、行数、策略等）
 */
export interface ToolResult {
  output: string;
  metadata?: Record<string, any>;
}

/**
 * 工具的输出/行为限制配置。
 * 所有约束统一收归此对象，便于统一管理和扩展。
 */
export interface ToolLimits {
  /**
   * 工具 output 的最大 token 数。
   * 超过时以 error 替换真实 output，引导模型缩小查询范围。
   * 设置为 false 时跳过通用 output token 限制，适用于文件写入/编辑等
   * output 本身不会把大内容塞回上下文的工具。
   * 不设置时使用全局默认值 TOOL_OUTPUT_MAX_TOKENS（25_000）。
   */
  maxToken?: number | false;
}

export interface Tool {
  name: string;
  /**
   * 工具标题（可选）。用于 DefaultToolRenderer 展示。
   * 仅当工具没有自定义 render 时生效，有自定义 render 则无需设置。
   */
  title?: string;
  description: string;
  parameters?: Record<string, any>;
  /**
   * 工具级别的限制配置（可选）。
   * 不设置时所有限制均使用全局默认值。
   */
  limits?: ToolLimits;
  /**
   * 参数校验（可选）。校验不通过时抛出 ToolValidationError。
   */
  validate?(params: any, ctx?: any): void;
  execute(params: any, ctx?: any): Promise<ToolResult>;
  /**
   * 自定义 UI 渲染函数（可选）。
   * 工具调用时的 React 渲染，参数为 ToolRecord（含 status/args/result 等）。
   * 若不传则使用 DefaultToolRenderer 兜底。
   * 注意：ToolRecord 类型在 UI 包中定义（@plugin-ai/plugin），此处用 any 避免循环依赖。
   */
  render?: (tool: any) => any;
}

/**
 * 将工具调用的参数序列化为 arguments 字符串（OpenAI function calling 格式）。
 * 重点：一定要保证不能传空字符串，不然有些厂商会挂
 * Iter 中 tc 只有args 字段
 * TODO: 两个函数合并
 */
export function serializeToolCallArgumentsFromIter(tc: any): string {
  // 有 _argsRaw 代表解析失败了，错误的Json到了部分供应商，会直接报错，服了，所以需要用空对象替代，反正我会在role=assistant那里提供原始内容
  if (tc?.args?._argsRaw) return JSON.stringify({});
  return JSON.stringify(tc.args ?? {});
}

/**
 * 将工具调用的参数序列化为 arguments 字符串（OpenAI function calling 格式）。
 * 重点：一定要保证不能传空字符串，不然有些厂商会挂
 * LLMResult 中 args 是 null，有 argsRaw 字段
 * TODO: 两个函数合并
 */
export function serializeToolCallArgumentsFromLLMResult(tc: any): string {
  if (!!tc.argsRaw) return tc.argsRaw;
  return JSON.stringify(tc.args || {});
}

/**
 * 从 iterations 中过滤出 LLM iter（排除 warmup 等特殊 iter）。
 * agent.ts 中所有需要"只计 LLM iter"的地方统一调用此函数。
 */
export function getLLMIterations(
  iterations: TurnRecord["iterations"]
): LLMIteration[] {
  return (iterations ?? []).filter(
    (iter): iter is LLMIteration => !("type" in iter)
  );
}

/**
 * 判断本轮是否"没有进行任何工具调用"：
 *   - LLM iter 为空，或
 *   - 只有一条 LLM iter 且该 iter 没有 toolCalls（纯文本回复即结束）
 *
 * 用于 autoSummary 跳过判断 和 abort 中断提示插入。
 */
export function hasNoToolCalls(iterations: TurnRecord["iterations"]): boolean {
  const llmIters = getLLMIterations(iterations);
  if (llmIters.length === 0) return true;
  if (llmIters.length === 1 && (!llmIters[0].toolCalls || llmIters[0].toolCalls.length === 0)) return true;
  return false;
}

// ─── 从 TurnRecord[] 重建 LLM messages ───────────────────────────────────────

/**
 * 将历史 TurnRecord[] 展开为 LLM 可直接使用的 messages 列表。
 * 包含所有状态的轮次（success / error / abort）——由调用方决定是否过滤。
 *
 * 对于有工具调用的轮次，精确重建 ReAct 消息序列：
 *   user → assistant(tool_calls) → tool(results)… → assistant → …
 *
 * compactRecord 参数：
 *   如果传入，只展开游标（upToTurnId）之后的 turns。
 *   游标之前的 turns 由 buildMessages 单独构建为摘要消息对，此处跳过。
 *
 * handoffTurnIds 参数：
 *   命中 handoff 条件的 turn id 集合（由 handoff.ts 的 computeHandoffTurnIds 计算）。
 *   命中的 turn 整体替换为 user（原始用户消息）+ assistant（handoff 摘要说明）两条消息。
 */
export function turnsToMessages(
  turns: TurnRecord[],
  compactRecord?: CompactRecord | null,
  handoffTurnIds?: Set<string>
): Message[] {
  const messages: Message[] = [];

  // 找到 compact 游标的索引（-1 表示无 compact）
  let compactBoundaryIdx = -1;
  if (compactRecord) {
    compactBoundaryIdx = turns.findIndex((t) => t.id === compactRecord.upToTurnId);
  }

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.retried) continue;
    if (turn.deleted) continue;

    // 游标之前（含游标本身）的 turns 跳过，由 buildMessages 负责输出摘要消息对
    if (compactBoundaryIdx !== -1 && i <= compactBoundaryIdx) {
      continue;
    }

    // 用户消息（handoff 和普通模式都需要，保留原始文本，不含附件）
    const userText = turn.userFormattedText ?? turn.userText;

    // ── Handoff 模式：整个 turn 替换为 user + assistant(handoff summary) ──────
    if (handoffTurnIds?.has(turn.id)) {
      messages.push({ role: "user", content: userText });
      messages.push({ role: "assistant", content: formatHandoffMessageContent(turn.handoff ?? "") });
      continue;
    }

    // ── 普通模式 ──────────────────────────────────────────────────────────────
    const userContent: Message["content"] = turn.userAttachments.length
      ? [
          { type: "text", text: userText },
          ...turn.userAttachments.map(attachmentToMessagePart),
        ]
      : userText;
    messages.push({ role: "user", content: userContent });

    // ── abort 且无工具调用：插入中断提示，让 LLM 知道该轮被用户取消 ──
    if (turn.status === "abort" && hasNoToolCalls(turn.iterations)) {
      messages.push({ role: "user", content: "[Request interrupted by user]" });
      continue;
    }

    // 用 iterations 重建 ReAct 序列（向后兼容：无 iterations 时降级到简单 assistant 消息）
    if (turn.iterations?.length) {
      for (const iter of getLLMIterations(turn.iterations)) {
        const completedToolCalls = iter.toolCalls.filter((tc) => tc.status !== "pending");
        if (completedToolCalls.length > 0) {
          // assistant 消息带 tool_calls
          const assistantMsg: Message = {
            role: "assistant",
            content: iter.content ?? "",
            ...(iter.thinkingContent ? { reasoning_content: iter.thinkingContent } : {}),
            tool_calls: completedToolCalls.map((tc) => ({
              id: tc.callId,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: serializeToolCallArgumentsFromIter(tc),
              },
            })),
          };
          messages.push(assistantMsg);
          // 每个工具调用对应一条 tool 消息
          for (const tc of completedToolCalls) {
            const toolResult = tc.status === "error"
              ? `Error: ${tc.error}`
              : tc.result?.output ?? "";
            messages.push({
              role: "tool",
              content: toolResult,
              tool_call_id: tc.callId,
              ...(tc.status !== "pending" ? { status: tc.status } : {}),
              ...(tc.errorType ? { errorType: tc.errorType } : {}),
              // 透传附件，由请求层按 capabilities 预处理
              ...(tc.attachments?.length ? { attachments: tc.attachments } : {}),
            });
          }
        } else {
          // 纯文本回复（最后一轮或无工具调用的迭代）
          if (iter.content) {
            messages.push({
              role: "assistant",
              content: iter.content,
              ...(iter.thinkingContent ? { reasoning_content: iter.thinkingContent } : {}),
            });
          }
        }
      }
    }
  }

  return messages;
}

export type {
  AgentHooks,
  AgentOptions,
  AgentsMdConfig,
  AgentsMdConfigResolver,
  ForkAgentOptions,
  ForkOptions,
  FormatUserMessageResult,
  FormatUserMessageParams,
  LLMCallResult,
  MessageSection,
  RequestAIOptions,
  RequestAICommonOptions,
  MessageRequestAIOptions,
  DisplayModelRequestAIOptions,
  ToolExecutionContext,
  TurnMessageSnapshot,
  TurnPersistMode,
} from "./agent";
export type { HandoffOptions } from "../handoff";
