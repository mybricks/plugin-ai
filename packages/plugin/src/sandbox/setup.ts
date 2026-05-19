import React from "react";
import { CodeAgent, IDBHistory } from "../../../agent/src";
import type { Tool, Sandbox, CodeAgentPlugin, CodeAgentPromptOptions, History, BoundHistory, TurnSender, AdditionalDirectory } from "../../../agent/src";
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

type MaybePromise<T> = T | Promise<T>;

export type PluginGetUserContextMessage = () => MaybePromise<string | null | undefined>;

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
  plugins?: CodeAgentPlugin[];
  promptSections?: PromptSections;
  tools?: Tool[];
  availableLibraries?: any[];
  themes?: any[];
  componentRuntime?: any;
  /**
   * 外部增量注入的用户上下文文本，会在每个 turn 开始时读取一次，
   * 并拼接到内置项目空间上下文后一起注入给 CodeAgent。
   */
  getUserContextMessage?: PluginGetUserContextMessage;
  /** 透传给 CodeAgent 的历史记录实现，不传时使用内置 IDBHistory */
  history?: History;
  /** 消息发送者信息，注入到每条用户消息中，UI 展示时优先使用 */
  sender?: TurnSender;
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 在 pluginAI() 初始化时调用一次。
 * 挂载 window._sandbox_（connectToAI / helpers / config）。
 */
export function setupSandbox(params: SetupSandboxParams): void {
  const { requestAsStream, agentsMd, skills, plugins, promptSections, tools, availableLibraries, themes, componentRuntime, getUserContextMessage, history, sender } = params;

  window._sandbox_ = {
    // ── sandbox → Plugin ──────────────────────────────────────────────────────
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      return connectToAI(comId, config, { requestAsStream, agentsMd, skills, plugins, promptOptions: promptSections?.agent, promptSections, tools, getUserContextMessage, history, sender });
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
  plugins?: CodeAgentPlugin[];
  promptOptions?: CodeAgentPromptOptions;
  promptSections?: PromptSections;
  tools?: Tool[];
  getUserContextMessage?: PluginGetUserContextMessage;
  history?: History;
  sender?: TurnSender;
}

function connectToAI(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, agentsMd, skills, plugins, promptOptions, promptSections, tools, getUserContextMessage, history, sender }: PluginParams
): ConnectToAIResult {
  const agentKey = context.getAgentKey(comId);
  const effectivePlugins = context.applyPluginEnabledOverrides(plugins);

  if (context.agentMap.has(agentKey)) {
    // 已注册：直接从现有 agent 实例上取 history 返回，不重复初始化
    const existingAgent = context.agentMap.get(agentKey)!;
    return { history: existingAgent.getHistory() };
  }

  let agentRef: CodeAgent | undefined;
  const getEnabledAdditionalDirectories = (): AdditionalDirectory[] => {
    const enabledPlugins = agentRef?.getEnabledPlugins()
      ?? effectivePlugins?.filter((p) => p.enabled !== false)
      ?? [];
    return enabledPlugins.flatMap((p) => p.additionalDirectories ?? []);
  };
  const findAdditionalDirectory = (path: string, dirs: AdditionalDirectory[]) => {
    return dirs
      .filter((dir) => path.startsWith(dir.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
  };

  const sandbox: Sandbox = {
    // ── getFiles：主空间 + 所有扩展目录文件合并 ──────────────────────────────
    getFiles: async () => {
      const mainFiles = await designer.getFiles();
      const additionalDirectories = getEnabledAdditionalDirectories();
      if (!additionalDirectories.length) return mainFiles;
      const extraFiles = (await Promise.all(
        additionalDirectories.map(async (dir) => {
          const files = await dir.getFiles();
          return files.map(f => ({
            // 若 getFiles 返回的 path 不含前缀则自动补上
            path: f.path.startsWith(dir.path) ? f.path : `${dir.path}${f.path}`,
            content: f.content,
          }));
        })
      )).flat();
      return [...mainFiles, ...extraFiles];
    },

    // ── updateFiles：按路径前缀分组分发 ──────────────────────────────────────
    updateFiles: async (files) => {
      const additionalDirectories = getEnabledAdditionalDirectories();
      if (!additionalDirectories.length) return designer.updateFiles(files);
      const mainFiles: typeof files = [];
      const extraGroups = new Map<AdditionalDirectory, typeof files>();
      for (const file of files) {
        const dir = findAdditionalDirectory(file.path, additionalDirectories);
        if (dir) {
          if (!extraGroups.has(dir)) extraGroups.set(dir, []);
          extraGroups.get(dir)!.push(file);
        } else {
          mainFiles.push(file);
        }
      }
      const tasks: Promise<void>[] = [];
      if (mainFiles.length) tasks.push(designer.updateFiles(mainFiles));
      for (const [dir, dirFiles] of extraGroups) {
        if (!dir.updateFiles) {
          throw new Error(`AdditionalDirectory "${dir.path}" is read-only (no updateFiles provided)`);
        }
        tasks.push(dir.updateFiles(dirFiles));
      }
      await Promise.all(tasks);
    },

    // ── deleteFiles：按路径前缀分组分发 ──────────────────────────────────────
    deleteFiles: async (paths) => {
      const additionalDirectories = getEnabledAdditionalDirectories();
      if (!additionalDirectories.length) return designer.deleteFiles(paths);
      const mainPaths: string[] = [];
      const extraGroups = new Map<AdditionalDirectory, string[]>();
      for (const p of paths) {
        const dir = findAdditionalDirectory(p, additionalDirectories);
        if (dir) {
          if (!extraGroups.has(dir)) extraGroups.set(dir, []);
          extraGroups.get(dir)!.push(p);
        } else {
          mainPaths.push(p);
        }
      }
      const tasks: Promise<void>[] = [];
      if (mainPaths.length) tasks.push(designer.deleteFiles(mainPaths));
      for (const [dir, dirPaths] of extraGroups) {
        if (!dir.deleteFiles) {
          throw new Error(`AdditionalDirectory "${dir.path}" does not support deleteFiles`);
        }
        tasks.push(dir.deleteFiles(dirPaths));
      }
      await Promise.all(tasks);
    },

    getContext: async () => {
      return designerRef.current?.exportToMessage() ?? null;
    },

    // ── getUserContext：主项目空间 + 扩展目录描述 + 宿主自定义上下文 ──────────
    getUserContext: async () => {
      // 1. 主项目空间文件列表（只列主空间，不含扩展目录）
      const mainFiles = await designer.getFiles();
      let builtinContext: string;
      if (mainFiles.length === 0) {
        builtinContext = '项目空间为空，没有任何代码文件。\n';
      } else {
        const fileList = mainFiles.map((f) => {
          const lineCount = f.content.split('\n').length;
          return `- ${f.path} (${lineCount} lines)`;
        }).join('\n');
        builtinContext = `这是发送这条消息时的各类环境信息，并不会实时更新。\n\n# 项目空间\n\n${fileList}\n`;
      }

      // 2. 扩展目录描述（framework 自动生成，宿主零配置）
      let extraContext = '';
      const additionalDirectories = getEnabledAdditionalDirectories();
      if (additionalDirectories.length) {
        const parts = await Promise.all(
          additionalDirectories.map(async (dir) => {
            const dirFiles = await dir.getFiles();
            // 按文件后缀统计数量
            const suffixMap: Record<string, number> = {};
            for (const f of dirFiles) {
              const dotIdx = f.path.lastIndexOf('.');
              const ext = dotIdx !== -1 ? f.path.slice(dotIdx) : '(无后缀)';
              suffixMap[ext] = (suffixMap[ext] ?? 0) + 1;
            }
            const suffixSummary = Object.entries(suffixMap)
              .map(([ext, count]) => `${count} 个 ${ext}`)
              .join('、');
            const dirLabel = dir.description ? `${dir.description}（${dir.path}）` : dir.path;
            const countDesc = dirFiles.length === 0
              ? '暂无文件'
              : `共 ${dirFiles.length} 个文件（${suffixSummary}），请按需读取文件内容`;
            return `# 扩展目录：${dirLabel}\n${countDesc}。`;
          })
        );
        extraContext = '\n\n' + parts.join('\n\n');
      }

      // 3. 宿主自定义上下文
      const customContextMessage = await getUserContextMessage?.();

      const combined = builtinContext + extraContext;
      return customContextMessage
        ? `${combined}\n\n${customContextMessage}`
        : combined;
    },
  };

  const designerRef: { current: Designer | undefined } = { current: designer };
  const checkStatusTool = createCheckStatusTool(designerRef);
  const initProjectTool = createInitProjectTool(sandbox);

  const agent = new CodeAgent({
    key: agentKey,
    history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: requestAsStream,
    sandbox,
    tools: [checkStatusTool, initProjectTool, ...(tools ?? [])],
    promptOptions,
    hooks,
    agentsMd,
    skills,
    plugins: effectivePlugins,
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
        ...(sender ? { sender } : {}),
      };
    },
  });
  agentRef = agent;

  context.sandboxMap.set(agentKey, { sandbox, designerRef });
  context.agentMap.set(agentKey, agent);

  return { history: agent.getHistory() };
}
