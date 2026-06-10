import type { RequestAsStreamFn } from "@request/types";
import type { TestCase } from "./types";
import { context } from "@plugin/context";

const MOCK_PROVIDERS = [
  {
    format: "openai" as const,
    providerId: "mock-openai",
    baseUrl: "https://mock-openai.example.com",
    apiKey: "playground-key",
    models: [
      { id: "gpt-4o-mini-playground", name: "GPT-4o Mini Mock" },
      { id: "gpt-4o-playground", name: "GPT-4o Mock" },
    ],
  },
  {
    format: "openai" as const,
    providerId: "mock-kimi",
    baseUrl: "https://mock-kimi.example.com",
    apiKey: "playground-key",
    models: [
      { id: "kimi-k2-playground", name: "Kimi K2 Mock" },
    ],
  },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const modelSwitchRequest: RequestAsStreamFn = async (params) => {
  const selection = context.llmProviders?.getSelected();
  const models = context.llmProviders?.getValidModels() ?? [];
  const modelName = selection
    ? models.find((model) => (
        model.providerId === selection.providerId &&
        model.modelId === selection.modelId
      ))?.modelName ?? selection.modelId
    : "未选择模型";

  const providerId = selection?.providerId ?? "none";
  const modelId = selection?.modelId ?? "none";
  const userText = params.messages?.at?.(-1)?.content ?? "";
  const chunks = [
    `当前模型：${modelName}\n`,
    `Provider：${providerId}\n`,
    `Model ID：${modelId}\n`,
    `收到消息：${typeof userText === "string" ? userText : JSON.stringify(userText)}`,
  ];

  await delay(200);
  for (const chunk of chunks) {
    await delay(60);
    params.emits.write(chunk);
  }
  params.emits.onUsage?.({
    promptTokens: 12,
    completionTokens: 18,
    totalTokens: 30,
    model: modelId,
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

export const modelSwitchCase: TestCase = {
  id: "model-switch",
  name: "模型切换",
  group: "设置",
  description: "测试输入框模型选择器，切换不同供应商和模型后请求使用最新选择",
  expectedBehavior: "输入框左下角显示模型选择器；切换模型后发送消息，回复和 usage.model 会回显当前模型",
  initialTurns: [],
  llmProviders: MOCK_PROVIDERS,
  request: modelSwitchRequest,
};
