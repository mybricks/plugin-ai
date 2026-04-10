import React from "react";
import { CodeAgent, IDBHistory } from "../../../agent/src";
import type { Tool, Sandbox, CodeAgentPromptOptions } from "../../../agent/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig } from "./types";
import { createCheckStatusTool } from "./tools/check-status";
import type { ComChatStartViewProps } from "../ui/chat";
import type { PrdRenderProps } from "../ui/renders/prd-render";
import { ComChatStartViewWithStyles, PrdRenderWithStyles } from "../ui/renders/register";
import { context } from "../context";
import { ensureAIPanelOpen } from "../utils/ensure-ai-panel-open";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface SendToAgentParams {
  message: string;
  attachments?: { type: string; content: string; title?: string; size?: number }[];
}

export interface SandboxHelpers {
  /**
   * 向当前 focus 的 Agent 发送消息（供 sandbox 组件运行时调用）。
   */
  sendToAgent: (comId: string, params: SendToAgentParams) => void;
  /**
   * 渲染工具方法。
   */
  renders: {
    renderStartView: (props: ComChatStartViewProps) => React.ReactElement;
    renderPrdView: (props?: PrdRenderProps) => React.ReactElement;
  };
}

export interface SandboxConfig {
  /**
   * 运行时三方库列表（由宿主应用注入）。
   */
  availableLibraries?: any[];
  /**
   * 主题变量（由宿主应用注入）。
   */
  themes?: any[];
}

export interface SandboxAPI {
  /**
   * sandbox 调用：向 Plugin 注册自己的能力（文件读写、designer 状态等），
   * Plugin 据此创建对应的 CodeAgent。
   */
  connectToAI: (comId: string, config: RegistSandBoxConfig) => void;
  /**
   * Plugin 提供给 sandbox 读取的运行时工具和方法。
   */
  helpers: SandboxHelpers;
  /**
   * Plugin 提供给 sandbox 读取的初始化配置（三方库、主题等）。
   */
  config: SandboxConfig;
}

// ─── Window 类型扩展 ──────────────────────────────────────────────────────────

declare global {
  interface Window {
    /**
     * Sandbox 与 Plugin 的统一交互 API。
     *
     * - `_sandbox_.connectToAI(comId, config)`：sandbox 注册自身能力给 Plugin
     * - `_sandbox_.helpers`：Plugin 提供给 sandbox 的工具方法（sendToAgent、renders）
     * - `_sandbox_.config`：Plugin 提供给 sandbox 的初始化配置（availableLibraries、themes）
     */
    _sandbox_: SandboxAPI;
  }
}

// ─── setupSandbox 入参 ────────────────────────────────────────────────────────

export interface SetupSandboxParams {
  requestAsStream: RequestAsStreamFn;
  agentsMd?: string;
  skills?: any[];
  promptOptions?: CodeAgentPromptOptions;
  tools?: Tool[];
  availableLibraries?: any[];
  themes?: any[];
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 在 pluginAI() 初始化时调用一次。
 * 挂载 window._sandbox_（connectToAI / helpers / config）。
 */
export function setupSandbox(params: SetupSandboxParams): void {
  const { requestAsStream, agentsMd, skills, promptOptions, tools, availableLibraries, themes } = params;

  window._sandbox_ = {
    // ── sandbox → Plugin ──────────────────────────────────────────────────────
    connectToAI(comId: string, config: RegistSandBoxConfig) {
      connectToAI(comId, config, { requestAsStream, agentsMd, skills, promptOptions, tools });
    },

    // ── Plugin → sandbox（方法/渲染工具）──────────────────────────────────────
    helpers: {
      sendToAgent(comId: string, params: SendToAgentParams) {
        const agentKey = context.getAgentKey(comId);
        const agent = context.agentMap.get(agentKey);

        if (!agent) return;
        ensureAIPanelOpen(agentKey).then(() => {
          context.aiQueue.send(
            agentKey,
            async () => {
              context.aiQueue.registerAbort(agentKey, () => agent.abort());
              await agent.requestAI({
                message: params.message,
                attachments: params.attachments ?? [],
              });
            },
            { message: params.message, attachments: params.attachments ?? [] }
          );
        });
      },
      renders: {
        renderStartView: (props: ComChatStartViewProps): React.ReactElement =>
          React.createElement(ComChatStartViewWithStyles, props),
        renderPrdView: (props?: PrdRenderProps): React.ReactElement =>
          React.createElement(PrdRenderWithStyles, props ?? { content: "" }),
      },
    },

    // ── Plugin → sandbox（静态配置）──────────────────────────────────────────
    config: {
      availableLibraries: availableLibraries ?? [],
      themes: themes ?? [],
    },
  };
}

// ─── 内部：注册单个 sandbox ───────────────────────────────────────────────────

interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  agentsMd?: string;
  skills?: any[];
  promptOptions?: CodeAgentPromptOptions;
  tools?: Tool[];
}

function connectToAI(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, agentsMd, skills, promptOptions, tools }: PluginParams
): void {
  const agentKey = context.getAgentKey(comId);

  if (context.agentMap.has(agentKey)) return;

  const sandbox: Sandbox = {
    getFiles: designer.getFiles.bind(designer),
    updateFiles: designer.updateFiles.bind(designer),
    deleteFiles: designer.deleteFiles.bind(designer),
    getContext: async () => {
      return designerRef.current?.exportToMessage() ?? null;
    },
  };

  const designerRef: { current: Designer | undefined } = { current: designer };
  const checkStatusTool = createCheckStatusTool(designerRef);

  const agent = new CodeAgent({
    key: agentKey,
    history: new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: requestAsStream,
    sandbox,
    tools: [checkStatusTool, ...(tools ?? [])],
    promptOptions,
    hooks,
    agentsMd,
    skills,
  });

  context.sandboxMap.set(agentKey, { sandbox, designerRef });
  context.agentMap.set(agentKey, agent);
}
