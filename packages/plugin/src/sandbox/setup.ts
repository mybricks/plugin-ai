import React from "react";
import { AGENT_INTERNAL_FILE_EXCLUDE, CodeAgent, IDBHistory, isFileExcluded } from "../../../agent/src";
import { DisabledHandler, type DisabledRequestHandler } from "../disabled-handler";
import { ChipRegistry } from "../../../agent/src";
import { splitFrontmatter, getFrontmatterString, getFrontmatterStringArray } from "../../../agent/src/utils/frontmatter";
import { GLOB_TOOL_NAME, createInitProjectTool } from "../../../agent/src/code-agent/tools";
import { getCodeAgentSystemPrompt } from "../../../agent/src/code-agent/prompt";
import type { Tool, Sandbox, CodeAgentPlugin, History, BoundHistory, TurnSender, AdditionalDirectory, AgentsMdConfig, SkillFile, UnifiedFile, AgentOptions, AgentMode, ChatChipInstance } from "../../../agent/src";
import type { PromptSections } from "../../../kit/src";
import { buildDevelopmentGuideContext, buildExtraProjectInfoSection, buildProjectInfoSection, promptSectionsAdaptToPromptOption } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig, SandboxChipConfig, SandboxChipsConfig } from "./types";
import { createCheckStatusTool } from "./tools/check-status";
import { LoadingView, type ComChatStartViewProps, type LoadingViewProps } from "../ui/chat";
import { HttpAgent } from "../ui/chat/chat-panel/http-agent";
import type { PrdRenderProps } from "../ui/renders/prd-render";
import { LoadingViewWithStyles, ComChatStartViewWithStyles, PrdRenderWithStyles } from "../ui/renders/register";
import { context } from "../context";
import { ensureAIPanelOpen, ensureFocusComId } from "../utils/ensure-ai-panel-open";
import { createDomChip } from "../utils/dom-info";
import { registerChipRemoveHandlers } from "./chip-remove";
import { attachFiles, getSyncableInitialFiles, hasInitialFiles } from "./initial-files";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/**
 * plugin-ai 全局 chip 注册表。
 * 在 setup.ts 初始化时创建，供 chat-focus-view 等 UI 层注册 chip 类型。
 * 创建 CodeAgent 时会把当前已注册 chip 同步到 Agent 实例的 chipRegistry。
 */
export const chipRegistry = new ChipRegistry();
// fileChipDef 已内置到 ChipRegistry 构造函数中，无需手动注册

function normalizeChipConfigs(chips?: SandboxChipsConfig): SandboxChipConfig[] {
  if (!chips) return [];
  if (Array.isArray(chips)) return chips;

  return Object.entries(chips).map(([type, config]) => ({
    ...config,
    type: config.type ?? type,
  }));
}

function registerChips(agentKey: string, chips?: SandboxChipsConfig): void {
  const configs = normalizeChipConfigs(chips);
  if (!configs.length) return;

  for (const config of configs) {
    if (config.def) {
      chipRegistry.register(config.def);
    }
  }
  registerChipRemoveHandlers(agentKey, configs);
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

export type PluginGetUserContextMessage = () => MaybePromise<string | null | undefined>;

export interface VirtualFilesRuntimeContext {
  getEffectiveLibrariesSection: (options?: { path?: string; moduleKey?: string }) => Promise<string>;
}

/**
 * ⚠️ 试验性 API。
 *
 * 为当前聚焦的 CodeAgent 覆盖运行配置。配置会更新到当前 CodeAgent 实例，
 * agentKey 和 history 保持不变；建议在 Agent 空闲时调用。
 * @experimental
 */
export interface AgentRuntimeConfig {
  promptSections?: PromptSections;
  tools?: Tool[];
  skills?: SkillFile[];
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  componentRuntime?: any;
}

/** 服务端 Agent 的初始化配置。传给 pluginAI 的 remoteAgent 时会创建 HTTP Agent。 */
export interface RemoteAgentConfig {
  /** 方舟测试环境默认值：http://localhost:3001/agents/api */
  baseUrl?: string;
  /** 服务端 workspaceId；通常对应平台 conversation id。 */
  workspaceId: string;
  /** 服务端 agentId。未传时使用 workspace 的 default agent。 */
  agentId?: string;
}

/** @internal 由 pluginAI controller 使用的运行配置管理器。 */
export interface AgentRuntimeController {
  setAgentRuntime: (config: AgentRuntimeConfig) => void;
  clearAgentRuntime: () => void;
}

interface AgentRuntimeRef {
  current: AgentRuntimeConfig | undefined;
  apply?: (config: AgentRuntimeConfig | undefined) => void;
}

/**
 * connectToAI 的返回值。
 * sandbox 可通过此对象访问该 comId 对应的 History 实例，用于版本管理。
 */
export interface ConnectToAIResult {
  /**
   * 该 comId 对应的、已绑定 agentKey 的 History 视图。
   * 总是从 agent 实例上取，保证与 Agent 内部共享同一个引用。
   * 若 Agent 未配置 history 则为 null（正常情况下不会出现）。
   */
  history: BoundHistory | null;
  /** 统一的 disabled 判断与消息处理。 */
  disabledHandler: DisabledHandler;
  /** 当前 History 是否由 remote Agent 的 workspace API 提供。 */
  isRemoteAgent: boolean;
  /**
   * 文件初始化完成后兑现，是 Runtime 和首个 Agent 请求的共同前置条件。
   * remote Agent 优先同步服务端 workspace，失败后可回退 initialFiles；本地 Agent 按 initialFiles 同步。
   */
  workspaceReady?: Promise<void>;
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
  /** 该 plugin 实例的模型路由命名空间；模型选择按 agentKey 在其内部隔离。 */
  llmPluginKey?: string;
  /**
   * 注入到根工程虚拟 FS 的文件（每个 turn 调用一次）。
   * 典型用途：在根工程放 `.agent/agent.md` 提供项目规范。
   * 同路径下 virtualFiles 优先级高于 designer.getFiles() 返回的真实文件。
   */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
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
}

// ─── 主入口 ───────────────────────────────────────────────────────────────────

/**
 * 在 pluginAI() 初始化时调用一次。
 * 挂载 window._sandbox_（connectToAI / helpers / config）。
 */
export function setupSandbox(params: SetupSandboxParams): AgentRuntimeController {
  const { requestAsStream, llmPluginKey, virtualFiles, initialFiles, skills, plugins, promptSections, tools, availableLibraries, themes, componentRuntime, disallowedDebugEnvs, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, onDisabledRequest, history, remoteAgent, sender } = params;
  // 空数组与某些应用产生的 App 空文件组合都视为无效快照，本地与远程 Agent 均不读取。
  const syncableInitialFiles = getSyncableInitialFiles(initialFiles);
  const disabledHandler = new DisabledHandler({
    getDisabled: () => context.disabled,
    onDisabledRequest,
  });
  const agentRuntimeRefs = new Map<string, AgentRuntimeRef>();

  window._sandbox_ = {
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      return connectToAI(comId, config, { requestAsStream, llmPluginKey, virtualFiles, initialFiles: syncableInitialFiles, skills, plugins, promptSections, tools, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, disabledHandler, history, remoteAgent, sender, agentRuntimeRefs });
    },

    // ── Plugin → sandbox（方法/渲染工具）──────────────────────────────────────
    helpers: {
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

// ─── 内部：注册单个 sandbox ───────────────────────────────────────────────────

interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  llmPluginKey?: string;
  /** 注入到根工程虚拟 FS 的文件（每个 turn 调用一次） */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  /** 本地 CodeAgent 的初始化文件快照；首次请求前会执行 diff/update/delete。 */
  initialFiles?: Array<Pick<UnifiedFile, "path" | "content">>;
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptSections?: PromptSections;
  tools?: Tool[];
  codeRules?: string;
  designRules?: string;
  getUserContextMessage?: PluginGetUserContextMessage;
  formatUserMessage?: AgentOptions["formatUserMessage"];
  disabledModes?: AgentOptions["disabledModes"];
  disabledHandler: DisabledHandler;
  history?: History;
  remoteAgent?: RemoteAgentConfig;
  sender?: TurnSender;
  agentRuntimeRefs: Map<string, AgentRuntimeRef>;
}

interface SkillRuntimeContext {
  designer?: Designer;
  codeRules?: string;
  designRules?: string;
}

function injectSkillRuntimeContext(
  skill: SkillFile,
  runtimeContext: SkillRuntimeContext
): SkillFile {
  const clonedSkill: SkillFile = {
    ...skill,
    files: skill.files.map((file) => ({ ...file })),
  };

  if (skill.updateContent) {
    const updateContent = skill.updateContent;
    clonedSkill.updateContent = () => updateContent.call(clonedSkill, runtimeContext);
  }

  return clonedSkill;
}

function injectPluginRuntimeContext(
  plugin: CodeAgentPlugin,
  runtimeContext: SkillRuntimeContext
): CodeAgentPlugin {
  if (!plugin.skills?.length) return plugin;

  return {
    ...plugin,
    skills: plugin.skills.map((skill) => injectSkillRuntimeContext(skill, runtimeContext)),
  };
}

function prefixPluginBrowserToolName(pluginName: string, tool: Tool): Tool {
  return {
    ...tool,
    name: `${pluginName}_${tool.name}`,
  };
}

function collectBrowserTools(params: {
  baseTools: Tool[];
  plugins?: CodeAgentPlugin[];
}): Tool[] {
  const enabledPlugins = params.plugins?.filter((plugin) => plugin.enabled !== false) ?? [];
  return [
    ...params.baseTools,
    ...enabledPlugins.flatMap((plugin) =>
      (plugin.tools ?? []).map((tool) => prefixPluginBrowserToolName(plugin.name, tool))
    ),
  ];
}

function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

function connectToAI(
  comId: string,
  { designer, hooks, chips }: RegistSandBoxConfig,
  { requestAsStream, llmPluginKey, virtualFiles, initialFiles, skills, plugins, promptSections, tools, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, disabledHandler, history, remoteAgent, sender, agentRuntimeRefs }: PluginParams
): ConnectToAIResult {
  const agentKey = context.getAgentKey(comId);
  registerChips(agentKey, chips);
  const runtimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
  agentRuntimeRefs.set(agentKey, runtimeRef);
  const runtime = runtimeRef.current;
  const getRuntimePromptSections = (config = runtimeRef.current) => config?.promptSections ?? promptSections;
  const getRuntimeTools = (config = runtimeRef.current) => config?.tools ?? tools;
  const activePromptSections = getRuntimePromptSections(runtime);
  const activeTools = getRuntimeTools(runtime);
  const promptOptions = promptSectionsAdaptToPromptOption(activePromptSections);
  const runtimeContext: SkillRuntimeContext = {
    designer,
    codeRules,
    designRules,
  };
  const getRuntimeSkills = (config = runtimeRef.current) =>
    (config?.skills ?? skills)?.map((skill) => injectSkillRuntimeContext(skill, runtimeContext));
  const getRuntimeVirtualFiles = () => runtimeRef.current?.virtualFiles ?? virtualFiles;
  const runtimeSkills = getRuntimeSkills(runtime);
  const runtimePlugins = plugins?.map((plugin) => injectPluginRuntimeContext(plugin, runtimeContext));
  const effectivePlugins = context.applyPluginEnabledOverrides(runtimePlugins);
  const requestGuard = {
    disabledHandler,
  };

  if (context.agentMap.has(agentKey)) {
    // 已注册：直接从现有 agent 实例上取 history 返回，不重复初始化
    const existingAgent = context.agentMap.get(agentKey)!;
    context.aiQueue.setRequestGuard(existingAgent, requestGuard);
    return { history: existingAgent.getHistory(), disabledHandler, isRemoteAgent: !!remoteAgent };
  }

  let agentRef: CodeAgent | undefined;

  const getEnabledAdditionalDirectories = async (): Promise<AdditionalDirectory[]> => {
    const enabledPlugins = agentRef?.getEnabledPlugins()
      ?? effectivePlugins?.filter((p) => p.enabled !== false)
      ?? [];
    const results = await Promise.all(
      enabledPlugins.map(async (p) => {
        const fn = p.additionalDirectories;
        if (!fn) return [];
        return await fn();
      })
    );
    return results.flat();
  };
  const buildAgentsMdConfig = async (): Promise<AgentsMdConfig[]> => {
    const config: AgentsMdConfig[] = [];
    // 从 sandbox.getFiles() 中收集所有 .agent/agent.md 文件
    const allFiles = await sandbox.getFiles();
    for (const vf of allFiles) {
      const normalizedPath = vf.path.replace(/^\/+/, '');
      // 根工程：.agent/agent.md
      // 扩展工程：<dir.path>.agent/agent.md（如 sub-project/.agent/agent.md）
      if (normalizedPath === '.agent/agent.md' || normalizedPath.endsWith('/.agent/agent.md')) {
        const { body } = splitFrontmatter(vf.content);
        const bodyContent = body.trim();
        if (!bodyContent) continue;
        config.push({ path: normalizedPath, content: bodyContent });
      }
    }
    return config;
  };
  const findAdditionalDirectory = (path: string, dirs: AdditionalDirectory[]) => {
    return dirs
      .filter((dir) => path.startsWith(dir.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
  };

  const sandbox: Sandbox = {
    // ── getFiles：主空间 + 扩展目录真实文件 + 顶层只读文件 + 扩展目录只读文件 ──
    getFiles: async (options?) => {
      // 1. 主工程真实文件（可读可写可删）
      const mainFiles = await designer.getFiles();
      const realMainFiles: UnifiedFile[] = mainFiles.map(f => ({
        path: f.path,
        content: f.content,
        permissions: { read: true, write: true, delete: true },
      }));

      // 2. 扩展目录真实文件（可读，write/delete 取决于是否有对应方法）
      const additionalDirectories = await getEnabledAdditionalDirectories();
      const realExtraFiles: UnifiedFile[] = (await Promise.all(
        additionalDirectories.map(async (dir) => {
          const files = await dir.getFiles();
          return files.map(f => ({
            path: f.path.startsWith(dir.path) ? f.path : `${dir.path}${f.path}`,
            content: f.content,
            permissions: {
              read: true,
              write: !!dir.updateFiles,
              delete: !!dir.deleteFiles,
            },
          }));
        })
      )).flat();

      // 3. 顶层只读文件（如 .agent/agent.md 项目规范）
      const promptVirtualFiles = (await getRuntimeVirtualFiles()?.({
        getEffectiveLibrariesSection: async (_options) => {
          const libraries = await designerRef.current?.getEffectiveLibraries() ?? [];
          return formatLibraryDocs(libraries);
        },
      })) ?? [];
      const readonlyTopFiles: UnifiedFile[] = promptVirtualFiles.map(f => ({
        path: f.path,
        content: f.content,
        permissions: { read: true, write: false, delete: false },
      }));

      // 4. 扩展目录只读文件（由各 additionalDirectory.virtualFiles 提供）
      const readonlyExtraFiles: UnifiedFile[] = (await Promise.all(
        additionalDirectories.map(async (dir) => {
          const files = (await dir.virtualFiles?.()) ?? [];
          return files.map(f => ({
            path: f.path.startsWith(dir.path) ? f.path : `${dir.path}${f.path}`,
            content: f.content,
            permissions: { read: true, write: false, delete: false },
          }));
        })
      )).flat();

      // 合并：只读文件覆盖同路径真实文件
      const normPath = (p: string) => p.replace(/^\/+/, '');
      const merged = new Map<string, UnifiedFile>(
        [...realMainFiles, ...realExtraFiles].map(f => [normPath(f.path), f])
      );
      [...readonlyTopFiles, ...readonlyExtraFiles].forEach(f => {
        merged.set(normPath(f.path), f);
      });

      const all = Array.from(merged.values());
      return options?.exclude ? all.filter(f => !isFileExcluded(f, options.exclude)) : all;
    },

    // ── updateFiles：按路径前缀分组分发 ──────────────────────────────────────
    updateFiles: async (files) => {
      const additionalDirectories = await getEnabledAdditionalDirectories();
      if (!additionalDirectories.length) {
        return designer.updateFiles(files)
      };
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
      const additionalDirectories = await getEnabledAdditionalDirectories();
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
      const designer = designerRef.current;
      if (!designer) return null;

      const libraries = await designer.getEffectiveLibraries();
      return buildDevelopmentGuideContext({
        // promptSections 的开发/设计/文档规范通过稳定上下文注入。
        // 这里必须按每个 turn 读取当前 runtime，才能与 agent system、tools、skills 一起切换。
        promptSections: getRuntimePromptSections(),
        codeRules,
        designRules,
        libraries,
      });
    },

    // ── getSandboxMetaSection：主项目空间与扩展工程分别产出独立标签 ────────────────
    getSandboxMetaSection: async () => {
      const additionalDirectories = await getEnabledAdditionalDirectories();
      // 获取全量文件（含只读文件），用于扩展工程的 agent.md；过滤 .agent/ 后用于展示。
      const [allFiles, displayFiles, extraDirectoryInfos] = await Promise.all([
        sandbox.getFiles(),
        sandbox.getFiles({ exclude: AGENT_INTERNAL_FILE_EXCLUDE }),
        Promise.all(additionalDirectories.map(async (dir) => ({
          dir,
          files: (await dir.getFiles()).filter((file) => !isFileExcluded(file, AGENT_INTERNAL_FILE_EXCLUDE)),
        }))),
      ]);

      // project-info 默认只描述主工程；扩展工程另行生成 extra-project-info。
      const mainFiles = displayFiles.filter(f => {
        const p = f.path.replace(/^\/+/, '');
        return !additionalDirectories.some(d => p.startsWith(d.path));
      });
      const projectInfo = buildProjectInfoSection(mainFiles);
      const extraProjectInfo = buildExtraProjectInfoSection({
        directories: extraDirectoryInfos.map(({ dir, files }) => ({ path: dir.path, files })),
        files: allFiles,
        globToolName: GLOB_TOOL_NAME,
      });
      return [projectInfo, extraProjectInfo].filter(Boolean).join("\n\n");
    },
  };

  const designerRef: { current: Designer | undefined } = { current: designer };
  const checkStatusTool = createCheckStatusTool(designerRef);
  const initProjectTool = createInitProjectTool(sandbox);
  const browserTools = collectBrowserTools({
    baseTools: [checkStatusTool, initProjectTool, ...(activeTools ?? [])],
    plugins: effectivePlugins,
  });

  if (remoteAgent) {
    const agent = new HttpAgent({
      baseUrl: remoteAgent.baseUrl,
      workspaceId: remoteAgent.workspaceId,
      agentId: remoteAgent.agentId,
    }, {
      disabledHandler,
      ...(disabledModes ? { disabledModes } : {}),
      browserTools,
      hooks,
    });
    // 与本地 CodeAgent 一致：存在 llmPluginKey 时把 HttpAgent.key 关联到 LLM runtime，
    // 使模型选择 UI 与 requestAI 能解析出当前选中模型。返回值 request 函数仅本地 Agent 使用。
    if (llmPluginKey) {
      context.createLLMRequest(llmPluginKey, agent.key);
    }
    context.aiQueue.setRequestGuard(agent, requestGuard);
    // 只有非空 initialFiles 才可作为 workspace 快照失败时的回退。
    const workspaceReady = !hasInitialFiles(initialFiles)
      ? agent.files.bindSandbox(sandbox)
      : attachFiles(agent, {
        sandbox,
        initialFiles,
        syncWorkspace: () => agent.files.bindSandbox(sandbox),
      });
    context.agentMap.set(agentKey, agent);
    context.registerAgentComId(comId);
    return { history: agent.getHistory(), disabledHandler, isRemoteAgent: true, workspaceReady };
  }

  const agent = new CodeAgent({
    key: agentKey,
    history: history ?? new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: (llmPluginKey ? context.createLLMRequest(llmPluginKey, agentKey) : undefined) ?? requestAsStream,
    sandbox,
    tools: [checkStatusTool, initProjectTool, ...(activeTools ?? [])],
    promptOptions,
    hooks,
    agentsMdConfig: buildAgentsMdConfig,
    skills: runtimeSkills,
    plugins: effectivePlugins,
    subAgents: [],
    disabledModes,
    getAttachmentContextMessages: async () => {
      const sections: string[] = [];
      const custom = await getUserContextMessage?.();
      if (custom) sections.push(custom);
      return sections;
    },
    formatUserMessage: async (params) => {
      const sandboxFormattedParams = {
        message: params.message,
        attachments: params.attachments,
        ...(params.meta ? { meta: params.meta } : {}),
        ...(params.extra ? { extra: params.extra } : {}),
        ...(sender ? { sender } : {}),
      };
      if (!formatUserMessage) return sandboxFormattedParams;

      const userFormattedParams = await formatUserMessage(sandboxFormattedParams);
      return {
        ...sandboxFormattedParams,
        // TODO: 这里需要再考虑 formatUserMessage 的扩展语义。
        // 目前 pluginAI 侧只让返回值中的 message 生效，attachments/meta/sender 暂不接管。
        message: userFormattedParams.message,
      };
    },
  });
  const workspaceReady = attachFiles(agent, { sandbox, initialFiles });
  context.aiQueue.setRequestGuard(agent, requestGuard);
  agentRef = agent;

  // MVP：复用同一个 CodeAgent 实例，仅替换其运行时资源。
  // _base / _rebuildDynamicTools 是当前 CodeAgent 的私有实现细节，因此本能力标记为试验性。
  const baseTools = (agent as any)._base.tools as Tool[];
  const builtinTools = baseTools.slice(0, baseTools.length - 2 - (activeTools?.length ?? 0));
  runtimeRef.apply = (config) => {
    const nextTools = getRuntimeTools(config) ?? [];
    const nextSkills = getRuntimeSkills(config) ?? [];
    (agent as any)._base.skills = nextSkills;
    (agent as any)._base.tools = [
      ...builtinTools,
      checkStatusTool,
      initProjectTool,
      ...nextTools,
    ];
    (agent as any)._rebuildDynamicTools();
    agent.options.system = getCodeAgentSystemPrompt(
      promptSectionsAdaptToPromptOption(getRuntimePromptSections(config))
    );
  };

  context.agentMap.set(agentKey, agent);
  context.registerAgentComId(comId);

  return { history: agent.getHistory(), disabledHandler, isRemoteAgent: false, workspaceReady };
}
