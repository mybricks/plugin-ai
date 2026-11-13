import type {
  RequestAsStreamEmits,
  ToolCallSpec,
} from "../types";
import { readSSEEvents } from "../transport/sse";
import type { ModelProtocol, ProtocolRequestInput } from "./types";

type AnthropicContentBlock = Record<string, any>;
type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

function parseDataUrl(value: string): { mediaType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function textBlock(text: unknown): AnthropicContentBlock[] {
  const value = String(text ?? "");
  return value ? [{ type: "text", text: value }] : [];
}

function imageBlock(url: string): AnthropicContentBlock {
  const dataUrl = parseDataUrl(url);
  return {
    type: "image",
    source: dataUrl
      ? { type: "base64", media_type: dataUrl.mediaType, data: dataUrl.data }
      : { type: "url", url },
  };
}

function documentBlock(
  resource: string,
  filename?: string,
): AnthropicContentBlock {
  const dataUrl = parseDataUrl(resource);
  return {
    type: "document",
    source: dataUrl
      ? { type: "base64", media_type: dataUrl.mediaType, data: dataUrl.data }
      : { type: "url", url: resource },
    ...(filename ? { title: filename } : {}),
  };
}

function toAnthropicContent(content: any): AnthropicContentBlock[] {
  if (!Array.isArray(content)) return textBlock(content);

  const blocks: AnthropicContentBlock[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text") {
      blocks.push(...textBlock(part.text));
      continue;
    }
    if (part.type === "image" || part.type === "image_url") {
      const url = part.image_url?.url ?? part.url ?? part.content;
      if (typeof url === "string" && url) blocks.push(imageBlock(url));
      continue;
    }
    if (part.type === "file") {
      const resource = part.file?.file_data ?? part.file?.url ?? part.content;
      if (typeof resource === "string" && resource) {
        blocks.push(documentBlock(resource, part.file?.filename ?? part.filename));
      }
    }
  }
  return blocks;
}

function parseToolArguments(value: unknown): Record<string, any> {
  if (value && typeof value === "object") return value as Record<string, any>;
  if (typeof value !== "string" || !value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function appendMessage(
  messages: AnthropicMessage[],
  role: AnthropicMessage["role"],
  blocks: AnthropicContentBlock[],
): void {
  if (blocks.length === 0) return;
  const previous = messages[messages.length - 1];
  if (previous?.role !== role) {
    messages.push({ role, content: blocks });
    return;
  }

  if (role === "user") {
    const toolResults = blocks.filter((block) => block.type === "tool_result");
    const otherBlocks = blocks.filter((block) => block.type !== "tool_result");
    previous.content = toolResults.length
      ? [...toolResults, ...previous.content, ...otherBlocks]
      : [...previous.content, ...otherBlocks];
    return;
  }
  previous.content.push(...blocks);
}

export function formatAnthropicMessages(messages: any[]): {
  system?: string;
  messages: AnthropicMessage[];
} {
  const systemParts: string[] = [];
  const formatted: AnthropicMessage[] = [];
  let pendingToolResults: AnthropicContentBlock[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return;
    appendMessage(formatted, "user", pendingToolResults);
    pendingToolResults = [];
  };

  for (const message of messages) {
    if (message.role === "system") {
      flushToolResults();
      const blocks = toAnthropicContent(message.content);
      systemParts.push(
        blocks
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n"),
      );
      continue;
    }

    if (message.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: message.tool_call_id,
        content: toAnthropicContent(message.content),
      });
      continue;
    }

    if (message.role === "user") {
      const blocks = [
        ...pendingToolResults,
        ...toAnthropicContent(message.content),
      ];
      pendingToolResults = [];
      appendMessage(formatted, "user", blocks);
      continue;
    }

    flushToolResults();
    if (message.role === "assistant") {
      const blocks = toAnthropicContent(message.content);
      for (const toolCall of message.tool_calls ?? []) {
        blocks.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function?.name,
          input: parseToolArguments(toolCall.function?.arguments),
        });
      }
      appendMessage(formatted, "assistant", blocks);
    }
  }

  flushToolResults();
  const system = systemParts.filter(Boolean).join("\n\n");
  return { ...(system ? { system } : {}), messages: formatted };
}

export function createAnthropicRequestBody(
  input: ProtocolRequestInput,
): Record<string, any> {
  const formatted = formatAnthropicMessages(input.messages);
  const body: Record<string, any> = {
    model: input.model,
    messages: formatted.messages,
    stream: true,
    ...(formatted.system ? { system: formatted.system } : {}),
    ...(input.tools?.length
      ? {
          tools: input.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.parameters ?? { type: "object", properties: {} },
          })),
        }
      : {}),
    ...(input.extraParams ?? {}),
  };
  if (body.max_tokens == null) body.max_tokens = 8192;
  return body;
}

function mapStopReason(reason: string | null | undefined): string | null {
  if (reason === "tool_use") return "tool_calls";
  if (reason === "end_turn" || reason === "stop_sequence") return "stop";
  if (reason === "max_tokens") return "length";
  return reason ?? null;
}

export async function readAnthropicStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  emits: RequestAsStreamEmits,
): Promise<void> {
  type ToolCallAccum = { id: string; name: string; argsRaw: string };
  const toolCallsByIndex = new Map<number, ToolCallAccum>();
  let finishReason: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens: number | undefined;
  let cacheWriteTokens: number | undefined;

  const emitUsage = () => {
    emits.onUsage?.({
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      promptTokensDetails: { cachedTokens, cacheWriteTokens },
    });
  };

  await readSSEEvents(reader, ({ data }) => {
    let event: any;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error?.message ?? "Anthropic stream error");
    }
    if (event.type === "message_start") {
      const usage = event.message?.usage;
      inputTokens = usage?.input_tokens ?? inputTokens;
      outputTokens = usage?.output_tokens ?? outputTokens;
      cachedTokens = usage?.cache_read_input_tokens ?? cachedTokens;
      cacheWriteTokens = usage?.cache_creation_input_tokens ?? cacheWriteTokens;
      emitUsage();
      return;
    }
    if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
      const initialInput = event.content_block.input;
      const argsRaw =
        initialInput && Object.keys(initialInput).length > 0
          ? JSON.stringify(initialInput)
          : "";
      toolCallsByIndex.set(event.index, {
        id: event.content_block.id ?? "",
        name: event.content_block.name ?? "",
        argsRaw,
      });
      emits.onToolCallStream?.({
        index: event.index,
        id: event.content_block.id ?? "",
        name: event.content_block.name ?? "",
        argsChunk: argsRaw,
      });
      return;
    }
    if (event.type === "content_block_delta") {
      if (event.delta?.type === "text_delta" && event.delta.text) {
        emits.write(event.delta.text);
      } else if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
        emits.onThinking?.(event.delta.thinking);
      } else if (event.delta?.type === "input_json_delta") {
        const chunk = event.delta.partial_json ?? "";
        const toolCall = toolCallsByIndex.get(event.index);
        if (toolCall) toolCall.argsRaw += chunk;
        emits.onToolCallStream?.({ index: event.index, argsChunk: chunk });
      }
      return;
    }
    if (event.type === "message_delta") {
      finishReason = mapStopReason(event.delta?.stop_reason);
      outputTokens = event.usage?.output_tokens ?? outputTokens;
      emitUsage();
    }
  });

  const hasToolCalls = toolCallsByIndex.size > 0;
  const resolvedFinishReason = finishReason ?? (hasToolCalls ? "tool_calls" : "stop");
  emits.onFinishReason?.(resolvedFinishReason);

  if (hasToolCalls && resolvedFinishReason === "tool_calls") {
    const toolCalls: ToolCallSpec[] = [];
    for (const index of Array.from(toolCallsByIndex.keys()).sort((a, b) => a - b)) {
      const toolCall = toolCallsByIndex.get(index)!;
      if (!toolCall.id || !toolCall.name) continue;
      toolCalls.push({
        id: toolCall.id,
        name: toolCall.name,
        args: parseToolArguments(toolCall.argsRaw),
      });
    }
    if (toolCalls.length > 0) emits.onToolCalls?.(toolCalls);
  }
  emits.complete("");
}

export const anthropicProtocol: ModelProtocol = {
  type: "anthropic",
  endpoint: "/v1/messages",
  createHeaders: (apiKey) => ({
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }),
  createRequestBody: createAnthropicRequestBody,
  readStream: readAnthropicStream,
};
