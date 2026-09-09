import React from "react";
import {
  createAgentSandboxFromV1,
} from "../../../agent/src";
import type { AgentSandbox, CreateAgentSandboxFromV1Options, SandboxV1 } from "../../../agent/src";
import { DisabledHandler, type DisabledRequestHandler } from "../disabled-handler";
import type { Tool, CodeAgentPlugin, History, TurnSender, SkillFile, UnifiedFile, AgentOptions, AgentMode, ChatChipInstance } from "../../../agent/src";
import type { PromptSections } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig, SandboxChipConfig, SandboxChipsConfig } from "./types";
import { LoadingView, type ComChatStartViewProps, type LoadingViewProps } from "../ui/chat";
import type { PrdRenderProps } from "../ui/renders/prd-render";
import { LoadingViewWithStyles, ComChatStartViewWithStyles, PrdRenderWithStyles } from "../ui/renders/register";
import { context } from "../context";
import { ensureAIPanelOpen, ensureFocusComId } from "../utils/ensure-ai-panel-open";
import { createDomChip } from "../utils/dom-info";
import { getSyncableInitialFiles } from "./initial-files";
import { chipRegistry } from "./chip-registry";
import { connectToAIFromV1 } from "./connect-v1";
import { connectToAIFromSandbox } from "./connect-sandbox";
import type {
  ConnectToAIResult,
  AgentRuntimeConfig,
  AgentRuntimeRef,
  RemoteAgentConfig,
  VirtualFilesRuntimeContext,
  PluginGetUserContextMessage,
  ProjectContext,
  PluginParams,
} from "./connect-shared";

export { chipRegistry };
export type { ConnectToAIResult, AgentRuntimeConfig, RemoteAgentConfig, VirtualFilesRuntimeContext, PluginGetUserContextMessage, ProjectContext };

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/**
 * plugin-ai 全局 chip 注册表。
 * 在 setup.ts 初始化时创建，供 chat-focus-view 等 UI 层注册 chip 类型。
 * 创建 CodeAgent 时会把当前已注册 chip 同步到 Agent 实例的 chipRegistry。
 */
// fileChipDef 已内置到 ChipRegistry 构造函数中，无需手动注册

function withMentionFocus(params: SendToAgentParams): SendToAgentParams {
  if (!params.mentionFocus) return params;

  const focus = context.currentFocus;
  if (!focus?.focusArea?.ele) return params;

  const chip = createDomChip(focus);
  return {
    ...params,
    message: `对于[[chip:${chip.id}]]${params.message}`,
    meta: {
      ...params.meta,
      chips: [...(params.meta?.chips ?? []), chip],
    },
  };
}

export interface SendToAgentParams {
  message: string;
  attachments?: { type: string; content: string; title?: string; size?: number }[];
  extra?: Record<string, any>;
  mode?: AgentMode;
  /** 指定本次请求使用的模型角色，会透传到请求层用于智能路由。 */
  aiRole?: string;
  /** 指定本次请求使用的 provider。与 modelId 搭配时会切换当前选中模型。 */
  providerId?: string;
  /** 指定本次请求使用的模型。providerId 可选，未传时会从已配置 providers 中匹配。 */
  modelId?: string;
  meta?: Record<string, any> & { chips?: ChatChipInstance[] };
  /** 显式提及当前聚焦元素：开启后会在消息最前面添加默认 focus 内容串。默认 false。 */
  mentionFocus?: boolean;
}

export interface SandboxHelpers {
  /**
   * Creates the default AgentSandbox implementation from a V1-compatible file
   * source. Its command transport provides structured grep out of the box.
   */
  createAgentSandboxFromV1: (sandbox: SandboxV1, options?: CreateAgentSandboxFromV1Options) => AgentSandbox;
  /**
   * 向当前 focus 的 Agent 发送消息（供 sandbox 组件运行时调用）。
   */
  sendToAgent: (comId: string, params: SendToAgentParams) => void;
  /**
   * 向指定 comId 的底部 Sender 草稿区追加内容，不触发发送。
   * 参数与 sendToAgent / controller.appendInput 保持一致：
   * - string：追加纯文本
   * - SendToAgentParams：追加 message，支持 attachments 与 meta.chips
   * - animation: true 时触发弹起 + 流光边框动画，吸引用户注意力（默认 false）
   */
  appendToSender: (comId: string, input: (string | SendToAgentParams | { message: string; meta?: { chips?: any[] }; animation?: boolean })) => void;
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
  /**
   * 禁用调试环境列表
   */
  disallowedDebugEnvs?: string[];
  codeRules?: string;
  designRules?: string;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * ⚠️ 试验性 API。
 *
 * 为当前聚焦的 CodeAgent 覆盖运行配置。配置会更新到当前 CodeAgent 实例，
 * agentKey 和 history 保持不变；建议在 Agent 空闲时调用。
 * @experimental
 */
/**
 * ⚠️ 试验性 API。
 *
 * 为当前聚焦的 CodeAgent 覆盖运行配置。配置会更新到当前 CodeAgent 实例，
 * agentKey 和 history 保持不变；建议在 Agent 空闲时调用。
 * @experimental
 */
// AgentRuntimeConfig is re-exported from connect-shared

/** @internal 由 pluginAI controller 使用的运行配置管理器。 */
export interface AgentRuntimeController {
  setAgentRuntime: (config: AgentRuntimeConfig) => void;
  clearAgentRuntime: () => void;
}

/**
 * connectToAI 的返回值。
 * sandbox 可通过此对象访问该 comId 对应的 History 实例，用于版本管理。
 */
/**
 * connectToAI 的返回值。
 * sandbox 可通过此对象访问该 comId 对应的 History 实例，用于版本管理。
 */
// ConnectToAIResult is re-exported from connect-shared

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
  /** 该 plugin 实例的模型路由命名空间；模型选择按 agentKey 在其内部隔离。 */
  llmPluginKey?: string;
  /**
   * 注入到根工程虚拟 FS 的文件（每个 turn 调用一次）。
   * 典型用途：在根工程放 `.agent/agent.md` 提供项目规范。
   * 同路径下 virtualFiles 优先级高于 designer.getFiles() 返回的真实文件。
   */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  /** Directory passed to local CodeAgent instances; defaults to `.agent`. */
  configDirName?: string;
  /** 本地 CodeAgent 的初始化文件快照；首次请求前会执行 diff/update/delete。 */
  initialFiles?: Array<Pick<UnifiedFile, "path" | "content">>;
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptSections?: PromptSections;
  tools?: Tool[];
  availableLibraries?: any[];
  themes?: any[];
  componentRuntime?: any;
  disallowedDebugEnvs?: string[];
  codeRules?: string;
  designRules?: string;
  /**
   * 外部增量注入的用户上下文文本，会在每个 turn 开始时读取一次，
   * 并拼接到内置项目空间上下文后一起注入给 CodeAgent。
   */
  getUserContextMessage?: PluginGetUserContextMessage;
  projectContext?: ProjectContext;
  /**
   * 外部自定义用户消息格式化函数。入参是经过 plugin sandbox 标准处理后的参数
   * （例如已追加 focus 信息、focus meta、sender），返回值会作为最终发给 CodeAgent 的用户消息。
   * TODO: 当前仅返回值中的 message 会生效，attachments/meta/sender 的处理语义需要再评估。
   */
  formatUserMessage?: AgentOptions["formatUserMessage"];
  /** 禁用的 Agent 运行模式；当只剩一种可用模式时隐藏模式切换器且不注册切换工具。 */
  disabledModes?: AgentOptions["disabledModes"];
  /**
   * 插件处于 disabled 时若仍尝试 requestAI / retry / 手动保存版本，会调用此回调。
   * 典型用途：由宿主弹出 toast / message 提示用户当前不可发送。
   * 参数支持字符串，或 `{ type: 'info' | 'warn', content }`。
   */
  onDisabledRequest?: DisabledRequestHandler;
  /** 透传给 CodeAgent 的历史记录实现，不传时使用内置 IDBHistory */
  history?: History;
  /** 服务端 Agent 配置。设置后会创建 HTTP Agent；未设置时使用本地 CodeAgent。 */
  remoteAgent?: RemoteAgentConfig;
  /** 消息发送者信息，注入到每条用户消息中，UI 展示时优先使用 */
  sender?: TurnSender;
  localAgent?: boolean;
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 在 pluginAI() 初始化时调用一次。
 * 挂载 window._sandbox_（connectToAI / helpers / config）。
 */
export function setupSandbox(params: SetupSandboxParams): AgentRuntimeController {
  const { requestAsStream, llmPluginKey, virtualFiles, configDirName, initialFiles, skills, plugins, promptSections, tools, availableLibraries, themes, componentRuntime, disallowedDebugEnvs, codeRules, designRules, getUserContextMessage, projectContext, formatUserMessage, disabledModes, onDisabledRequest, history, remoteAgent, sender, localAgent } = params;
  // 空数组与某些应用产生的 App 空文件组合都视为无效快照，本地与远程 Agent 均不读取。
  const syncableInitialFiles = getSyncableInitialFiles(initialFiles);
  const disabledHandler = new DisabledHandler({
    getDisabled: () => context.disabled,
    onDisabledRequest,
  });
  const agentRuntimeRefs = new Map<string, AgentRuntimeRef>();

  const pluginParams: PluginParams = {
    requestAsStream, llmPluginKey, virtualFiles, configDirName, initialFiles: syncableInitialFiles, skills, plugins, promptSections, tools, codeRules, designRules, getUserContextMessage, projectContext, formatUserMessage, disabledModes, disabledHandler, history, remoteAgent, sender, agentRuntimeRefs, localAgent,
  };

  window._sandbox_ = {
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      if (config.agentSandbox) {
        return connectToAIFromSandbox(comId, { agentSandbox: config.agentSandbox, hooks: config.hooks, chips: config.chips }, pluginParams);
      }
      if (!config.designer) {
        throw new Error("connectToAI requires either designer or agentSandbox");
      }
      return connectToAIFromV1(comId, { designer: config.designer, hooks: config.hooks, chips: config.chips }, pluginParams);
    },

    // ── Plugin → sandbox（方法/渲染工具）──────────────────────────────────────
    helpers: {
      createAgentSandboxFromV1(sandbox: SandboxV1, options?: CreateAgentSandboxFromV1Options) {
        return createAgentSandboxFromV1(sandbox, options);
      },
      sendToAgent(comId: string, params: SendToAgentParams) {
        const agentKey = context.getAgentKey(comId);
        const agent = context.agentMap.get(agentKey);

        if (!agent) return;
        ensureAIPanelOpen(comId).then(() => {
          context.aiQueue.send(
            agent,
            async () => {
              await ensureFocusComId(comId);
              const requestParams = withMentionFocus(params);
              await agent.requestAI(chipRegistry.formatRequestParams({
                message: requestParams.message,
                attachments: requestParams.attachments ?? [],
                ...(requestParams.extra ? { extra: requestParams.extra } : {}),
                ...(requestParams.mode ? { mode: requestParams.mode } : {}),
                ...(requestParams.aiRole ? { aiRole: requestParams.aiRole } : {}),
                ...(requestParams.providerId ? { providerId: requestParams.providerId } : {}),
                ...(requestParams.modelId ? { modelId: requestParams.modelId } : {}),
                ...(requestParams.meta ? { meta: requestParams.meta } : {}),
              }));
            },
            { message: params.message, attachments: params.attachments ?? [], ...(params.extra ? { extra: params.extra } : {}), ...(params.mode ? { mode: params.mode } : {}) }
          );
        });
      },
      appendToSender(comId: string, input: string | SendToAgentParams) {
        ensureAIPanelOpen(comId).then(() => {
          context.appendInput(comId, input);
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
      availableLibraries: availableLibraries ?? [],
      themes: themes ?? [],
      componentRuntime,
      disallowedDebugEnvs: disallowedDebugEnvs ?? [],
    },
  };

  return {
    setAgentRuntime(config) {
      const agentKey = context.getAgentKey();
      const runtimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
      runtimeRef.current = config;
      agentRuntimeRefs.set(agentKey, runtimeRef);
      runtimeRef.apply?.(config);
      window._sandbox_.config.componentRuntime = config.componentRuntime ?? componentRuntime;
    },
    clearAgentRuntime() {
      const agentKey = context.getAgentKey();
      const runtimeRef = agentRuntimeRefs.get(agentKey);
      if (!runtimeRef) return;
      runtimeRef.current = undefined;
      runtimeRef.apply?.(undefined);
      window._sandbox_.config.componentRuntime = componentRuntime;
    },
  };
}
