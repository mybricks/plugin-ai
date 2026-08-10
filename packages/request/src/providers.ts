import type { RequestAsStreamParams, ToolDescriptor } from "./types";
import { readSSEStream } from "./sse-parser";
import { sanitizeMessages, preprocessMessagesForModel } from "./base";

// ─── Provider types ──────────────────────────────────────────────────────────

export interface ModelCapabilities {
  input?: { image?: boolean; pdf?: boolean };
  toolResultMedia?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  capabilities?: ModelCapabilities;
}

export interface RemoteProviderConfig {
  providerId: string;
  format: "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
}

export interface CustomProviderConfig {
  providerId: string;
  models: ModelConfig[];
  request: import("./types").RequestAsStreamFn;
}

export type ProviderConfig = RemoteProviderConfig | CustomProviderConfig;

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

export interface LLMProviderOptions {
  providers: ProviderConfig[];
}

// ─── ToolAttachment ───────────────────────────────────────────────────────────

/**
 * 工具执行产出的附件，格式与 agent 层 Attachment / requestAI attachments 对齐。
 *   type    附件类型，如 "image"、"pdf"
 *   content data URL 或普通 URL；也可用 url 显式传普通 URL。
 */
export interface ToolAttachment {
  type: string;
  /** data URL 或普通 URL */
  content?: string;
  /** 普通 URL */
  url?: string;
  filename?: string;
  title?: string;
  mime?: string;
  mediaType?: string;
}


// ─── 内部工具函数 ─────────────────────────────────────────────────────────────

const OPENAI_CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
const ANTHROPIC_MESSAGES_PATH = "/v1/messages";
const PROVIDER_ENDPOINTS: Record<RemoteProviderConfig["format"], string> = {
  openai: OPENAI_CHAT_COMPLETIONS_PATH,
  anthropic: ANTHROPIC_MESSAGES_PATH,
};

/** 类型守卫：判断是否为自定义请求 provider */
function isCustomProvider(p: ProviderConfig): p is CustomProviderConfig {
  return typeof (p as CustomProviderConfig).request === "function";
}

function normalizeProviderRequestUrl(format: RemoteProviderConfig["format"], url: string): string {
  const endpoint = PROVIDER_ENDPOINTS[format];
  let baseUrl = url.trim().replace(/\/+$/, "");
  Object.values(PROVIDER_ENDPOINTS).forEach((path) => {
    baseUrl = baseUrl.replace(new RegExp(`${path}$`), "");
  });
  if (!baseUrl) return "";
  if (baseUrl.endsWith("/v1")) return `${baseUrl}${endpoint.replace(/^\/v1/, "")}`;
  return `${baseUrl}${endpoint}`;
}

function validateProviderConfig(config: ProviderConfig): string | null {
  if (!config.providerId?.trim()) return "missing providerId";
  if (!config.models?.length) return "missing models";
  if (isCustomProvider(config)) return null;
  if (!config.baseUrl?.trim()) return "missing baseUrl";
  if (!config.apiKey?.trim()) return "missing apiKey";
  try {
    new URL(normalizeProviderRequestUrl(config.format, config.baseUrl));
  } catch {
    return `invalid baseUrl: ${config.baseUrl}`;
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

function formatRequestBody(
  format: "openai" | "anthropic",
  messages: any[],
  model?: string,
  tools?: ToolDescriptor[],
  extraParams?: Record<string, any>
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
    ...extraParams,
  };
}

// ─── LLMProvider ──────────────────────────────────────────────────────────────

/**
 * LLMProvider：根据给定模型选择执行对应 provider 的请求。
 *
 * 支持两种 ProviderConfig：
 * - RemoteProviderConfig：直连供应商（baseUrl + apiKey），走内置 fetch 逻辑，
 *   发送前按当前 ModelConfig.capabilities 做多模态预处理。
 * - CustomProviderConfig：自定义请求，把请求 delegate 给外部 request 函数；
 *   调用方完全控制适配逻辑，LLMProvider 不做额外预处理。
 *
 * 不保存默认模型、当前选择或 KV；这些状态由 plugin 层的 ModelSelectionController 管理。
 */
export class LLMProvider {
  private providers: Map<string, ProviderConfig>;

  constructor(options: LLMProviderOptions) {
    this.providers = new Map();

    for (const provider of options.providers) {
      const error = validateProviderConfig(provider);
      if (!error) {
        this.providers.set(provider.providerId, provider);
      }
    }

  }

  /**
   * 核心请求方法。
   *
   * - RemoteProviderConfig：发送前自动按 ModelConfig.capabilities 做多模态预处理，再走内置 fetch。
   * - CustomProviderConfig：直接 delegate 给外部 request 函数，不做任何预处理。
   */
  async request(params: RequestAsStreamParams, selection: ModelSelection): Promise<void> {
    const { messages, emits, tools } = params;
    const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;

    const provider = this.providers.get(selection.providerId);
    if (!provider) {
      const err = new Error(`provider not found: ${selection.providerId}`);
      error(err);
      throw err;
    }

    // CustomProviderConfig：直接 delegate，调用方自行处理多模态适配
    if (isCustomProvider(provider)) {
      return provider.request({ ...params, model: selection });
    }

    // RemoteProviderConfig：发送前做多模态预处理
    const model = selection.modelId;

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error("messages cannot be empty");
      error(err);
      throw err;
    }

    const controller = new AbortController();
    cancel(() => controller.abort());

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      // kimi 渠道固定 providerId 为 'kimi'，自动添加 thinking 参数关闭思考
      const isKimi = provider.providerId === 'kimi';
      const extraParams = isKimi ? { thinking: { type: 'disabled' } } : undefined;
      // 多模态预处理：按当前 model capabilities 做附件分流，再 sanitize
      const capabilitiesModel = provider.models.find((m) => m.id === selection.modelId);
      const capabilities = capabilitiesModel?.capabilities;
      const processedMessages = preprocessMessagesForModel(messages, capabilities);
      const requestBody = formatRequestBody(provider.format, sanitizeMessages(processedMessages), model, tools, extraParams);
      const response = await fetch(normalizeProviderRequestUrl(provider.format, provider.baseUrl), {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
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
  }

  /**
   * 配置有效性检查
   */
  isValid(): boolean {
    if (this.providers.size === 0) return false;
    for (const provider of this.providers.values()) {
      if (isCustomProvider(provider)) continue;
      if (!provider.apiKey || !provider.baseUrl || provider.models.length === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * 返回已通过基础配置校验的 provider，供 plugin 层建立可选模型列表。
   */
  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }
}
