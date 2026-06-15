import type { RequestAsStreamFn, RequestAsStreamParams, ToolDescriptor } from "./types";
import { readSSEStream } from "./sse-parser";
import { sanitizeMessages } from "./base";

export interface ModelConfig {
  id: string;
  name: string;
}

/**
 * 直连供应商配置（OpenAI / Anthropic 等标准 API 格式）
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
 * 典型用途：配置一个 providerId 为 "auto" 的条目，走接入方自己的智能路由。
 */
export interface CustomProviderConfig {
  providerId: string;
  models: ModelConfig[];
  request: RequestAsStreamFn;
}

/**
 * ProviderConfig = 直连供应商 | 自定义请求，二者通过 union 统一。
 * 原有的 ProviderConfig 名字保持兼容，变为 union type。
 */
export type ProviderConfig = RemoteProviderConfig | CustomProviderConfig;

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

export interface LLMProvidersOptions {
  providers: ProviderConfig[];
  agentKey: string;
}

/** selectionChange 事件回调类型 */
export type SelectionChangeHandler = (selection: ModelSelection | null) => void;

const STORAGE_KEY_PREFIX = "plugin-ai:llm-selection:";
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

function getStorageKey(agentKey: string): string {
  return `${STORAGE_KEY_PREFIX}${agentKey}`;
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

function loadSelection(agentKey: string): ModelSelection | null {
  try {
    const key = getStorageKey(agentKey);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ModelSelection;
  } catch {
    return null;
  }
}

function saveSelection(agentKey: string, selection: ModelSelection): void {
  const key = getStorageKey(agentKey);
  localStorage.setItem(key, JSON.stringify(selection));
}

function validateProviderConfig(config: ProviderConfig): string | null {
  if (!config.providerId?.trim()) return "missing providerId";
  if (!config.models?.length) return "missing models";
  // CustomProviderConfig 不需要校验 baseUrl / apiKey
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
  // 当前仅支持 openai 格式
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

/**
 * LLMProviders 类：统一管理多供应商配置，提供请求执行、配置校验、模型切换能力。
 *
 * 支持两种 ProviderConfig：
 * - RemoteProviderConfig：直连供应商（baseUrl + apiKey），走内置 fetch 逻辑
 * - CustomProviderConfig：自定义请求，把请求 delegate 给外部 request 函数（如智能路由）
 *
 * 典型用法：将 llmProviders.request 直接传给 Agent 的 request 参数，
 * 切换 selection 后，Agent 下次请求时自动走新路由，无需重建 Agent。
 */
export class LLMProviders {
  private providers: Map<string, ProviderConfig>;
  private selection: ModelSelection | null;
  private agentKey: string;
  private selectionChangeHandlers: SelectionChangeHandler[] = [];

  constructor(options: LLMProvidersOptions) {
    this.providers = new Map();
    this.agentKey = options.agentKey;

    for (const provider of options.providers) {
      const error = validateProviderConfig(provider);
      if (!error) {
        this.providers.set(provider.providerId, provider);
      }
    }

    // 从 localStorage 恢复选中状态
    this.selection = loadSelection(this.agentKey);

    // 如果恢复的 selection 无效，则重置
    if (this.selection && !this.isValidSelection(this.selection)) {
      this.selection = null;
    }
    if (!this.selection && this.providers.size > 0) {
      const firstProvider = this.providers.values().next().value;
      if (firstProvider && firstProvider.models.length > 0) {
        this.selection = {
          providerId: firstProvider.providerId,
          modelId: firstProvider.models[0].id,
        };
        saveSelection(this.agentKey, this.selection);
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
   * 核心请求方法，签名与 RequestAsStreamFn 兼容。
   * 将此方法直接传给 Agent 的 request 参数，切换 selection 后路由自动更新。
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

    // CustomProviderConfig：直接 delegate 给外部 request 函数
    if (isCustomProvider(provider)) {
      return provider.request(params);
    }

    // RemoteProviderConfig：走内置 fetch 逻辑
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
      const requestBody = formatRequestBody(provider.format, sanitizeMessages(messages), model, tools, extraParams);
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
      // CustomProviderConfig 只要有 request 函数即有效
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
   * 设置当前选中的模型，并触发 selectionChange 事件
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
    saveSelection(this.agentKey, this.selection);
    this.emitSelectionChange();
  }

  /**
   * 获取当前选中的模型
   */
  getSelected(): ModelSelection | null {
    return this.selection;
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
