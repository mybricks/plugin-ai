import type { TokenUsage, ToolCallSpec, ToolCallStreamDelta } from "./types";

export type ParsedSSEChunk = {
  content?: string;
  thinking?: string;
  usage?: TokenUsage;
  finishReason?: string | null;
  rawToolCallDeltas?: Array<{
    index: number;
    id?: string;
    name?: string;
    argumentsChunk?: string;
  }>;
};

/**
 * 解析 OpenAI 兼容格式的 SSE 行。
 *
 * 兼容以下两种 usage 位置：
 *
 * 1. OpenAI 标准格式 —— usage 在最外层，与 choices 同级：
 *    { "choices": [...], "usage": { "prompt_tokens": 100, "completion_tokens": 50, ... } }
 *
 * 2. Kimi 官方格式 —— usage 在 choices[0] 内部，与 finish_reason 同级：
 *    { "choices": [{ "finish_reason": "stop", "usage": { "prompt_tokens": 100, ... } }] }
 *    Kimi 的 usage 中 cached_tokens 可能出现在顶层（cached_tokens）
 *    或 prompt_tokens_details.cached_tokens 中，两处都做兼容。
 *
 * 兼容以下两种 thinking 字段名：
 *  - reasoning_content（DeepSeek / Kimi 思考模式）
 *  - reasoning（部分模型）
 */
function parseSSELine(line: string): ParsedSSEChunk {
  const data = line.replace(/^data:\s*/, "").trim();
  if (data === "" || data === "[DONE]") return {};

  let json: any;
  try {
    json = JSON.parse(data);
  } catch {
    return {};
  }

  const result: ParsedSSEChunk = {};
  const choice = json.choices?.[0];
  const delta = choice?.delta;

  if (delta?.content != null) result.content = delta.content;
  if (delta?.reasoning_content != null) result.thinking = delta.reasoning_content;
  else if (delta?.reasoning != null) result.thinking = delta.reasoning;

  if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
    result.rawToolCallDeltas = delta.tool_calls.map((tc: any) => ({
      index: tc.index ?? 0,
      id: tc.id,
      name: tc.function?.name,
      argumentsChunk: tc.function?.arguments,
    }));
  }

  if (choice && "finish_reason" in choice) {
    result.finishReason = choice.finish_reason ?? null;
  }

  // Kimi 格式：usage 在 choice 内部
  const rawUsage = choice?.usage ?? json.usage;
  if (rawUsage && typeof rawUsage.prompt_tokens === "number") {
    const promptDetails = rawUsage.prompt_tokens_details as Record<string, any> | undefined;
    result.usage = {
      promptTokens: rawUsage.prompt_tokens,
      completionTokens: rawUsage.completion_tokens ?? 0,
      totalTokens: typeof rawUsage.total_tokens === "number" ? rawUsage.total_tokens : undefined,
      promptTokensDetails: {
        // Kimi 的 cached_tokens 可能在顶层或嵌套在 prompt_tokens_details 中
        cachedTokens:
          typeof rawUsage.cached_tokens === "number"
            ? rawUsage.cached_tokens
            : typeof promptDetails?.cached_tokens === "number"
            ? promptDetails.cached_tokens
            : undefined,
        cacheWriteTokens:
          typeof promptDetails?.cache_write_tokens === "number" ? promptDetails.cache_write_tokens : undefined,
      },
    };
  }

  return result;
}

export interface ReadSSEStreamOptions {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  write: (chunk: string) => void;
  complete: (v: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  onThinking?: (chunk: string) => void;
  onToolCalls?: (toolCalls: ToolCallSpec[]) => void;
  onToolCallStream?: (delta: ToolCallStreamDelta) => void;
  onFinishReason?: (reason: string) => void;
}

/**
 * 读取 SSE 流并处理所有事件，直到流结束。
 * 封装了：TextDecoder 分帧、processParsedChunk、tool calls 累积、finishReason 收集
 * 以及最终触发 onToolCalls / onFinishReason / complete。
 */
export async function readSSEStream(opts: ReadSSEStreamOptions): Promise<void> {
  const { reader, write, complete, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = opts;

  const decoder = new TextDecoder();
  let buffer = "";
  type ToolCallAccum = { id: string; name: string; argsRaw: string };
  const toolCallsByIndex = new Map<number, ToolCallAccum>();
  let finishReason: string | null = null;

  const processParsedChunk = (parsed: ParsedSSEChunk) => {
    if (parsed.content) write(parsed.content);
    if (parsed.thinking && onThinking) onThinking(parsed.thinking);
    if (parsed.usage && onUsage) onUsage(parsed.usage);
    if (parsed.finishReason !== undefined) finishReason = parsed.finishReason;
    if (!parsed.rawToolCallDeltas?.length) return;

    for (const delta of parsed.rawToolCallDeltas) {
      const existing = toolCallsByIndex.get(delta.index);
      if (existing) {
        existing.argsRaw += delta.argumentsChunk ?? "";
        if (onToolCallStream) onToolCallStream({ index: delta.index, argsChunk: delta.argumentsChunk ?? "" });
      } else {
        toolCallsByIndex.set(delta.index, {
          id: delta.id ?? "",
          name: delta.name ?? "",
          argsRaw: delta.argumentsChunk ?? "",
        });
        if (onToolCallStream) {
          onToolCallStream({
            index: delta.index,
            id: delta.id ?? "",
            name: delta.name ?? "",
            argsChunk: delta.argumentsChunk ?? "",
          });
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      processParsedChunk(parseSSELine(line));
    }
  }

  // 流结束后处理可能残留的 buffer
  if (buffer.trimStart().startsWith("data:")) {
    processParsedChunk(parseSSELine(buffer));
  }

  const hasToolCalls = toolCallsByIndex.size > 0;
  const resolvedFinishReason = finishReason ?? (hasToolCalls ? "tool_calls" : "stop");
  if (onFinishReason) onFinishReason(resolvedFinishReason);

  const shouldTriggerToolCalls =
    onToolCalls &&
    hasToolCalls &&
    (finishReason === "tool_calls" || finishReason === null || finishReason === undefined);

  if (shouldTriggerToolCalls) {
    const toolCalls: ToolCallSpec[] = [];
    const indices = Array.from(toolCallsByIndex.keys()).sort((a, b) => a - b);
    for (const idx of indices) {
      const tc = toolCallsByIndex.get(idx)!;
      if (!tc.id || !tc.name) continue;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.argsRaw);
      } catch {
        args = {};
      }
      toolCalls.push({ id: tc.id, name: tc.name, args });
    }
    if (toolCalls.length > 0) onToolCalls(toolCalls);
  }

  complete("");
}
