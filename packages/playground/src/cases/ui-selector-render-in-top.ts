import type { RequestAsStreamFn } from "@request/types";
import type { CustomProviderConfig } from "@request/providers";
import type { TestCase } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 模拟请求：回显当前所用模型 */
const mockRequest: RequestAsStreamFn = async (params) => {
  const model = params.model
    ? `${params.model.providerId}/${params.model.modelId}`
    : `auto/${params.aiRole ?? "default"}`;
  const userText =
    typeof params.messages?.at?.(-1)?.content === "string"
      ? (params.messages.at(-1)!.content as string)
      : "（未知消息）";

  const chunks = [
    `✅ [selectorRenderInTop] 选择器已移至输入框上方。\n`,
    `当前模型：${model}\n`,
    `收到消息：${userText}`,
  ];

  params.emits.cancel(() => {});
  await delay(200);
  for (const chunk of chunks) {
    await delay(60);
    params.emits.write(chunk);
  }
  params.emits.onFinishReason?.("stop");
  params.emits.complete?.("");
};

const AUTO_PROVIDER: CustomProviderConfig = {
  providerId: "auto",
  models: [{ id: "auto", name: "Auto（智能选择）" }],
  request: mockRequest,
};

const CUSTOM_PROVIDER: CustomProviderConfig = {
  providerId: "custom",
  models: [
    { id: "claude", name: "Claude 3.5" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  request: mockRequest,
};

/**
 * 测试 selectorRenderInTop=true：
 * 模式选择 + 模型选择渲染在 renderFocus / 附件下方，输入框上方。
 */
export const selectorRenderInTopCase: TestCase = {
  id: "ui-selector-render-in-top",
  name: "选择器渲染在输入框上方",
  group: "UI 渲染",
  description:
    "开启 selectorRenderInTop 后，模式选择器和模型选择器从底部操作栏移至输入框上方（renderFocus / 附件区域之下）。",
  expectedBehavior:
    "模式切换器和模型选择器出现在输入框上方，底部操作栏不再展示这两个控件；其他功能（发送、附件等）不受影响。",
  initialTurns: [],
  llm: {
    providers: [AUTO_PROVIDER, CUSTOM_PROVIDER],
  },
  request: mockRequest,
  selectorRenderInTop: true,
};
