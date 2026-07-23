import React from "react";
import type { RequestAsStreamFn } from "@request/types";
import type { CustomProviderConfig } from "@request/providers";
import { AgentModeEnum } from "@agent/mode-manager";
import type { TestCase } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getUserText(params: Parameters<RequestAsStreamFn>[0]): string {
  const userText = params.messages?.at?.(-1)?.content ?? "";
  return typeof userText === "string" ? userText : JSON.stringify(userText);
}

function formatRequestParams(providerLabel: string, params: Parameters<RequestAsStreamFn>[0]): string {
  const model = params.model
    ? `${params.model.providerId}/${params.model.modelId}`
    : "(none)";

  return [
    `[${providerLabel}] requestAI 参数`,
    `- aiRole: ${params.aiRole ?? "(none)"}`,
    `- model: ${model}`,
    `- tools: ${params.tools?.length ?? 0}`,
    `- turnId: ${params.turnId ?? "(none)"}`,
    "",
    `用户消息：${getUserText(params)}`,
  ].join("\n");
}

function createEchoRequest(providerLabel: string): RequestAsStreamFn {
  return async (params) => {
    params.emits.cancel(() => {});
    await delay(120);

    const content = formatRequestParams(providerLabel, params);
    for (const chunk of content.match(/[\s\S]{1,48}/g) ?? []) {
      await delay(25);
      params.emits.write(chunk);
    }

    params.emits.onUsage?.({
      promptTokens: 12,
      completionTokens: 18,
      totalTokens: 30,
      model: params.model ? `${params.model.providerId}:${params.model.modelId}` : providerLabel,
    });
    params.emits.onFinishReason?.("stop");
    params.emits.complete("");
  };
}

const AUTO_PROVIDER: CustomProviderConfig = {
  providerId: "auto",
  models: [{ id: "auto", name: "Auto Router" }],
  request: createEchoRequest("auto"),
};

const CUSTOM_PROVIDER: CustomProviderConfig = {
  providerId: "custom",
  models: [
    { id: "claude", name: "Claude" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  request: createEchoRequest("custom"),
};

const BACKUP_PROVIDER: CustomProviderConfig = {
  providerId: "backup",
  models: [
    { id: "claude", name: "Backup Claude" },
  ],
  request: createEchoRequest("backup"),
};

const buttonConfigs = [
  {
    label: "Auto / junior",
    title: "modelId=auto, aiRole=junior",
    request: {
      message: "右侧按钮触发：走 auto provider，并用 junior 角色。",
      modelId: "auto",
      aiRole: "junior",
    },
  },
  {
    label: "Auto / expert",
    title: "modelId=auto, aiRole=expert",
    request: {
      message: "右侧按钮触发：仍走 auto provider，但切换 expert 角色。",
      modelId: "auto",
      aiRole: "expert",
    },
  },
  {
    label: "Custom Claude",
    title: "providerId=custom, modelId=claude",
    request: {
      message: "右侧按钮触发：显式指定 custom/claude。",
      providerId: "custom",
      modelId: "claude",
      aiRole: "architect",
    },
  },
  {
    label: "Custom GPT-4o",
    title: "providerId=custom, modelId=gpt-4o",
    request: {
      message: "右侧按钮触发：显式指定 custom/gpt-4o。",
      providerId: "custom",
      modelId: "gpt-4o",
      aiRole: "image",
    },
  },
  {
    label: "Claude no provider",
    title: "只传 modelId=claude，验证 providerId 可选",
    request: {
      message: "右侧按钮触发：只传 modelId=claude，优先沿用当前 provider，找不到再匹配第一个 provider。",
      modelId: "claude",
      aiRole: "default",
    },
  },
  {
    label: "Plan + Claude",
    title: "同时指定 mode=plan 和 custom/claude",
    request: {
      message: "右侧按钮触发：计划模式下请求 custom/claude。",
      providerId: "custom",
      modelId: "claude",
      aiRole: "architect",
      mode: AgentModeEnum.Plan,
    },
  },
] as const;

function RequestAIButtons({ agent }: Parameters<NonNullable<TestCase["renderRightPanelActions"]>>[0]) {
  return (
    <div className="pg-action-panel">
      <div className="pg-action-panel-header">
        <span className="pg-action-panel-title">requestAI Buttons</span>
        <span className="pg-action-panel-subtitle">aiRole / providerId / modelId</span>
      </div>
      <div className="pg-action-grid">
        {buttonConfigs.map((item) => (
          <button
            key={item.label}
            className="pg-action-btn"
            title={item.title}
            disabled={!agent}
            onClick={() => {
              void agent?.requestAI(item.request);
            }}
          >
            <span>{item.label}</span>
            <small>{item.title}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export const requestAIButtonsCase: TestCase = {
  id: "request-ai-buttons",
  name: "requestAI 按钮触发",
  group: "设置",
  description: "右侧提供多种按钮，直接调用 agent.requestAI 并携带 aiRole / providerId / modelId。",
  expectedBehavior:
    "点击右侧按钮后，ChatPanel 中展示 mock provider 收到的 aiRole 与 model；只传 modelId=claude 时 providerId 可选，并会按当前 provider 优先匹配。",
  initialTurns: [],
  request: createEchoRequest("fallback"),
  llm: {
    providers: [AUTO_PROVIDER, CUSTOM_PROVIDER, BACKUP_PROVIDER],
  },
  renderRightPanelActions: (params) => <RequestAIButtons {...params} />,
};
