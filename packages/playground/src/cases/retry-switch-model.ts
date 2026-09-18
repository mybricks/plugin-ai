import type { RequestAsStreamFn } from "@request/types";
import type { CustomProviderConfig } from "@request/providers";
import type { TestCase } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** GPT-4o 始终返回业务异常（Invalid value），模拟该模型服务不可用 */
const brokenModelRequest: RequestAsStreamFn = async (params) => {
  params.emits.cancel(() => {});
  await delay(300);
  const err = new Error("Invalid value: model 'gpt-4o' is temporarily unavailable");
  params.emits.error(err);
  throw err;
};

/** Claude 正常返回内容 */
const workingModelRequest: RequestAsStreamFn = async (params) => {
  const chunks = [
    "✅ 已切换到 Claude，请求成功！\n",
    "这段内容证明「用其他模型重试」按钮生效：",
    "选中新模型后会自动对这一轮消息发起重试。",
  ];

  params.emits.cancel(() => {});
  await delay(300);
  for (const chunk of chunks) {
    await delay(80);
    params.emits.write(chunk);
  }
  params.emits.onUsage?.({
    promptTokens: 8,
    completionTokens: 20,
    totalTokens: 28,
    model: "claude",
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

const CUSTOM_PROVIDER: CustomProviderConfig = {
  providerId: "custom",
  models: [
    { id: "gpt-4o", name: "GPT-4o（异常）", description: "模拟模型服务异常，始终失败" },
    { id: "claude", name: "Claude（正常）", description: "切换到此模型可正常返回" },
  ],
  request: (params) => {
    return params.model?.modelId === "gpt-4o"
      ? brokenModelRequest(params)
      : workingModelRequest(params);
  },
};

export const retrySwitchModelCase: TestCase = {
  id: "retry-switch-model",
  name: "报错后用其他模型重试",
  group: "网络中断",
  priority: "P0",
  description:
    "预设两个模型：GPT-4o 始终报 Invalid value 业务异常，Claude 正常返回。用于验证错误气泡里「用其他模型重试」按钮的交互。",
  expectedBehavior:
    "1. 在输入框左下角模型选择器里选中「GPT-4o（异常）」并发送消息；\n" +
    "2. 消息气泡进入 error 状态，展示“模型服务异常，请重试或切换模型”，同时出现「用其他模型重试」与「重试」两个按钮；\n" +
    "3. 点击「用其他模型重试」，在弹出的列表中选择「Claude（正常）」，应立即以 Claude 发起重试并成功返回内容，同时输入框左下角的模型选择器也同步切换为 Claude。",
  initialTurns: [],
  llm: {
    providers: [CUSTOM_PROVIDER],
  },
  agentOptions: {
    retry: { maxRetries: 0 },
  },
  request: brokenModelRequest,
};
