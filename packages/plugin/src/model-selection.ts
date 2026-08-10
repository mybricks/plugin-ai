import { LLMProvider } from "../../request/src";
import type { ModelCapabilities, ModelSelection, ProviderConfig } from "../../request/src";
import type { RequestAsStreamFn } from "../../agent/src";

export interface ModelSelectionStorage {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  remove(key: string): void;
}

export type ModelSelectionChangeHandler = (selection: ModelSelection | null) => void;
export type SelectableModel = ModelSelection & { modelName: string; description?: string };

/**
 * plugin 层的模型选择状态：默认模型、选择变更和 KV 持久化都在这里处理。
 * 不负责 HTTP / SSE / 自定义 provider 的请求协议。
 */
export class ModelSelectionController {
  private readonly providers: Map<string, ProviderConfig>;
  private readonly storage?: ModelSelectionStorage;
  private readonly storageKey?: string;
  private selected: ModelSelection | null = null;
  private handlers: ModelSelectionChangeHandler[] = [];

  constructor(options: {
    providers: ProviderConfig[];
    storage?: ModelSelectionStorage;
    storageKey?: string;
  }) {
    this.providers = new Map(options.providers.map((provider) => [provider.providerId, provider]));
    this.storage = options.storage;
    this.storageKey = options.storageKey;

    const saved = this.storageKey ? this.storage?.get<ModelSelection>(this.storageKey) : undefined;
    if (saved && this.isValidSelection(saved)) {
      this.selected = saved;
    } else {
      const firstProvider = this.providers.values().next().value as ProviderConfig | undefined;
      const firstModel = firstProvider?.models[0];
      if (firstProvider && firstModel) {
        this.selected = { providerId: firstProvider.providerId, modelId: firstModel.id };
      }
    }
  }

  isValid(): boolean {
    return this.selected !== null;
  }

  getSelected(): ModelSelection | null {
    return this.selected;
  }

  getValidModels(): SelectableModel[] {
    return Array.from(this.providers.values()).flatMap((provider) =>
      provider.models.map((model) => ({
        providerId: provider.providerId,
        modelId: model.id,
        modelName: model.name,
        description: model.description,
      }))
    );
  }

  getCurrentModelCapabilities(): ModelCapabilities | undefined {
    if (!this.selected) return undefined;
    return this.providers.get(this.selected.providerId)?.models
      .find((model) => model.id === this.selected!.modelId)?.capabilities;
  }

  setSelected(providerId: string | undefined, modelId: string): boolean {
    const selection = this.resolveSelection({ providerId, modelId });
    if (!selection) return false;
    this.selected = selection;
    if (this.storage && this.storageKey) this.storage.set(this.storageKey, selection);
    this.handlers.forEach((handler) => {
      try { handler(selection); } catch { /* ignore listener errors */ }
    });
    return true;
  }

  onSelectionChange(handler: ModelSelectionChangeHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((item) => item !== handler);
    };
  }

  /** 单次请求可指定模型，但不会修改 UI 当前选择或 KV。 */
  request = async (provider: LLMProvider, params: Parameters<RequestAsStreamFn>[0]): Promise<void> => {
    const selection = params.modelId
      ? this.resolveSelection({ providerId: params.providerId, modelId: params.modelId }) ?? this.selected
      : this.selected;
    if (!selection) {
      const error = new Error("no valid provider/model selected");
      params.emits.error(error);
      throw error;
    }
    return provider.request(params, selection);
  };

  private isValidSelection(selection: ModelSelection): boolean {
    return this.providers.get(selection.providerId)?.models.some((model) => model.id === selection.modelId) ?? false;
  }

  private resolveSelection(selection: Partial<ModelSelection>): ModelSelection | null {
    if (!selection.modelId) return null;
    if (selection.providerId) {
      const next = { providerId: selection.providerId, modelId: selection.modelId };
      return this.isValidSelection(next) ? next : null;
    }

    const currentProvider = this.selected ? this.providers.get(this.selected.providerId) : undefined;
    if (currentProvider?.models.some((model) => model.id === selection.modelId)) {
      return { providerId: currentProvider.providerId, modelId: selection.modelId };
    }
    for (const provider of this.providers.values()) {
      if (provider.models.some((model) => model.id === selection.modelId)) {
        return { providerId: provider.providerId, modelId: selection.modelId };
      }
    }
    return null;
  }
}
