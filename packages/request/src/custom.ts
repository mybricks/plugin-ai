import type {
  RequestAsStreamFn,
  RequestAsStreamParams,
  ToolDescriptor,
} from "./types";
import { readSSEStream } from "./sse-parser";
import { sanitizeMessages, preprocessMessagesForModel } from "./base";

export interface CustomRequestConfig {
  provider: () => "openai" | Promise<"openai">;
  apiUrl: () => string | Promise<string>;
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
  /** 额外的请求参数，会合并到最终请求体中 */
  extraParams?: () => Record<string, any> | Promise<Record<string, any>>;
}

async function resolveConfig(config: CustomRequestConfig) {
  const [provider, apiUrl, apiKey, model, extraParams] = await Promise.all([
    config.provider(),
    config.apiUrl(),
    config.apiKey(),
    config.model?.() ?? undefined,
    config.extraParams?.() ?? undefined,
  ]);
  return { provider, apiUrl, apiKey, model, extraParams };
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

/**
 * 创建自定义渠道请求函数（当前仅支持 OpenAI 兼容格式）
 * 配置项均为 getter，便于每次请求动态读取最新配置。
 */
export function createCustomRequest(config: CustomRequestConfig): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, tools } = params;
    const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;

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
      const requestBody = formatRequestBody(resolved.provider, sanitizeMessages(preprocessMessagesForModel(messages)), resolved.model, tools, resolved.extraParams);
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
      await readSSEStream({ reader, write, complete, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason });
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
  tools?: ToolDescriptor[],
  extraParams?: Record<string, any>
): any {
  const defaultModel = "gpt-4o";
  // 为没有 reasoning_content 的 assistant（含 tool_calls）/tool 消息自动添加
  const processedMessages = messages.map(msg => {
    // if ((msg.role === "assistant" && msg.tool_calls?.length) || msg.role === "tool") {
    //   if (!msg.reasoning_content) {
    //     return { ...msg, reasoning_content: "我思考一下" };
    //   }
    // }
    return msg;
  });
  return {
    model: model?.trim() || defaultModel,
    messages: processedMessages,
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
    ...extraParams,
  };
}


/**
 * Kimi 官方平台请求配置
 */
export interface KimiRequestConfig {
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
  /** 是否启用思考模式，默认 false */
  thinking?: () => boolean | Promise<boolean>;
}

/**
 * 创建 Kimi 官方平台请求函数
 * 基于 createCustomRequest，预设了 Kimi 平台的配置，并支持 thinking 参数
 */
export function createKimiRequest(config: KimiRequestConfig): RequestAsStreamFn {
  return createCustomRequest({
    provider: () => "openai",
    apiUrl: () => "https://api.moonshot.cn/v1/chat/completions",
    apiKey: config.apiKey,
    model: config.model,
    extraParams: async () => {
      const thinking = await config.thinking?.() ?? false;
      return {
        thinking: {
          type: 'disabled',
        }
      };
    },
  });
}
