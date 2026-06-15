import type { RequestAsStreamFn } from "@request/types";
import type { RemoteProviderConfig, CustomProviderConfig } from "@request/providers";
import type { TestCase } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Auto 智能路由模拟：模拟"后端自动选模型"的场景 */
const autoSmartRouter: RequestAsStreamFn = async (params) => {
  const userText = params.messages?.at?.(-1)?.content ?? "";
  const chunks = [
    `🤖 [Auto / 智能路由] 收到请求，模拟后端自动选模型中...\n`,
    `📌 模拟路由决策：根据上下文选择了 gpt-4o\n`,
    `收到消息：${typeof userText === "string" ? userText : JSON.stringify(userText)}`,
  ];

  params.emits.cancel(() => {});
  await delay(200);
  for (const chunk of chunks) {
    await delay(80);
    params.emits.write(chunk);
  }
  params.emits.onUsage?.({
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
    model: "auto-routed:gpt-4o",
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

/** 自定义渠道模拟：模拟"内网代理"走另一套请求逻辑 */
const intranetProxyRequest: RequestAsStreamFn = async (params) => {
  const userText = params.messages?.at?.(-1)?.content ?? "";
  const chunks = [
    `🏢 [内网代理] 请求经由内网 LLM 代理转发...\n`,
    `🔗 代理地址：https://intranet.proxy.example.com/llm\n`,
    `收到消息：${typeof userText === "string" ? userText : JSON.stringify(userText)}`,
  ];

  params.emits.cancel(() => {});
  await delay(300);
  for (const chunk of chunks) {
    await delay(80);
    params.emits.write(chunk);
  }
  params.emits.onUsage?.({
    promptTokens: 8,
    completionTokens: 22,
    totalTokens: 30,
    model: "intranet-proxy:claude-3",
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

const AUTO_PROVIDER: CustomProviderConfig = {
  providerId: "auto",
  models: [{ id: "auto", name: "🤖 自动（智能路由）" }],
  request: autoSmartRouter,
};

const INTRANET_PROVIDER: CustomProviderConfig = {
  providerId: "intranet-proxy",
  models: [{ id: "intranet-proxy", name: "🏢 内网代理" }],
  request: intranetProxyRequest,
};

const REMOTE_PROVIDER: RemoteProviderConfig = {
  format: "openai" as const,
  providerId: "mock-openai",
  // baseUrl 随便写，会被 CustomProviderConfig 的 auto 路由覆盖
  // 这里加一个直连条目，验证 RemoteProviderConfig 也能正常显示在列表中
  baseUrl: "https://mock-openai.example.com",
  apiKey: "playground-key",
  models: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini（直连 Mock）" },
    { id: "gpt-4o", name: "GPT-4o（直连 Mock）" },
  ],
};

/** RemoteProviderConfig 对应的模拟请求（当选中直连模型时走这里） */
const remoteModelRequest: RequestAsStreamFn = async (params) => {
  // 注意：RemoteProviderConfig 会走 LLMProviders 内置 fetch，这里不会被直接调用
  // 仅作为 testCase.request 的 fallback（实际测试中直连会因为 mock URL 报错）
  const userText = params.messages?.at?.(-1)?.content ?? "";
  const chunks = [
    `📡 [直连 Mock] 模拟直连供应商 fetch...\n`,
    `收到消息：${typeof userText === "string" ? userText : JSON.stringify(userText)}`,
  ];
  params.emits.cancel(() => {});
  await delay(150);
  for (const chunk of chunks) {
    await delay(80);
    params.emits.write(chunk);
  }
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

export const modelSwitchCase: TestCase = {
  id: "model-switch",
  name: "模型切换",
  group: "设置",
  description:
    "测试 CustomProviderConfig（auto 智能路由 + 内网代理）与 RemoteProviderConfig 混合场景下的模型选择器",
  expectedBehavior:
    "输入框左下角显示模型选择器，列表包含：🤖 自动（智能路由）/ 🏢 内网代理 / GPT-4o Mini（直连 Mock）/ GPT-4o（直连 Mock）。" +
    "切换到 Auto 或内网代理后发消息，回复内容会明确显示走的哪条路由（前缀不同）；切换到直连 Mock 时因 URL 为虚假地址会报网络错误，符合预期。",
  initialTurns: [],
  llmProviders: [AUTO_PROVIDER, INTRANET_PROVIDER, REMOTE_PROVIDER],
  request: remoteModelRequest,
};
