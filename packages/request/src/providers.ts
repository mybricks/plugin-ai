import type { RequestAsStreamFn, RequestAsStreamParams, ToolDescriptor } from "./types";
import { readSSEStream } from "./sse-parser";
import { sanitizeMessages } from "./base";

export interface ModelConfig {
  id: string;
  name: string;
}

export interface ProviderConfig {
  format: "openai" | "anthropic";
  providerId: string;
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
}

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

export interface LLMProvidersOptions {
  providers: ProviderConfig[];
  agentKey: string;
}

const STORAGE_KEY_PREFIX = "plugin-ai:llm-selection:";

function getStorageKey(agentKey: string): string {
  return `${STORAGE_KEY_PREFIX}${agentKey}`;
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
  if (!config.baseUrl?.trim()) return "missing baseUrl";
  if (!config.apiKey?.trim()) return "missing apiKey";
  try {
    new URL(config.baseUrl);
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
 * LLMProviders 类：统一管理多供应商配置，提供请求执行、配置校验、模型切换能力
 */
export class LLMProviders {
  private providers: Map<string, ProviderConfig>;
  private selection: ModelSelection | null;
  private agentKey: string;

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
    
    // 如果恢复的 selection 无效，则选择第一个有效 provider 的第一个模型
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
   * 核心请求方法，签名与 RequestAsStreamFn 兼容
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
      const response = await fetch(provider.baseUrl, {
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
      if (!provider.apiKey || !provider.baseUrl || provider.models.length === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取可选模型列表
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
   * 设置当前选中的模型
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
