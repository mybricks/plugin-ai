import React from "react";
import { AGENT_INTERNAL_FILE_EXCLUDE, CodeAgent, IDBHistory, isFileExcluded } from "../../../agent/src";
import { ChipRegistry } from "../../../agent/src";
import { splitFrontmatter, getFrontmatterString, getFrontmatterStringArray } from "../../../agent/src/utils/frontmatter";
import { GLOB_TOOL_NAME } from "../../../agent/src/code-agent/tools";
import type { Tool, Sandbox, CodeAgentPlugin, CodeAgentPromptOptions, History, BoundHistory, TurnSender, AdditionalDirectory, AgentsMdConfig, SkillFile, UnifiedFile, AgentOptions, AgentMode } from "../../../agent/src";
import type { PromptSections } from "../prompts";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig } from "./types";
import { buildGuideUserContext } from "./context-builders";
import { createCheckStatusTool } from "./tools/check-status";
import { createInitProjectTool } from "./tools/init-project";
import { LoadingView, type ComChatStartViewProps, type LoadingViewProps } from "../ui/chat";
import type { PrdRenderProps } from "../ui/renders/prd-render";
import { LoadingViewWithStyles, ComChatStartViewWithStyles, PrdRenderWithStyles } from "../ui/renders/register";
import { context } from "../context";
import { ensureAIPanelOpen, ensureFocusComId } from "../utils/ensure-ai-panel-open";
import { buildFocusInfo } from "../utils/dom-info";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

/**
 * plugin-ai 全局 chip 注册表。
 * 在 setup.ts 初始化时创建，供 chat-focus-view 等 UI 层注册 chip 类型，
 * 并通过 wrapFormatUserMessage 自动挂入每个 CodeAgent 的 formatUserMessage 链。
 */
export const chipRegistry = new ChipRegistry();

export interface SendToAgentParams {
  message: string;
  attachments?: { type: string; content: string; title?: string; size?: number }[];
  extra?: Record<string, any>;
  mode?: AgentMode;
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
  /**
   * 注入到根工程虚拟 FS 的文件（每个 turn 调用一次）。
   * 典型用途：在根工程放 `.agent/agent.md` 提供项目规范。
   * 同路径下 virtualFiles 优先级高于 designer.getFiles() 返回的真实文件。
   */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
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
  const { requestAsStream, virtualFiles, skills, plugins, promptSections, tools, availableLibraries, themes, componentRuntime, disallowedDebugEnvs, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, history, sender } = params;

  window._sandbox_ = {
    // ── sandbox → Plugin ──────────────────────────────────────────────────────
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      return connectToAI(comId, config, { requestAsStream, virtualFiles, skills, plugins, promptOptions: promptSections?.agent, promptSections, tools, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, history, sender });
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
                ...(params.extra ? { extra: params.extra } : {}),
                ...(params.mode ? { mode: params.mode } : {}),
              });
            },
            { message: params.message, attachments: params.attachments ?? [], ...(params.extra ? { extra: params.extra } : {}), ...(params.mode ? { mode: params.mode } : {}) }
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
      availableLibraries: availableLibraries ?? [],
      themes: themes ?? [],
      componentRuntime,
      disallowedDebugEnvs: disallowedDebugEnvs ?? [],
    },
  };
}

// ─── 内部：注册单个 sandbox ───────────────────────────────────────────────────

interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  /** 注入到根工程虚拟 FS 的文件（每个 turn 调用一次） */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptOptions?: CodeAgentPromptOptions;
  promptSections?: PromptSections;
  tools?: Tool[];
  codeRules?: string;
  designRules?: string;
  getUserContextMessage?: PluginGetUserContextMessage;
  formatUserMessage?: AgentOptions["formatUserMessage"];
  disabledModes?: AgentOptions["disabledModes"];
  history?: History;
  sender?: TurnSender;
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

function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

function connectToAI(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, virtualFiles, skills, plugins, promptOptions, promptSections, tools, codeRules, designRules, getUserContextMessage, formatUserMessage, disabledModes, history, sender }: PluginParams
): ConnectToAIResult {
  const agentKey = context.getAgentKey(comId);
  const runtimeContext: SkillRuntimeContext = { designer, codeRules, designRules };
  const runtimeSkills = skills?.map((skill) => injectSkillRuntimeContext(skill, runtimeContext));
  const runtimePlugins = plugins?.map((plugin) => injectPluginRuntimeContext(plugin, runtimeContext));
  const effectivePlugins = context.applyPluginEnabledOverrides(runtimePlugins);

  if (context.agentMap.has(agentKey)) {
    // 已注册：直接从现有 agent 实例上取 history 返回，不重复初始化
    const existingAgent = context.agentMap.get(agentKey)!;
    return { history: existingAgent.getHistory() };
  }

  let agentRef: CodeAgent | undefined;

  /** 解析 .agent/agent.md，提取 title / description / permissions / body */
  const parseAgentMdFrontmatter = (content: string): {
    title?: string;
    description?: string;
    permissions?: string[];
    body: string;
  } => {
    const { fmText, body } = splitFrontmatter(content);
    const title = getFrontmatterString(fmText, 'title') ?? undefined;
    const description = getFrontmatterString(fmText, 'description') ?? undefined;
    const permissions = getFrontmatterStringArray(fmText, 'permissions') ?? undefined;
    return { title, description, permissions, body };
  };

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
      const promptVirtualFiles = (await virtualFiles?.({
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

    getContext: async () => buildGuideUserContext(designerRef.current, promptSections, { codeRules, designRules }),

    // ── getUserContext：主项目空间 + 扩展目录文件列表 + 宿主自定义上下文 ──────────
    getUserContext: async () => {
      const additionalDirectories = await getEnabledAdditionalDirectories();
      const summarizeFiles = (files: UnifiedFile[]) => {
        const suffixMap: Record<string, number> = {};
        for (const f of files) {
          const dotIdx = f.path.lastIndexOf('.');
          const ext = dotIdx !== -1 ? f.path.slice(dotIdx) : '(无后缀)';
          suffixMap[ext] = (suffixMap[ext] ?? 0) + 1;
        }
        return Object.entries(suffixMap)
          .map(([ext, count]) => `${count} 个 ${ext}`)
          .join('、');
      };
      const normalizeMainPath = (path: string) => path.replace(/^\/+/, '');
      const normalizeDirectoryPath = (path: string) => path.replace(/^\/+/, '');
      const ensureTrailingSlash = (path: string) => path.endsWith('/') ? path : `${path}/`;
      const examplePath = (dirPath: string) => `${ensureTrailingSlash(normalizeDirectoryPath(dirPath))}src/index.ts`;

      // 获取全量文件（含只读文件），用于查找 agent.md；同时过滤 .agent/ 以获取展示用文件列表
      const [allFiles, displayFiles, extraDirectoryInfos] = await Promise.all([
        sandbox.getFiles(),
        sandbox.getFiles({ exclude: AGENT_INTERNAL_FILE_EXCLUDE }),
        Promise.all(additionalDirectories.map(async (dir) => ({
          dir,
          files: (await dir.getFiles()).filter((file) => !isFileExcluded(file, AGENT_INTERNAL_FILE_EXCLUDE)),
        }))),
      ]);

      // 展示给用户的主工程文件列表（过滤 .agent/ 目录）
      const mainFiles = displayFiles.filter(f => {
        const p = f.path.replace(/^\/+/, '');
        return !additionalDirectories.some(d => p.startsWith(d.path));
      });

      const projectCount = 1 + additionalDirectories.length;
      const sections: string[] = [
        `这是发送这条消息时的项目空间快照，并不会实时更新。\n\n# 项目空间\n当前项目一共有${projectCount}个工程`,
      ];

      if (mainFiles.length === 0) {
        sections.push([
          '## 前端工程',
          'MyBricks的前端工程项目，需要遵循前端开发规范进行开发。',
          '权限：读取、写入',
          '当前没有任何代码文件。可以使用类似 `index.tsx` 的路径来操作文件。',
        ].join('\n'));
      } else {
        const suffixSummary = summarizeFiles(mainFiles);
        const fileList = mainFiles.map((f) => {
          const lineCount = f.content.split('\n').length;
          return `- ${normalizeMainPath(f.path)} (${lineCount} lines)`;
        }).join('\n');
        sections.push([
          '## 前端工程',
          'MyBricks的前端工程项目，需要遵循前端开发规范进行开发。',
          '权限：读取、写入',
          `总计：${mainFiles.length} 个文件（${suffixSummary}）`,
          '文件：',
          fileList,
        ].join('\n'));
      }

      if (extraDirectoryInfos.length) {
        const extraSections = extraDirectoryInfos.map(({ dir, files }, index) => {
          const suffixSummary = summarizeFiles(files);
          const countDesc = files.length === 0
            ? '当前没有任何代码文件。'
            : `总计：${files.length} 个文件（${suffixSummary}）。当前不展开文件列表，可使用 ${GLOB_TOOL_NAME} 工具（如 \`${dir.path}**/*\`）查询文件列表，再按需读取具体文件。`;

          // 从 sandbox.getFiles() 中找该目录下的 .agent/agent.md，解析 frontmatter
          // 根工程：.agent/agent.md；扩展工程：<dir.path>.agent/agent.md
          const dirAgentMdPath = `${dir.path.replace(/\/$/, '')}/.agent/agent.md`;
          const dirAgentMd = allFiles.find((vf) => {
            const normalizedPath = vf.path.replace(/^\/+/, '');
            return normalizedPath === dirAgentMdPath;
          });
          const agentMeta = dirAgentMd ? parseAgentMdFrontmatter(dirAgentMd.content) : null;

          const displayTitle = agentMeta?.title ?? dir.path;
          const displayDesc = agentMeta?.description;
          const perms = agentMeta?.permissions;
          const permLabelMap: Record<string, string> = { read: '读取', write: '写入', bash: '执行 bash 命令' };
          const permParts = perms?.map((p) => permLabelMap[p] ?? p) ?? [];

          return [
            `工程${index + 1}「${displayTitle}」，虚拟目录为\`${normalizeDirectoryPath(dir.path)}\``,
            displayDesc ? `说明：${displayDesc}` : undefined,
            permParts.length ? `权限：${permParts.join('、')}` : undefined,
            countDesc,
            `可以使用类似 \`${examplePath(dir.path)}\` 的完整路径来读取或修改文件。`,
          ].filter(Boolean).join('\n');
        }).join('\n\n');
        sections.push(`## 扩展工程（${extraDirectoryInfos.length}个）\n${extraSections}`);
      }

      const customContextMessage = await getUserContextMessage?.();

      const combined = sections.join('\n\n');
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
    agentsMdConfig: buildAgentsMdConfig,
    skills: runtimeSkills,
    plugins: effectivePlugins,
    subAgents: [],
    disabledModes,
    formatUserMessage: chipRegistry.wrapFormatUserMessage(async (params) => {
      const focusSnapshot = context.currentFocus;
      const ele = focusSnapshot?.focusArea?.ele;
      const hasDomChip = (params.meta?.chips ?? []).some((chip: any) => chip?.type === "dom");
      const focusInfoText = ele && !hasDomChip ? buildFocusInfo(ele) : undefined;
      const focusMeta = focusSnapshot ? {
        focus: {
          comId: focusSnapshot.comId,
          pageId: focusSnapshot.pageId,
          title: focusSnapshot.title,
          type: focusSnapshot.type,
          focusArea: focusSnapshot.focusArea ? { title: focusSnapshot.focusArea.title } : undefined,
        }
      } : {};
      const sandboxFormattedParams = {
        message: focusInfoText ? `<用户需求>${params.message}<用户需求/>\n\n${focusInfoText}` : params.message,
        attachments: params.attachments,
        meta: { ...params.meta, ...focusMeta },
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
    }),
  });
  agentRef = agent;

  context.sandboxMap.set(agentKey, { sandbox, designerRef });
  context.agentMap.set(agentKey, agent);

  return { history: agent.getHistory() };
}
