import type { RequestAsStreamFn, RequestAsStreamParams, ToolDescriptor } from "./types";
import { readSSEStream } from "./sse-parser";
import { sanitizeMessages, preprocessMessagesForModel } from "./base";

// ─── ModelCapabilities ────────────────────────────────────────────────────────

/**
 * 模型的多模态能力声明（per-model 粒度）。
 * 可选，不传时视为全支持（兜底宽松策略，报错由上游处理）。
 */
export interface ModelCapabilities {
  input?: {
    /** 是否支持用户消息中的图片附件 */
    image?: boolean;
    /** 是否支持用户消息中的 PDF 附件 */
    pdf?: boolean;
  };
  /**
   * 是否支持在 tool result 中内嵌媒体内容。
   * - true：附件直接内嵌到 tool result content block 中发送
   * - false：媒体附件提取为紧随 assistant 消息之后的合成 user 消息
   *
   * 注意：该字段与 input.image 相互独立——有些模型支持用户消息放图片，
   * 但不支持 tool result 内嵌媒体（如 gemini-2.x）。
   */
  toolResultMedia?: boolean;
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

// ─── ModelConfig ──────────────────────────────────────────────────────────────

export interface ModelConfig {
  id: string;
  name: string;
  /**
   * 模型多模态能力声明（可选）。
   * 不传时视为全支持（兜底宽松，API 报错由上游处理）。
   */
  capabilities?: ModelCapabilities;
}

// ─── ProviderConfig ───────────────────────────────────────────────────────────

/**
 * 直连供应商配置（OpenAI / Anthropic 等标准 API 格式）。
 *
 * LLMProviders 内置多模态附件预处理：发送前自动按 ModelConfig.capabilities 做分流——
 * - role=user 消息里的图片/PDF：不支持时替换为 ERROR 文本提示
 * - role=tool 消息里的 attachments：支持内嵌时追加到 content，不支持时提取为合成 user 消息
 *
 * capabilities 不传时视为全支持（兼底宽松策略，API 报错由上游处理）。
 */
export interface RemoteProviderConfig {
  providerId: string;
  format: "openai" | "anthropic";
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
}

/**
 * 自定义请求 provider —— 不直连供应商，而是把请求 delegate 给外部 request 函数。
 * 调用方完全控制请求逻辑，LLMProviders 不做任何预处理。
 * 典型用途：配置一个 providerId 为 "auto" 的条目，走接入方自己的智能路由。
 *
 * 多模态附件处理需调用方在 request 函数内自行处理。
 * 可利用 preprocessMessagesForModel + sanitizeMessages 工具函数（导出自 base.ts）。
 */
export interface CustomProviderConfig {
  providerId: string;
  models: ModelConfig[];
  request: RequestAsStreamFn;
}

/**
 * ProviderConfig = 直连供应商 | 自定义请求，二者通过 union 统一。
 */
export type ProviderConfig = RemoteProviderConfig | CustomProviderConfig;

// ─── ModelSelection ───────────────────────────────────────────────────────────

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

// ─── LLMProvidersOptions ──────────────────────────────────────────────────────

export interface LLMProvidersOptions {
  providers: ProviderConfig[];
}

/** selectionChange 事件回调类型 */
export type SelectionChangeHandler = (selection: ModelSelection | null) => void;

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

// ─── LLMProviders ─────────────────────────────────────────────────────────────

/**
 * LLMProviders：统一管理多供应商配置，提供请求执行、配置校验、模型切换能力。
 *
 * 支持两种 ProviderConfig：
 * - RemoteProviderConfig：直连供应商（baseUrl + apiKey），走内置 fetch 逻辑，
 *   发送前按当前 ModelConfig.capabilities 做多模态预处理。
 * - CustomProviderConfig：自定义请求，把请求 delegate 给外部 request 函数；
 *   调用方完全控制适配逻辑，LLMProviders 不做额外预处理。
 *
 * 设计原则：
 * - 纯内存状态，不做任何 localStorage 持久化；持久化由上层（Agent）负责。
 * - 与 history 模式对称：通过 AgentOptions.llmProvider 注入 Agent。
 */
export class LLMProviders {
  private providers: Map<string, ProviderConfig>;
  private selection: ModelSelection | null;
  private selectionChangeHandlers: SelectionChangeHandler[] = [];

  constructor(options: LLMProvidersOptions) {
    this.providers = new Map();

    for (const provider of options.providers) {
      const error = validateProviderConfig(provider);
      if (!error) {
        this.providers.set(provider.providerId, provider);
      }
    }

    // 初始化时默认选中第一个 provider 的第一个 model
    this.selection = null;
    if (this.providers.size > 0) {
      const firstProvider = this.providers.values().next().value!;
      if (firstProvider.models.length > 0) {
        this.selection = {
          providerId: firstProvider.providerId,
          modelId: firstProvider.models[0].id,
        };
      }
    }
  }

  private isValidSelection(selection: ModelSelection): boolean {
    const provider = this.providers.get(selection.providerId);
    if (!provider) return false;
    return provider.models.some((m) => m.id === selection.modelId);
  }

  /**
   * 订阅 selection 变化事件。返回取消订阅函数。
   */
  onSelectionChange(handler: SelectionChangeHandler): () => void {
    this.selectionChangeHandlers.push(handler);
    return () => {
      this.selectionChangeHandlers = this.selectionChangeHandlers.filter((h) => h !== handler);
    };
  }

  private emitSelectionChange(): void {
    for (const handler of this.selectionChangeHandlers) {
      try {
        handler(this.selection);
      } catch {
        // ignore
      }
    }
  }

  /**
   * 获取当前选中 model 的 capabilities。
   * 可供 UI 层在模型切换时检查是否兼容当前附件，也在 request 内部用于预处理。
   * 未声明时返回 undefined（视为全支持）。
   */
  getCurrentModelCapabilities(): ModelCapabilities | undefined {
    if (!this.selection) return undefined;
    const provider = this.providers.get(this.selection.providerId);
    if (!provider) return undefined;
    const model = provider.models.find((m) => m.id === this.selection!.modelId);
    return model?.capabilities;
  }

  /**
   * 核心请求方法，签名与 RequestAsStreamFn 兼容。
   *
   * - RemoteProviderConfig：发送前自动按 ModelConfig.capabilities 做多模态预处理，再走内置 fetch。
   * - CustomProviderConfig：直接 delegate 给外部 request 函数，不做任何预处理。
   */
  request: RequestAsStreamFn = async (params: RequestAsStreamParams) => {
    const { messages, emits, tools } = params;
    const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;

    if (!this.selection) {
      const err = new Error("no valid provider/model selected");
      error(err);
      throw err;
    }

    const provider = this.providers.get(this.selection.providerId);
    if (!provider) {
      const err = new Error(`provider not found: ${this.selection.providerId}`);
      error(err);
      throw err;
    }

    // CustomProviderConfig：直接 delegate，调用方自行处理多模态适配
    if (isCustomProvider(provider)) {
      return provider.request(params);
    }

    // RemoteProviderConfig：发送前做多模态预处理
    const model = this.selection.modelId;

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
      const capabilities = this.getCurrentModelCapabilities();
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
  };

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
   * 获取可选模型列表（含 CustomProviderConfig 中的模型）
   */
  getValidModels(): Array<ModelSelection & { modelName: string }> {
    const result: Array<ModelSelection & { modelName: string }> = [];
    this.providers.forEach((provider) => {
      provider.models.forEach((model) => {
        result.push({
          providerId: provider.providerId,
          modelId: model.id,
          modelName: model.name,
        });
      });
    });
    return result;
  }

  /**
   * 设置当前选中的模型，并触发 selectionChange 事件。
   * 注意：不做持久化，持久化由上层（Agent）负责。
   */
  setSelected(providerId: string, modelId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      console.warn(`[LLMProviders] provider not found: ${providerId}`);
      return;
    }
    const model = provider.models.find((m) => m.id === modelId);
    if (!model) {
      console.warn(`[LLMProviders] model not found: ${modelId} in provider ${providerId}`);
      return;
    }
    this.selection = { providerId, modelId };
    this.emitSelectionChange();
  }

  /**
   * 获取当前选中的模型
   */
  getSelected(): ModelSelection | null {
    return this.selection;
  }

  /**
   * 外部恢复持久化 selection（如 Agent 启动时从 storage 读取后调用）。
   * 如果传入的 selection 不合法，静默忽略。
   */
  restoreSelection(selection: ModelSelection): void {
    if (this.isValidSelection(selection)) {
      this.selection = selection;
      // 不触发 selectionChange，这是静默恢复
    }
  }

  /**
   * 获取所有供应商配置
   */
  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取当前供应商ID
   */
  getProviderId(): string | null {
    return this.selection?.providerId ?? null;
  }
}
