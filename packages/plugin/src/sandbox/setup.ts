import React from "react";
import { CodeAgent, IDBHistory } from "../../../agent/src";
import type { Tool, Sandbox, CodeAgentPlugin, CodeAgentPromptOptions, History, BoundHistory, TurnSender, AdditionalDirectory, AgentsMdConfig, SkillFile } from "../../../agent/src";
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
  codeRules?: string;
  designRules?: string;
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
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptSections?: PromptSections;
  tools?: Tool[];
  availableLibraries?: any[];
  themes?: any[];
  componentRuntime?: any;
  codeRules?: string;
  designRules?: string;
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
  const { requestAsStream, agentsMd, skills, plugins, promptSections, tools, availableLibraries, themes, componentRuntime, codeRules, designRules, getUserContextMessage, history, sender } = params;

  window._sandbox_ = {
    // ── sandbox → Plugin ──────────────────────────────────────────────────────
    connectToAI(comId: string, config: RegistSandBoxConfig): ConnectToAIResult {
      return connectToAI(comId, config, { requestAsStream, agentsMd, skills, plugins, promptOptions: promptSections?.agent, promptSections, tools, codeRules, designRules, getUserContextMessage, history, sender });
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
      componentRuntime,
      codeRules,
      designRules,
    },
  };
}

// ─── 内部：注册单个 sandbox ───────────────────────────────────────────────────

interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  agentsMd?: string;
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptOptions?: CodeAgentPromptOptions;
  promptSections?: PromptSections;
  tools?: Tool[];
  codeRules?: string;
  designRules?: string;
  getUserContextMessage?: PluginGetUserContextMessage;
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

function wrapRules(tag: string, value?: string): string {
  const content = value?.trim();
  return content ? `\n<${tag}>\n${content}\n</${tag}>\n` : '';
}

function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ''}\n---\n${library.usage}`)
    .join('\n\n');
}

function hasPromptSectionContent(section?: object): boolean {
  return Object.values(section ?? {}).some((value) =>
    typeof value === 'string' && value.trim().length > 0
  );
}

async function buildDesignerContext(
  designer: Designer | undefined,
  promptSections: PromptSections | undefined,
  rules: { codeRules?: string; designRules?: string }
): Promise<string | null> {
  if (!designer) return null;

  const developeGuide = promptSections?.developeGuide ?? {};
  const designGuide = promptSections?.designGuide ?? {};
  const documentGuide = promptSections?.documentGuide ?? {};

  if (!hasPromptSectionContent(developeGuide)) return null;

  const codeRulesSection = wrapRules('code_rules', rules.codeRules);
  const designRulesSection = wrapRules('design_rules', rules.designRules);

  const bestPracticesContent = [
    codeRulesSection ? '#### 代码规范：\n' + codeRulesSection : undefined,
    developeGuide.assetsUsageSection ? '#### 图片和图标使用：\n' + developeGuide.assetsUsageSection : undefined,
    developeGuide.examplesSection ? '#### 开发示例：\n' + developeGuide.examplesSection : undefined,
  ].filter(Boolean).join('\n');

  const documentGuideContent = [
    documentGuide.firstOfAll,
    documentGuide.requirementGuide,
  ].filter(Boolean).join('\n\n');

  const libraries = await designer.getEffectiveLibraries();
  const libraryDocsContent = formatLibraryDocs(libraries);

  return [
    '\n# 前端开发指南\n',
    developeGuide.firstOfAll,
    '\n## 项目架构\n',
    developeGuide.architectureSection ?? '',
    '\n## 环境变量\n',
    [
      '以下是系统注入的环境变量，可在组件代码中通过 `process.env.<变量名>` 访问，**禁止自行声明或覆盖这些变量**：\n',
      '| 变量名 | 类型 | 设计态值 | 运行态值 | 说明 |',
      '|--------|------|----------|----------|------|',
      '| `process.env.POPUP_VISIBLE` | `boolean` | `true` | `false` | 控制浮层（弹窗/抽屉等）的默认显示状态。设计态下为 `true` 使浮层保持展开，方便设计者选中浮层内元素进行编辑；运行态下为 `false`，由业务逻辑控制显隐。**浮层组件必须将此变量与业务状态做 `||` 合并使用**，例如：`visible={process.env.POPUP_VISIBLE \\|\\| store.modalVisible}` |',
      '| `process.env.POPUP_NODE` | `HTMLElement` | 设计器画布容器节点 | 页面容器节点 | 浮层的挂载容器。设计、运行态下均指向设计器画布，确保浮层渲染在画布内部。例如一些三方库的指定挂载节点：`getContainer={() => process.env.POPUP_NODE}` |',
    ].join('\n') + '\n',
    '\n## 最佳实践\n',
    bestPracticesContent,
    developeGuide.end,
    '\n## 设计规范\n',
    [designGuide.firstOfAll, designRulesSection].filter(Boolean).join('\n'),
    ...(documentGuideContent ? [
      '\n## 文档规范\n',
      '<文档规范>\n',
      documentGuideContent,
      '\n</文档规范>\n',
    ] : []),
    '\n## 允许使用的类库\n',
    '\n---\n\n',
    libraryDocsContent,
  ].join('');
}

function connectToAI(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, agentsMd, skills, plugins, promptOptions, promptSections, tools, codeRules, designRules, getUserContextMessage, history, sender }: PluginParams
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
  const getEnabledAdditionalDirectories = (): AdditionalDirectory[] => {
    const enabledPlugins = agentRef?.getEnabledPlugins()
      ?? effectivePlugins?.filter((p) => p.enabled !== false)
      ?? [];
    return enabledPlugins.flatMap((p) => p.additionalDirectories ?? []);
  };
  const buildAgentsMdConfig = (): AgentsMdConfig[] => {
    const config: AgentsMdConfig[] = [];
    const rootAgentsMd = agentsMd?.trim();
    if (rootAgentsMd) {
      config.push({ path: "agents.md", content: rootAgentsMd });
    }
    for (const dir of getEnabledAdditionalDirectories()) {
      const content = dir.agentsMd?.trim();
      if (!content) continue;
      config.push({
        path: `${dir.path}agents.md`,
        content,
      });
    }
    return config;
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

    getContext: async () => buildDesignerContext(designerRef.current, promptSections, { codeRules, designRules }),

    // ── getUserContext：主项目空间 + 扩展目录描述 + 宿主自定义上下文 ──────────
    getUserContext: async () => {
      const additionalDirectories = getEnabledAdditionalDirectories();
      const summarizeFiles = (files: Array<{ path: string; content: string }>) => {
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

      const [mainFiles, extraDirectoryInfos] = await Promise.all([
        designer.getFiles(),
        Promise.all(additionalDirectories.map(async (dir) => ({
          dir,
          files: await dir.getFiles(),
        }))),
      ]);

      const projectCount = 1 + additionalDirectories.length;
      const sections: string[] = [
        `这是发送这条消息时的项目空间快照，并不会实时更新。\n\n# 项目空间\n当前项目一共有${projectCount}个工程`,
      ];

      if (mainFiles.length === 0) {
        sections.push([
          '## 前端工程',
          'MyBricks的前端工程项目，需要遵循前端开发规范进行开发。',
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
            : `总计：${files.length} 个文件（${suffixSummary}）。当前不展开文件列表，请按需搜索或读取目录下的具体文件。`;
          return [
            `工程${index + 1}，虚拟目录为\`${normalizeDirectoryPath(dir.path)}\``,
            dir.description ? `说明：\n${dir.description}` : undefined,
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
