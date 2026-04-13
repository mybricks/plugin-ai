import type { AgentEvents } from "./events";

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
  args: any;
  result?: any;
  error?: any;
  status: "success" | "error";
  /** 工具开始执行的时间（Unix ms） */
  execStartTime: number;
  /** 工具执行完成的时间（Unix ms），执行中为 0 */
  execEndTime: number;
  // ── 流式专用（只在 UI 层使用，不存入数据库）──
  /** 流式接收中的原始 args 字符串（未完整），用于展示中间状态 */
  argsRaw?: string;
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

  /** 用户输入文本 */
  userText: string;
  /** 用户附件（图片等） */
  userAttachments: Array<{ type: string; content: string }>;
  /**
   * 用户消息的附加元数据（UI 层透传，不参与 LLM 上下文构建）。
   * 可用于存储 focus 快照、mention 信息等，供消息列表渲染使用。
   */
  userMeta?: Record<string, any>;

  /** LLM 最终输出的完整文本（最后一次迭代的文本） */
  content: string;
  /** 思考内容（reasoning / thinking） */
  thinkingContent: string;

  /**
   * ReAct 迭代记录：每次 LLM 响应对应一个 iteration。
   * 用于重建多轮对话历史（assistant tool_calls → tool results → next assistant…）
   *
   * 时间语义：
   *   startTime     本次 LLM 请求发起的时间
   *   responseTime  LLM 首 token 到达的时间（流式开始）
   *   endTime       本次 LLM 请求完成的时间
   */
  iterations: Array<{
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
  }>;

  /** 本轮状态 */
  status: "success" | "abort" | "error";
  /** 错误信息（status === 'error' 时有值） */
  error?: string;

  /**
   * 本轮的 AI 生成摘要（由 autoSummary fork 异步写入）。
   * 用于版本记录场景。
   */
  summary?: string;

  /** token 用量（turn:complete 时携带） */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
  };
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
  /** 加载历史调用记录列表 */
  load(key: string): Promise<TurnRecord[]>;
  /** 追加一轮记录（完成后调用，避免每帧存储） */
  append(key: string, record: TurnRecord): Promise<void>;
  /**
   * 更新已有记录的部分字段（如异步写入 summary）。
   * 实现应以 turnId 定位记录并合并 patch。
   */
  update(key: string, turnId: string, patch: Partial<TurnRecord>): Promise<void>;
  /** 清空指定 key 的历史（同时应清除对应的 compact 记录） */
  clear(key: string): Promise<void>;
  /**
   * 加载该 agentKey 的 compact 记录（不存在时返回 null）。
   */
  loadCompact(key: string): Promise<CompactRecord | null>;
  /**
   * 保存（覆盖写）该 agentKey 的 compact 记录。
   * 一个 agent 只保留一条最新的 compact 记录。
   */
  saveCompact(key: string, record: CompactRecord): Promise<void>;
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
  title: string;
  output: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  /**
   * 参数校验（可选）。校验不通过时抛出 ToolValidationError。
   */
  validate?(params: any): void;
  execute(params: any): Promise<ToolResult>;
}

// ─── 从 TurnRecord[] 重建 LLM messages ───────────────────────────────────────

/**
 * 将历史 TurnRecord[] 展开为 LLM 可直接使用的 messages 列表。
 * 只包含 status === 'success' 的轮次（abort/error 的轮次不作为上下文）。
 *
 * 对于有工具调用的轮次，精确重建 ReAct 消息序列：
 *   user → assistant(tool_calls) → tool(results)… → assistant → …
 *
 * compactRecord 参数：
 *   如果传入，只展开游标（upToTurnId）之后的 turns。
 *   游标之前的 turns 由 buildMessages 单独构建为摘要消息对，此处跳过。
 */
export function turnsToMessages(turns: TurnRecord[], compactRecord?: CompactRecord | null): Message[] {
  const messages: Message[] = [];

  // 找到 compact 游标的索引（-1 表示无 compact）
  let compactBoundaryIdx = -1;
  if (compactRecord) {
    compactBoundaryIdx = turns.findIndex((t) => t.id === compactRecord.upToTurnId);
  }

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.status !== "success") continue;

    // 游标之前（含游标本身）的 turns 跳过，由 buildMessages 负责输出摘要消息对
    if (compactBoundaryIdx !== -1 && i <= compactBoundaryIdx) {
      continue;
    }

    // 用户消息
    const userContent: Message["content"] = turn.userAttachments.length
      ? [
          { type: "text", text: turn.userText },
          ...turn.userAttachments.map((a) => ({
            type: "image_url",
            image_url: { url: a.content },
          })),
        ]
      : turn.userText;
    messages.push({ role: "user", content: userContent });

    // 用 iterations 重建 ReAct 序列（向后兼容：无 iterations 时降级到简单 assistant 消息）
    if (turn.iterations?.length) {
      for (const iter of turn.iterations) {
        if (iter.toolCalls.length > 0) {
          // assistant 消息带 tool_calls
          const assistantMsg: Message = {
            role: "assistant",
            content: iter.content ?? "",
            ...(iter.thinkingContent ? { reasoning_content: iter.thinkingContent } : {}),
            tool_calls: iter.toolCalls.map((tc) => ({
              id: tc.callId,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.args),
              },
            })),
          };
          messages.push(assistantMsg);
          // 每个工具调用对应一条 tool 消息
          for (const tc of iter.toolCalls) {
            const toolResult = tc.status === "error"
              ? `Error: ${tc.error}`
              : JSON.stringify(tc.result ?? null);
            messages.push({
              role: "tool",
              content: toolResult,
              tool_call_id: tc.callId,
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
    } else if (turn.content) {
      // iterations 为空（纯文本回复）
      messages.push({
        role: "assistant",
        content: turn.content,
        ...(turn.thinkingContent ? { reasoning_content: turn.thinkingContent } : {}),
      });
    }
  }
  return messages;
}
