import type {
  RequestAsStreamFn,
  RequestAsStreamParams,
  TokenUsage,
  ToolCallSpec,
  ToolCallStreamDelta,
  ToolDescriptor,
} from "./types";

export interface CustomRequestConfig {
  provider: () => "openai" | Promise<"openai">;
  apiUrl: () => string | Promise<string>;
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
}

async function resolveConfig(config: CustomRequestConfig) {
  const [provider, apiUrl, apiKey, model] = await Promise.all([
    config.provider(),
    config.apiUrl(),
    config.apiKey(),
    config.model?.() ?? undefined,
  ]);
  return { provider, apiUrl, apiKey, model };
}

function validateResolved(resolved: Awaited<ReturnType<typeof resolveConfig>>): string | null {
  if (!resolved.provider) return "missing provider";
  if (!resolved.apiUrl?.trim()) return "missing API url";
  if (!resolved.apiKey?.trim()) return "missing API key";
  try {
    new URL(resolved.apiUrl);
  } catch {
    return `invalid API url: ${resolved.apiUrl}`;
  }
  return null;
}

function isAbortError(ex: unknown): boolean {
  return (
    (ex instanceof DOMException && ex.name === "AbortError") ||
    (ex instanceof Error && ex.message.toLowerCase().includes("aborted"))
  );
}

async function readErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()) || response.statusText;
  } catch {
    return response.statusText;
  }
}

type ParsedCustomSSEChunk = {
  content?: string;
  thinking?: string;
  usage?: TokenUsage;
  rawToolCallDeltas?: Array<{
    index: number;
    id?: string;
    name?: string;
    argumentsChunk?: string;
  }>;
  finishReason?: string | null;
};

/**
 * 创建自定义渠道请求函数（当前仅支持 OpenAI 兼容格式）
 * 配置项均为 getter，便于每次请求动态读取最新配置。
 */
export function createCustomRequest(config: CustomRequestConfig): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, tools } = params;
    const {
      cancel,
      write,
      complete,
      error,
      onUsage,
      onThinking,
      onToolCalls,
      onToolCallStream,
      onFinishReason,
    } = emits;

    const resolved = await resolveConfig(config);
    const configError = validateResolved(resolved);
    if (configError) {
      const err = new Error(configError);
      error(err);
      throw err;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error("messages cannot be empty");
      error(err);
      throw err;
    }

    const controller = new AbortController();
    cancel(() => controller.abort());

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const requestBody = formatRequestBody(resolved.provider, messages, resolved.model, tools);
      const response = await fetch(resolved.apiUrl, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await readErrorText(response);
        throw new Error(`API request failed [${response.status}]: ${text}`);
      }
      if (!response.body) throw new Error("empty response body");

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      type ToolCallAccum = { id: string; name: string; argsRaw: string };
      const toolCallsByIndex = new Map<number, ToolCallAccum>();
      let finishReason: string | null = null;

      const processParsedChunk = (parsed: ParsedCustomSSEChunk) => {
        console.log('onUsage', parsed.usage)
        if (parsed.content) write(parsed.content);
        if (parsed.thinking && onThinking) onThinking(parsed.thinking);
        if (parsed.usage && onUsage) onUsage(parsed.usage);
        if (parsed.finishReason !== undefined) finishReason = parsed.finishReason;
        if (!parsed.rawToolCallDeltas?.length) return;

        for (const delta of parsed.rawToolCallDeltas) {
          const existing = toolCallsByIndex.get(delta.index);
          if (existing) {
            existing.argsRaw += delta.argumentsChunk ?? "";
            if (onToolCallStream) {
              onToolCallStream({ index: delta.index, argsChunk: delta.argumentsChunk ?? "" });
            }
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
          processParsedChunk(parseSSELine(line, resolved.provider));
        }
      }

      if (buffer.trimStart().startsWith("data:")) {
        processParsedChunk(parseSSELine(buffer, resolved.provider));
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
    } catch (ex) {
      if (isAbortError(ex)) return;
      const err = ex instanceof Error ? ex : new Error(String(ex));
      error(err);
      throw err;
    } finally {
      try {
        await reader?.cancel();
      } catch {
        // ignore
      }
    }
  };
}

function formatRequestBody(
  provider: "openai",
  messages: any[],
  model?: string,
  tools?: ToolDescriptor[]
): any {
  const defaultModel = "gpt-4o";
  return {
    model: model?.trim() || defaultModel,
    messages,
    stream: true,
    ...(tools?.length
      ? {
          tools: tools.map((tool) => ({
            type: "function",
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters ?? { type: "object", properties: {} },
            },
          })),
        }
      : {}),
  };
}

function parseSSELine(
  line: string,
  provider: "openai"
): ParsedCustomSSEChunk {
  const data = line.replace(/^data:\s*/, "").trim();
  if (data === "" || data === "[DONE]") return {};

  let json: any;
  try {
    json = JSON.parse(data);
  } catch {
    return {};
  }

  const result: ParsedCustomSSEChunk = {};
  const delta = json.choices?.[0]?.delta;
  const choice = json.choices?.[0];
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

  // token 用量
  // Kimi 官方格式：usage 在 finish_reason 同级（choice.usage），例如：
  // { "prompt_tokens": 15643, "completion_tokens": 262, "total_tokens": 15905,
  //   "cached_tokens": 14592, "prompt_tokens_details": { "cached_tokens": 14592 } }
  if (choice?.usage) {
    result.usage = {
      promptTokens: choice.usage.prompt_tokens ?? 0,
      completionTokens: choice.usage.completion_tokens ?? 0,
      totalTokens: choice.usage.total_tokens,
      promptTokensDetails: {
        cachedTokens: choice.usage.cached_tokens ?? choice.usage.prompt_tokens_details?.cached_tokens,
      },
    };
  }
  // OpenAI 格式：usage 在最外层，和 choices 同级
  else if (json.usage) {
    result.usage = {
      promptTokens: json.usage.prompt_tokens ?? 0,
      completionTokens: json.usage.completion_tokens ?? 0,
      totalTokens: json.usage.total_tokens,
      promptTokensDetails: {
        cachedTokens: json.usage.prompt_tokens_details?.cached_tokens,
      },
    };
  }
  if (choice && "finish_reason" in choice) {
    result.finishReason = choice.finish_reason ?? null;
  }
  return result;
}
