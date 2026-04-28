import React from "react";
import { CodeAgent, IDBHistory } from "../../../agent/src";
import type { Tool, Sandbox, CodeAgentPromptOptions, History, BoundHistory } from "../../../agent/src";
import type { PromptSections } from "../prompts";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig } from "./types";
import { createCheckStatusTool } from "./tools/check-status";
import { createInitProjectTool } from "./tools/init-project";
import { LoadingView, type ComChatStartViewProps, type LoadingViewProps } from "../ui/chat";
import type { PrdRenderProps } from "../ui/renders/prd-render";
import { LoadingViewWithStyles, ComChatStartViewWithStyles, PrdRenderWithStyles } from "../ui/renders/register";
import { context } from "../context";
import { ensureAIPanelOpen, ensureFocusComId } from "../utils/ensure-ai-panel-open";
import { CODE_SEARCH_USING_TOOLS_SECTION, CODE_SEARCH_EXAMPLES_SECTION } from "../prompts/mybricks";
import { buildFocusInfo } from "../utils/focus-dom-summary";

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
    renderLoadingView: (props: LoadingViewProps) => React.ReactElement;
  };
}

export interface SandboxConfig {
  /**
   * 系统提示词各节配置，由 Plugin 合并后下发给 sandbox。
   */
  promptSections?: PromptSections;
  /**
   * 运行时三方库列表（由宿主应用注入）。
   */
  availableLibraries?: any[];
  /**
   * 主题变量（由宿主应用注入）。
   */
  themes?: any[];
  /**
   * 组件运行时扩展
   */
  componentRuntime?: any;
}

/**
 * connectToAI 的返回值。
 * sandbox 可通过此对象访问该 comId 对应的 History 实例，用于版本管理。
 */
export interface ConnectToAIResult {
  /**
   * 该 comId 对应的 History 实例。
   * 总是从 agent 实例上取，保证与 Agent 内部共享同一个引用。
   * 若 Agent 未配置 history 则为 null（正常情况下不会出现）。
   */
  history: History | null;
}

export interface SandboxAPI {
  /**
   * sandbox 调用：向 Plugin 注册自己的能力（文件读写、designer 状态等），
   * Plugin 据此创建对应的 CodeAgent。
   * 返回 ConnectToAIResult，包含 history 引用供 sandbox 做版本管理。
   */
  connectToAI: (comId: string, config: RegistSandBoxConfig) => ConnectToAIResult;
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
  promptSections?: PromptSections;
  tools?: Tool[];
  availableLibraries?: any[];
  themes?: any[];
  componentRuntime?: any;
  /**
   * @experimental 是否开启代码搜索模式（默认 false）。此参数为过渡阶段配置，后续可能移除。
   * - false（默认）：在 getUserContext 中展示全量代码文件内容。
   * - true：仅注入文件路径列表，依赖 grep/glob 工具按需查找代码内容。
   */
  codeSearch?: boolean;
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 在 pluginAI() 初始化时调用一次。
 * 挂载 window._sandbox_（connectToAI / helpers / config）。
 */
export function setupSandbox(params: SetupSandboxParams): void {
  const { requestAsStream, agentsMd, skills, promptSections, tools, availableLibraries, themes, componentRuntime, codeSearch = false } = params;

  window._sandbox_ = {
    // ── sandbox → Plugin ──────────────────────────────────────────────────────
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      return connectToAI(comId, config, { requestAsStream, agentsMd, skills, promptOptions: promptSections?.agent, promptSections, tools, codeSearch });
    },

    // ── Plugin → sandbox（方法/渲染工具）──────────────────────────────────────
    helpers: {
      sendToAgent(comId: string, params: SendToAgentParams) {
        const agentKey = context.getAgentKey(comId);
        const agent = context.agentMap.get(agentKey);

        if (!agent) return;
        ensureAIPanelOpen(comId).then(() => {
          context.aiQueue.send(
            agentKey,
            async () => {
              await ensureFocusComId(comId);
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
        renderLoadingView: (props: LoadingViewProps): React.ReactElement =>
          React.createElement(LoadingViewWithStyles, props),
      },
    },

    // ── Plugin → sandbox（静态配置）──────────────────────────────────────────
    config: {
      promptSections,
      availableLibraries: availableLibraries ?? [],
      themes: themes ?? [],
      componentRuntime
    },
  };
}

// ─── 内部：注册单个 sandbox ───────────────────────────────────────────────────

interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  agentsMd?: string;
  skills?: any[];
  promptOptions?: CodeAgentPromptOptions;
  promptSections?: PromptSections;
  tools?: Tool[];
  codeSearch?: boolean;
}

function connectToAI(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, agentsMd, skills, promptOptions, promptSections, tools, codeSearch = false }: PluginParams
): ConnectToAIResult {
  const agentKey = context.getAgentKey(comId);

  if (context.agentMap.has(agentKey)) {
    // 已注册：直接从现有 agent 实例上取 history 返回，不重复初始化
    const existingAgent = context.agentMap.get(agentKey)!;
    return { history: existingAgent.getHistory() };
  }

  const sandbox: Sandbox = {
    getFiles: designer.getFiles.bind(designer),
    updateFiles: designer.updateFiles.bind(designer),
    deleteFiles: designer.deleteFiles.bind(designer),
    getContext: async () => {
      return designerRef.current?.exportToMessage() ?? null;
    },
    getUserContext: async () => {
      const files = await sandbox.getFiles();

      if (codeSearch) {
        // codeSearch 开启：仅提供文件路径列表，不含内容
        if (files.length === 0) {
          return '这是一个空项目，没有任何代码文件。\n';
        }
        const fileList = files.map((f) => `- ${f.path}`).join('\n');
        return `这是发送这条消息时的各类环境信息，并不会实时更新。\n\n# 项目文件列表\n\n${fileList}\n`;
      }

      // codeSearch 关闭（默认）：提供全量代码内容
      if (files.length === 0) {
        return '这是一个空项目，没有任何代码文件。\n';
      }

      const fileSectionParts: string[] = [];
      files.forEach((file) => {
        const { path, content } = file;
        const suffix = path.split('.').pop() ?? '';
        fileSectionParts.push(`\n#### ${path}\n\n\`\`\`${suffix}\n${content}\n\`\`\`\n`);
      });

      const resourcesCode = [
        '# 项目文件\n',
        ...fileSectionParts,
      ].join('');

      return `这是发送这条消息时的各类环境信息，并不会实时更新。
${resourcesCode}`;
    },
  };

  const designerRef: { current: Designer | undefined } = { current: designer };
  const checkStatusTool = createCheckStatusTool(designerRef);
  const initProjectTool = createInitProjectTool(sandbox);

  const agent = new CodeAgent({
    key: agentKey,
    history: new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: requestAsStream,
    sandbox,
    tools: [checkStatusTool, initProjectTool, ...(tools ?? [])],
    promptOptions,
    hooks,
    agentsMd,
    skills,
    subAgents: [],
    formatUserMessage: (params) => {
      const focusSnapshot = context.currentFocus;
      const ele = focusSnapshot?.focusArea?.ele;
      const focusInfoText = ele ? buildFocusInfo(ele) : undefined;
      const focusMeta = focusSnapshot ? {
        focus: {
          comId: focusSnapshot.comId,
          pageId: focusSnapshot.pageId,
          title: focusSnapshot.title,
          type: focusSnapshot.type,
          focusArea: focusSnapshot.focusArea ? { title: focusSnapshot.focusArea.title } : undefined,
        }
      } : {};
      return {
        message: focusInfoText ? `${params.message}\n\n${focusInfoText}` : params.message,
        attachments: params.attachments,
        meta: { ...params.meta, ...focusMeta },
      };
    },
  });

  context.sandboxMap.set(agentKey, { sandbox, designerRef });
  context.agentMap.set(agentKey, agent);

  return { history: agent.getHistory() };
}
