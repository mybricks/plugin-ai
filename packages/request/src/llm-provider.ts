import type { RequestAsStreamFn, RequestAsStreamParams } from "./types";
import {
  prepareMessagesForModel,
  sanitizeMessages,
} from "./messages";
import {
  getProtocol,
  normalizeProtocolUrl,
  type ProtocolType,
} from "./protocols";
import { executeStreamingRequest } from "./transport/http";

export interface ModelCapabilities {
  input?: { image?: boolean; pdf?: boolean };
  toolResultMedia?: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  /** 模型简介，展示在模型选择器的名称下方。 */
  description?: string;
  /** 展示在模型名称右侧的文本，如「5.5x」或「预计 3.5–5.5x」。 */
  suffix?: string;
  capabilities?: ModelCapabilities;
}

export interface RemoteProviderConfig {
  providerId: string;
  /** 上游 API 协议。保留 format 字段以兼容现有配置。 */
  format: ProtocolType;
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
}

export interface CustomProviderConfig {
  providerId: string;
  models: ModelConfig[];
  /**
   * 完全自定义的请求实现。
   * 接收 Agent 原始 messages，LLMProvider 不会隐式预处理或改写。
   */
  request: RequestAsStreamFn;
}

export type ProviderConfig = RemoteProviderConfig | CustomProviderConfig;

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

export interface LLMProviderOptions {
  providers: ProviderConfig[];
}

/** 工具执行产出的附件，与 Agent Attachment 结构对齐。 */
export interface ToolAttachment {
  type: string;
  content?: string;
  url?: string;
  filename?: string;
  title?: string;
  mime?: string;
  mediaType?: string;
}

function isCustomProvider(
  provider: ProviderConfig,
): provider is CustomProviderConfig {
  return typeof (provider as CustomProviderConfig).request === "function";
}

function validateProviderConfig(config: ProviderConfig): string | null {
  if (!config.providerId?.trim()) return "missing providerId";
  if (!config.models?.length) return "missing models";
  if (isCustomProvider(config)) return null;
  if (!config.baseUrl?.trim()) return "missing baseUrl";
  if (!config.apiKey?.trim()) return "missing apiKey";
  try {
    new URL(normalizeProtocolUrl(config.format, config.baseUrl));
  } catch {
    return `invalid baseUrl: ${config.baseUrl}`;
  }
  return null;
}

/** 根据已选模型把 Agent 请求路由到 Remote 或 Custom Provider。 */
export class LLMProvider {
  private providers: Map<string, ProviderConfig>;

  constructor(options: LLMProviderOptions) {
    this.providers = new Map();
    for (const provider of options.providers) {
      if (!validateProviderConfig(provider)) {
        this.providers.set(provider.providerId, provider);
      }
    }
  }

  async request(
    params: RequestAsStreamParams,
    selection: ModelSelection,
  ): Promise<void> {
    const provider = this.providers.get(selection.providerId);
    if (!provider) {
      const error = new Error(`provider not found: ${selection.providerId}`);
      params.emits.error(error);
      throw error;
    }

    // Custom Provider 保持原始契约，由调用方自行处理协议和消息。
    if (isCustomProvider(provider)) {
      return provider.request({ ...params, model: selection });
    }

    if (!Array.isArray(params.messages) || params.messages.length === 0) {
      const error = new Error("messages cannot be empty");
      params.emits.error(error);
      throw error;
    }

    const modelConfig = provider.models.find(
      (model) => model.id === selection.modelId,
    );
    const messages = sanitizeMessages(
      prepareMessagesForModel(params.messages, modelConfig?.capabilities),
    );
    const protocol = getProtocol(provider.format);
    const extraParams =
      provider.providerId === "kimi"
        ? { thinking: { type: "disabled" } }
        : undefined;

    await executeStreamingRequest({
      url: normalizeProtocolUrl(provider.format, provider.baseUrl),
      headers: protocol.createHeaders(provider.apiKey),
      body: protocol.createRequestBody({
        model: selection.modelId,
        messages,
        tools: params.tools,
        extraParams,
      }),
      emits: params.emits,
      readStream: protocol.readStream,
    });
  }

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

  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }
}
