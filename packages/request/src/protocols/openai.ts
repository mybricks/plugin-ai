import type {
  RequestAsStreamEmits,
  TokenUsage,
  ToolCallSpec,
} from "../types";
import { readSSEEvents } from "../transport/sse";
import type { ModelProtocol, ProtocolRequestInput } from "./types";

export type ParsedOpenAIChunk = {
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

export function createOpenAIRequestBody(
  input: ProtocolRequestInput,
): Record<string, any> {
  return {
    model: input.model?.trim() || "gpt-4o",
    messages: input.messages,
    stream: true,
    ...(input.tools?.length
      ? {
          tools: input.tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters ?? { type: "object", properties: {} },
            },
          })),
        }
      : {}),
    ...(input.extraParams ?? {}),
  };
}

export function parseOpenAIStreamData(data: string): ParsedOpenAIChunk {
  if (!data || data === "[DONE]") return {};
  let json: any;
  try {
    json = JSON.parse(data);
  } catch {
    return {};
  }

  const result: ParsedOpenAIChunk = {};
  const choice = json.choices?.[0];
  const delta = choice?.delta;
  if (delta?.content != null) result.content = delta.content;
  if (delta?.reasoning_content != null) result.thinking = delta.reasoning_content;
  else if (delta?.reasoning != null) result.thinking = delta.reasoning;

  if (Array.isArray(delta?.tool_calls) && delta.tool_calls.length > 0) {
    result.rawToolCallDeltas = delta.tool_calls.map((toolCall: any) => ({
      index: toolCall.index ?? 0,
      id: toolCall.id,
      name: toolCall.function?.name,
      argumentsChunk: toolCall.function?.arguments,
    }));
  }
  if (choice && "finish_reason" in choice) {
    result.finishReason = choice.finish_reason ?? null;
  }

  const rawUsage = choice?.usage ?? json.usage;
  if (rawUsage && typeof rawUsage.prompt_tokens === "number") {
    const promptDetails = rawUsage.prompt_tokens_details as
      | Record<string, any>
      | undefined;
    result.usage = {
      promptTokens: rawUsage.prompt_tokens,
      completionTokens: rawUsage.completion_tokens ?? 0,
      totalTokens:
        typeof rawUsage.total_tokens === "number"
          ? rawUsage.total_tokens
          : undefined,
      promptTokensDetails: {
        cachedTokens:
          typeof rawUsage.cached_tokens === "number"
            ? rawUsage.cached_tokens
            : typeof promptDetails?.cached_tokens === "number"
              ? promptDetails.cached_tokens
              : undefined,
        cacheWriteTokens:
          typeof promptDetails?.cache_write_tokens === "number"
            ? promptDetails.cache_write_tokens
            : undefined,
      },
    };
  }
  return result;
}

export async function readOpenAIStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  emits: RequestAsStreamEmits,
): Promise<void> {
  type ToolCallAccum = { id: string; name: string; argsRaw: string };
  const toolCallsByIndex = new Map<number, ToolCallAccum>();
  let finishReason: string | null = null;

  await readSSEEvents(reader, ({ data }) => {
    const parsed = parseOpenAIStreamData(data);
    if (parsed.content) emits.write(parsed.content);
    if (parsed.thinking) emits.onThinking?.(parsed.thinking);
    if (parsed.usage) emits.onUsage?.(parsed.usage);
    if (parsed.finishReason !== undefined) finishReason = parsed.finishReason;

    for (const delta of parsed.rawToolCallDeltas ?? []) {
      const existing = toolCallsByIndex.get(delta.index);
      if (existing) {
        existing.argsRaw += delta.argumentsChunk ?? "";
        emits.onToolCallStream?.({
          index: delta.index,
          argsChunk: delta.argumentsChunk ?? "",
        });
      } else {
        toolCallsByIndex.set(delta.index, {
          id: delta.id ?? "",
          name: delta.name ?? "",
          argsRaw: delta.argumentsChunk ?? "",
        });
        emits.onToolCallStream?.({
          index: delta.index,
          id: delta.id ?? "",
          name: delta.name ?? "",
          argsChunk: delta.argumentsChunk ?? "",
        });
      }
    }
  });

  const hasToolCalls = toolCallsByIndex.size > 0;
  const resolvedFinishReason = finishReason ?? (hasToolCalls ? "tool_calls" : "stop");
  emits.onFinishReason?.(resolvedFinishReason);

  if (
    hasToolCalls &&
    (finishReason === "tool_calls" || finishReason == null)
  ) {
    const toolCalls: ToolCallSpec[] = [];
    for (const index of Array.from(toolCallsByIndex.keys()).sort((a, b) => a - b)) {
      const toolCall = toolCallsByIndex.get(index)!;
      if (!toolCall.id || !toolCall.name) continue;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(toolCall.argsRaw);
      } catch {
        args = {};
      }
      toolCalls.push({ id: toolCall.id, name: toolCall.name, args });
    }
    if (toolCalls.length > 0) emits.onToolCalls?.(toolCalls);
  }
  emits.complete("");
}

export const openAIProtocol: ModelProtocol = {
  type: "openai",
  endpoint: "/v1/chat/completions",
  createHeaders: (apiKey) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }),
  createRequestBody: createOpenAIRequestBody,
  readStream: readOpenAIStream,
};
