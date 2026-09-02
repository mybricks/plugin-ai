import type {
  Attachment,
  Tool,
  ToolCallRecord,
  ToolExecutionContext,
  ToolResult,
  TurnRecord,
} from "../../../types";
import { ToolValidationError, getLLMIterations } from "../../../types";

export const HISTORY_READ_TOOL_NAME = "history_read";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MINIMAL_CONTENT_LENGTH = 240;
const MATCH_EXCERPT_CONTEXT = 80;
const MAX_MATCHES_PER_RECORD = 5;

export type HistoryReadRole = "user" | "assistant";
export type HistoryReadOutputLevel = "minimal" | "standard" | "full";

export interface HistoryReadFilter {
  roles?: HistoryReadRole[];
  /** Inclusive ISO 8601 timestamp lower bound. */
  from?: string;
  /** Inclusive ISO 8601 timestamp upper bound. */
  to?: string;
  /** Case-insensitive literal full-text search. */
  keyword?: string;
}

export interface HistoryReadParams {
  /** Absolute history record index. User and each assistant iteration count as one record. */
  index?: number;
  /** Maximum number of matching records to return. */
  limit?: number;
  filter?: HistoryReadFilter;
  output_level?: HistoryReadOutputLevel;
}

export interface HistoryReadMatch {
  field: string;
  excerpt: string;
}

export interface HistoryReadTurnRange {
  index: number;
  limit: number;
}

export interface HistoryReadRecord {
  index: number;
  type: HistoryReadRole;
  /** 所属历史轮次的真实 ID。 */
  turnId: string;
  turn: HistoryReadTurnRange;
  /** ISO 8601 timestamp. */
  timestamp: string;
  content: string;
  matches?: HistoryReadMatch[];
  [key: string]: unknown;
}

interface SearchableField {
  field: string;
  value: string;
}

interface InternalHistoryRecord {
  index: number;
  type: HistoryReadRole;
  turnId: string;
  turn: HistoryReadTurnRange;
  timestampMs: number;
  content: string;
  user?: {
    attachments: Attachment[];
    sender?: TurnRecord["sender"];
    meta?: TurnRecord["meta"];
    extra?: TurnRecord["extra"];
    status: TurnRecord["status"];
    error?: string;
  };
  assistant?: {
    responseTime?: number;
    endTime?: number;
    reasoning?: string;
    aiRole?: string;
    mode?: string;
    usage?: unknown;
    trace?: unknown;
    toolCalls: ToolCallRecord[];
  };
}

function isWarmupIteration(
  iteration: TurnRecord["iterations"][number],
): iteration is Extract<TurnRecord["iterations"][number], { type: "warmup" }> {
  return "type" in iteration && iteration.type === "warmup";
}

function normalizeHistory(turns: TurnRecord[]): InternalHistoryRecord[] {
  const records: InternalHistoryRecord[] = [];
  let absoluteIndex = 0;

  for (const turn of turns) {
    const assistantIterations = getLLMIterations(turn.iterations);
    const turnRange = {
      index: absoluteIndex,
      limit: 1 + assistantIterations.length,
    };

    const userRecord: InternalHistoryRecord = {
      index: absoluteIndex,
      type: "user",
      turnId: turn.id,
      turn: turnRange,
      timestampMs: turn.startTime,
      content: turn.userText,
      user: {
        attachments: turn.userAttachments ?? [],
        ...(turn.sender ? { sender: turn.sender } : {}),
        ...(turn.meta ? { meta: turn.meta } : {}),
        ...(turn.extra ? { extra: turn.extra } : {}),
        status: turn.status,
        ...(turn.error ? { error: turn.error } : {}),
      },
    };
    if (!turn.deleted) records.push(userRecord);
    absoluteIndex += 1;

    for (const iteration of turn.iterations) {
      if (isWarmupIteration(iteration)) continue;
      const assistantRecord: InternalHistoryRecord = {
        index: absoluteIndex,
        type: "assistant",
        turnId: turn.id,
        turn: turnRange,
        timestampMs: iteration.startTime,
        content: iteration.content,
        assistant: {
          ...(iteration.responseTime !== undefined ? { responseTime: iteration.responseTime } : {}),
          ...(iteration.endTime !== undefined ? { endTime: iteration.endTime } : {}),
          ...(iteration.thinkingContent ? { reasoning: iteration.thinkingContent } : {}),
          ...(iteration.aiRole ? { aiRole: iteration.aiRole } : {}),
          ...(iteration.mode ? { mode: iteration.mode } : {}),
          ...(iteration.usage ? { usage: iteration.usage } : {}),
          ...(iteration.trace ? { trace: iteration.trace } : {}),
          toolCalls: iteration.toolCalls,
        },
      };
      if (!turn.deleted) records.push(assistantRecord);
      absoluteIndex += 1;
    }
  }

  return records;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function collectTextFields(
  value: unknown,
  path: string,
  fields: SearchableField[],
): void {
  if (typeof value === "string") {
    fields.push({ field: path, value });
    return;
  }
  if (value === null || value === undefined || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextFields(item, `${path}[${index}]`, fields));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    // Attachment payloads can be multi-megabyte data URLs and are not useful history text.
    if (key === "content" && /attachments?\[\d+\]$/i.test(path)) return;
    collectTextFields(child, path ? `${path}.${key}` : key, fields);
  });
}

function getSearchableFields(record: InternalHistoryRecord): SearchableField[] {
  const fields: SearchableField[] = [{ field: "content", value: record.content }];
  if (record.user) {
    collectTextFields(record.user.sender, "sender", fields);
    collectTextFields(record.user.meta, "meta", fields);
    collectTextFields(record.user.extra, "extra", fields);
    collectTextFields(record.user.attachments, "attachments", fields);
    if (record.user.error) fields.push({ field: "error", value: record.user.error });
  }
  if (record.assistant) {
    if (record.assistant.reasoning) fields.push({ field: "reasoning", value: record.assistant.reasoning });
    collectTextFields(record.assistant.toolCalls, "toolCalls", fields);
    if (record.assistant.aiRole) fields.push({ field: "aiRole", value: record.assistant.aiRole });
    if (record.assistant.mode) fields.push({ field: "mode", value: record.assistant.mode });
  }
  return fields;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  const compact = compactWhitespace(value);
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function createExcerpt(value: string, matchIndex: number, keywordLength: number): string {
  const start = Math.max(0, matchIndex - MATCH_EXCERPT_CONTEXT);
  const end = Math.min(value.length, matchIndex + keywordLength + MATCH_EXCERPT_CONTEXT);
  return `${start > 0 ? "…" : ""}${compactWhitespace(value.slice(start, end))}${end < value.length ? "…" : ""}`;
}

function findMatches(record: InternalHistoryRecord, keyword: string): HistoryReadMatch[] {
  const normalizedKeyword = keyword.toLocaleLowerCase();
  const matches: HistoryReadMatch[] = [];
  for (const field of getSearchableFields(record)) {
    const matchIndex = field.value.toLocaleLowerCase().indexOf(normalizedKeyword);
    if (matchIndex < 0) continue;
    matches.push({
      field: field.field,
      excerpt: createExcerpt(field.value, matchIndex, keyword.length),
    });
    if (matches.length >= MAX_MATCHES_PER_RECORD) break;
  }
  return matches;
}

function attachmentMetadata(attachments: Attachment[]): Array<Record<string, unknown>> {
  return attachments.map(({ content: _content, ...attachment }) => attachment);
}

function renderToolCall(toolCall: ToolCallRecord, level: HistoryReadOutputLevel): Record<string, unknown> {
  const base = {
    name: toolCall.name,
    status: toolCall.status,
  };
  if (level === "minimal") return base;

  const standard = {
    ...base,
    args: toolCall.args,
    ...(toolCall.errorType ? { errorType: toolCall.errorType } : {}),
    ...(toolCall.error ? { error: safeJson(toolCall.error) } : {}),
    ...(toolCall.result?.metadata !== undefined ? { metadata: toolCall.result.metadata } : {}),
  };
  if (level === "standard") return standard;
  return {
    ...standard,
    callId: toolCall.callId,
    execStartTime: toolCall.execStartTime,
    execEndTime: toolCall.execEndTime,
    ...(toolCall.result ? { result: toolCall.result } : {}),
    ...(toolCall.attachments?.length ? { attachments: attachmentMetadata(toolCall.attachments) } : {}),
  };
}

function renderRecord(
  record: InternalHistoryRecord,
  level: HistoryReadOutputLevel,
  matches: HistoryReadMatch[],
): HistoryReadRecord {
  const base: HistoryReadRecord = {
    index: record.index,
    type: record.type,
    turnId: record.turnId,
    turn: record.turn,
    timestamp: new Date(record.timestampMs).toISOString(),
    content: level === "minimal" ? truncate(record.content, MINIMAL_CONTENT_LENGTH) : record.content,
    ...(matches.length ? { matches } : {}),
  };

  if (record.user) {
    if (level === "minimal") return base;
    return {
      ...base,
      status: record.user.status,
      ...(record.user.sender ? { sender: record.user.sender } : {}),
      ...(record.user.meta ? { meta: record.user.meta } : {}),
      ...(record.user.extra ? { extra: record.user.extra } : {}),
      ...(record.user.attachments.length ? { attachments: attachmentMetadata(record.user.attachments) } : {}),
      ...(record.user.error ? { error: record.user.error } : {}),
    };
  }

  const assistant = record.assistant!;
  if (level === "minimal") {
    return {
      ...base,
      toolCalls: assistant.toolCalls.map((toolCall) => renderToolCall(toolCall, level)),
    };
  }
  const rendered: HistoryReadRecord = {
    ...base,
    ...(assistant.aiRole ? { aiRole: assistant.aiRole } : {}),
    ...(assistant.mode ? { mode: assistant.mode } : {}),
    toolCalls: assistant.toolCalls.map((toolCall) => renderToolCall(toolCall, level)),
  };
  if (level === "full") {
    if (assistant.reasoning) rendered.reasoning = assistant.reasoning;
    if (assistant.responseTime !== undefined) rendered.responseTime = assistant.responseTime;
    if (assistant.endTime !== undefined) rendered.endTime = assistant.endTime;
    if (assistant.usage !== undefined) rendered.usage = assistant.usage;
    if (assistant.trace !== undefined) rendered.trace = assistant.trace;
  }
  return rendered;
}

function describeTool(): string {
  return `读取当前 CodeAgent 的历史记录，不读取其他会话。

历史按绝对 index 编号：每条 user 消息算一条，每个 assistant iteration 算一条；工具调用属于对应 assistant iteration。筛选不会重新编号。
每条返回记录始终包含所属历史轮次的 turnId，不受 output_level 影响。

用法：
- index 默认 0，表示从该绝对位置开始（包含该条）
- limit 默认 ${DEFAULT_LIMIT}，最大 ${MAX_LIMIT}，表示最多返回多少条筛选后的记录
- filter.roles 可筛选 user / assistant
- filter.from / filter.to 使用 ISO 8601 字符串，边界均包含，可直接复用结果中的 timestamp
- filter.keyword 对正文、reasoning、工具名称/参数/结果及扩展字段进行大小写不敏感的全文字面搜索
- output_level=minimal 返回摘要和命中位置；standard（默认）过滤 reasoning 与工具 result.output；full 返回完整 reasoning 和工具输出
- 搜索结果中的 index 可配合 limit=1、output_level=full 展开单条 iter
- 搜索结果中的 turn.index + turn.limit 可重新读取整个 turn
- 使用 next_index 继续读取下一页`;
}

export function createHistoryReadTool(): Tool {
  return {
    name: HISTORY_READ_TOOL_NAME,
    title: "读取历史",
    description: describeTool(),
    parameters: {
      type: "object",
      properties: {
        index: {
          type: "integer",
          minimum: 0,
          description: "从该绝对历史索引开始读取（包含该条），默认 0",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `最多返回的匹配记录数，默认 ${DEFAULT_LIMIT}，最大 ${MAX_LIMIT}`,
        },
        filter: {
          type: "object",
          properties: {
            roles: {
              type: "array",
              items: { type: "string", enum: ["user", "assistant"] },
              uniqueItems: true,
              description: "按角色筛选；不传表示两种角色",
            },
            from: {
              type: "string",
              description: "包含边界的 ISO 8601 起始时间戳，可直接使用结果中的 timestamp",
            },
            to: {
              type: "string",
              description: "包含边界的 ISO 8601 结束时间戳，可直接使用结果中的 timestamp",
            },
            keyword: { type: "string", description: "大小写不敏感的全文字面关键词" },
          },
          additionalProperties: false,
        },
        output_level: {
          type: "string",
          enum: ["minimal", "standard", "full"],
          description: "输出等级：minimal 极简，standard 中等（默认，过滤工具输出），full 丰富",
        },
      },
      additionalProperties: false,
    },
    validate(params: HistoryReadParams) {
      if (params.index !== undefined && (!Number.isInteger(params.index) || params.index < 0)) {
        throw new ToolValidationError("index must be a non-negative integer");
      }
      if (params.limit !== undefined && (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > MAX_LIMIT)) {
        throw new ToolValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`);
      }
      if (params.output_level !== undefined && !["minimal", "standard", "full"].includes(params.output_level)) {
        throw new ToolValidationError("output_level must be minimal, standard, or full");
      }
      if (params.filter?.roles?.some((role) => role !== "user" && role !== "assistant")) {
        throw new ToolValidationError("filter.roles only supports user and assistant");
      }
      const fromTimestamp = params.filter?.from;
      const toTimestamp = params.filter?.to;
      const from = fromTimestamp === undefined ? undefined : Date.parse(fromTimestamp);
      const to = toTimestamp === undefined ? undefined : Date.parse(toTimestamp);
      if (fromTimestamp !== undefined && !Number.isFinite(from)) {
        throw new ToolValidationError("filter.from must be a valid ISO 8601 timestamp string");
      }
      if (toTimestamp !== undefined && !Number.isFinite(to)) {
        throw new ToolValidationError("filter.to must be a valid ISO 8601 timestamp string");
      }
      if (from !== undefined && to !== undefined && from > to) {
        throw new ToolValidationError("filter.from must be earlier than or equal to filter.to");
      }
      if (params.filter?.keyword !== undefined && !params.filter.keyword.trim()) {
        throw new ToolValidationError("filter.keyword must be a non-empty string");
      }
    },
    async execute(params: HistoryReadParams, context?: ToolExecutionContext): Promise<ToolResult> {
      if (!context?.getAgent) {
        throw new Error("history_read requires a CodeAgent tool execution context");
      }
      const agent = context.getAgent();
      await agent.ensureHistoryReady();

      // The active turn contains this tool call and is intentionally excluded.
      const turns = agent.getTurns().filter((turn) => turn.id !== context.turnId);
      const records = normalizeHistory(turns);
      const startIndex = params.index ?? 0;
      const limit = params.limit ?? DEFAULT_LIMIT;
      const outputLevel = params.output_level ?? "standard";
      const roles = params.filter?.roles ? new Set(params.filter.roles) : null;
      const from = params.filter?.from === undefined ? undefined : Date.parse(params.filter.from);
      const to = params.filter?.to === undefined ? undefined : Date.parse(params.filter.to);
      const keyword = params.filter?.keyword?.trim();
      const rendered: HistoryReadRecord[] = [];
      let scanned = 0;
      let hasMore = false;
      let nextIndex: number | null = null;

      for (const record of records) {
        if (record.index < startIndex) continue;
        scanned += 1;
        if (roles && !roles.has(record.type)) continue;
        if (from !== undefined && record.timestampMs < from) continue;
        if (to !== undefined && record.timestampMs > to) continue;
        const matches = keyword ? findMatches(record, keyword) : [];
        if (keyword && matches.length === 0) continue;

        if (rendered.length >= limit) {
          hasMore = true;
          nextIndex = rendered[rendered.length - 1].index + 1;
          break;
        }
        rendered.push(renderRecord(record, outputLevel, matches));
      }

      const page = {
        index: startIndex,
        limit,
        returned: rendered.length,
        scanned,
        has_more: hasMore,
        next_index: nextIndex,
        output_level: outputLevel,
      };
      return {
        output: [JSON.stringify({ _page: page }), ...rendered.map((record) => JSON.stringify(record))].join("\n"),
        metadata: {
          returned: rendered.length,
          next_index: nextIndex,
        },
      };
    },
  };
}
