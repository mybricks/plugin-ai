import type { RequestAsStreamFn } from "@request/types";
import type { CustomProviderConfig } from "@request/providers";
import type { TestCase } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getUserText(params: Parameters<RequestAsStreamFn>[0]): string {
  const userText = params.messages?.at?.(-1)?.content ?? "";
  return typeof userText === "string" ? userText : JSON.stringify(userText);
}

function formatAutoRequestParams(params: Parameters<RequestAsStreamFn>[0]): string {
  return [
    `请求参数（auto 只消费 aiRole）：`,
    `- aiRole: ${params.aiRole}`,
    `- tools: ${params.tools?.length ?? 0}`,
    `- turnId: ${params.turnId ?? "(none)"}`,
  ].join("\n");
}

function formatCustomRequestParams(params: Parameters<RequestAsStreamFn>[0]): string {
  const model = params.model
    ? `${params.model.providerId}/${params.model.modelId}`
    : "(none)";
  return [
    `请求参数（custom 只消费 model）：`,
    `- model: ${model}`,
    `- tools: ${params.tools?.length ?? 0}`,
    `- turnId: ${params.turnId ?? "(none)"}`,
  ].join("\n");
}

/** Auto 智能路由模拟：只读取 aiRole，不读取 model。 */
const autoSmartRouter: RequestAsStreamFn = async (params) => {
  const chunks = [
    `🤖 [auto / 智能选择] 收到请求，模拟按 aiRole 自动选择模型...\n`,
    `${formatAutoRequestParams(params)}\n`,
    `📌 模拟路由决策：aiRole=${params.aiRole} -> Claude\n`,
    `收到消息：${getUserText(params)}`,
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
    model: `auto:${params.aiRole}`,
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

/** Custom 渠道模拟：只读取 model，不读取 aiRole。 */
const customModelRequest: RequestAsStreamFn = async (params) => {
  const modelId = params.model?.modelId;
  if (modelId === "gpt-4o") {
    const err = new Error("GPT-4o mock request failed");
    params.emits.cancel(() => {});
    params.emits.error(err);
    throw err;
  }

  const chunks = [
    `🧩 [custom / Claude] 请求成功...\n`,
    `${formatCustomRequestParams(params)}\n`,
    `收到消息：${getUserText(params)}`,
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
    model: "custom:claude",
  });
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

const AUTO_PROVIDER: CustomProviderConfig = {
  providerId: "auto",
  models: [{ id: "auto", name: "Auto" }],
  request: autoSmartRouter,
};

const CUSTOM_PROVIDER: CustomProviderConfig = {
  providerId: "custom",
  models: [
    { id: "claude", name: "Claude（成功）" },
    { id: "gpt-4o", name: "GPT-4o（失败）" },
  ],
  request: customModelRequest,
};

export const modelSwitchCase: TestCase = {
  id: "model-switch",
  name: "模型切换",
  group: "设置",
  description:
    "测试 CustomProviderConfig 下 auto 只消费 aiRole、custom 只消费 model 的模型选择器参数传递",
  expectedBehavior:
    "输入框左下角显示模型选择器，列表包含：智能选择 / Claude（成功）/ GPT-4o（失败），不展示 provider 分组标题。" +
    "选择智能选择时，回复只展示 aiRole；选择 Claude 时，回复只展示 model=custom/claude 并成功；选择 GPT-4o 时，按 model=custom/gpt-4o 模拟失败。",
  initialTurns: [],
  llm: {
    providers: [AUTO_PROVIDER, CUSTOM_PROVIDER],
  },
  request: autoSmartRouter,
};
