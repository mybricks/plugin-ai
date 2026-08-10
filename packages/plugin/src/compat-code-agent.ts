import {
  CodeAgent as BaseCodeAgent,
} from "../../agent/src";
import type { CodeAgentOptions } from "../../agent/src";
import { createRequestAsStream, LLMProvider } from "../../request/src";
import type { ProviderConfig } from "../../request/src";
import { context } from "./context";
import { ModelSelectionController } from "./model-selection";

/** 供从 plugin 包直接构造 CodeAgent 的历史业务继续使用的 LLM 配置。 */
export interface CompatibleCodeAgentOptions extends CodeAgentOptions {
  llm?: {
    providers?: ProviderConfig[];
  };
}

/**
 * plugin 的兼容导出：保留旧版 `llm.providers` 入参，实际请求路由仍由 request 包承担。
 * Agent 包本身不再依赖 request 包。
 */
export class CodeAgent extends BaseCodeAgent {
  private readonly llmProvider?: LLMProvider;
  private readonly modelSelection?: ModelSelectionController;

  constructor(options: CompatibleCodeAgentOptions) {
    const { llm, request, ...agentOptions } = options;
    const llmProvider = llm?.providers?.length
      ? new LLMProvider({ providers: llm.providers })
      : undefined;
    const modelSelection = llmProvider
      ? new ModelSelectionController({
        providers: llmProvider.getProviders(),
        storage: context.kv,
        storageKey: `code-agent-model-selection:${options.key ?? "default"}`,
      })
      : undefined;

    super({
      ...agentOptions,
      // 旧行为：llm.providers 优先于 request；未配置时仍提供默认 request。
      request: llmProvider && modelSelection
        ? (params) => modelSelection.request(llmProvider, params)
        : request ?? createRequestAsStream(),
    });
    this.llmProvider = llmProvider;
    this.modelSelection = modelSelection;
  }

  getLLMProvider(): LLMProvider | undefined {
    return this.llmProvider;
  }

  getModelSelection(): ModelSelectionController | undefined {
    return this.modelSelection;
  }
}
