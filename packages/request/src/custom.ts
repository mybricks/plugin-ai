import { prepareMessagesForModel, sanitizeMessages } from "./messages";
import { openAIProtocol } from "./protocols";
import { executeStreamingRequest } from "./transport/http";
import type { RequestAsStreamFn } from "./types";

export interface CustomRequestConfig {
  /** @deprecated 当前仅支持 OpenAI 兼容协议，保留该 getter 以兼容旧配置。 */
  provider: () => "openai" | Promise<"openai">;
  apiUrl: () => string | Promise<string>;
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
  /** 额外的请求参数，会合并到最终请求体中。 */
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

function validateResolved(
  resolved: Awaited<ReturnType<typeof resolveConfig>>,
): string | null {
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

/**
 * 创建 OpenAI 兼容渠道请求函数。
 * 配置项均为 getter，便于每次请求动态读取最新配置。
 */
export function createCustomRequest(config: CustomRequestConfig): RequestAsStreamFn {
  return async function ({ messages, emits, tools }) {
    const resolved = await resolveConfig(config);
    const configError = validateResolved(resolved);
    if (configError) {
      const error = new Error(configError);
      emits.error(error);
      throw error;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      const error = new Error("messages cannot be empty");
      emits.error(error);
      throw error;
    }

    await executeStreamingRequest({
      url: resolved.apiUrl,
      headers: openAIProtocol.createHeaders(resolved.apiKey),
      body: openAIProtocol.createRequestBody({
        model: resolved.model?.trim() || "gpt-4o",
        messages: sanitizeMessages(prepareMessagesForModel(messages)),
        tools,
        extraParams: resolved.extraParams,
      }),
      emits,
      readStream: openAIProtocol.readStream,
    });
  };
}

/** Kimi 官方平台请求配置。 */
export interface KimiRequestConfig {
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
  /** 是否启用思考模式。为了兼容原逻辑，当前请求固定关闭思考模式。 */
  thinking?: () => boolean | Promise<boolean>;
}

/** 创建 Kimi 官方平台请求函数。 */
export function createKimiRequest(config: KimiRequestConfig): RequestAsStreamFn {
  return createCustomRequest({
    provider: () => "openai",
    apiUrl: () => "https://api.moonshot.cn/v1/chat/completions",
    apiKey: config.apiKey,
    model: config.model,
    extraParams: async () => {
      await config.thinking?.();
      return { thinking: { type: "disabled" } };
    },
  });
}
