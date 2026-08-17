import React from "react";

import pkg from "../../../package.json";
console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { IDBHistory } from "../../agent/src";
import type { AgentOptions, CodeAgentPlugin, SkillFile, TurnSender } from "../../agent/src";
import { createRequestAsStream, createOnUpload } from "../../request/src";
import type { RequestAsStreamFn, ProviderConfig } from "../../request/src";
export type { ProviderConfig, RemoteProviderConfig, CustomProviderConfig, ModelConfig, ModelSelection } from "../../request/src";
import { type PromptSections } from "../../kit/src";
import { DEFAULT_PLUGIN_SKILLS } from "./skills/default";

import { context } from "./context";
import { setupSandbox } from "./sandbox";
import { chipRegistry } from "./sandbox/setup";
import type { AgentRuntimeConfig, RemoteAgentConfig, Designer, Hooks, RegistSandBoxConfig, PluginGetUserContextMessage, SendToAgentParams } from "./sandbox";
import { ChatPanelList } from "./ui/chat/chat-panel-list";
import { ComChatFocusView } from "./ui/chat/chat-focus-view";
import { ensureAIPanelOpen, ensureFocusComId } from "./utils/ensure-ai-panel-open";
import { createDomChip } from "./utils/dom-info";
import type { MentionProvider } from "./ui/components/types";

// ─── 工具类型重导出 ────────────────────────────────────────────────────────────

export { Agent, IDBHistory, IDBSandbox, Tools } from "../../agent/src";
export { CodeAgent } from "./compat-code-agent";
export type { CompatibleCodeAgentOptions } from "./compat-code-agent";
export type { AdditionalDirectory, AgentEventMap, AgentsMdConfig, CodeAgentPlugin, SkillFile, UnifiedFile } from "../../agent/src";
export { createRequestAsStream, createOnUpload } from "../../request/src";
export type { RequestAsStreamFn } from "../../request/src";
export { openSetting, closeSetting, SettingModal } from "./ui/setting";
export type { SettingModalProps } from "./ui/setting";
export type { AgentRuntimeConfig, RemoteAgentConfig, Designer, Hooks, RegistSandBoxConfig, SandboxAPI, SandboxHelpers, SandboxConfig, SendToAgentParams, PluginGetUserContextMessage, VirtualFilesRuntimeContext, ChatChipRemoveHandler, SandboxChipConfig, SandboxChipRecordConfig, SandboxChipsConfig } from "./sandbox";
export type { MentionProvider, MentionMenuItem } from "./ui/components/types";
// ProviderConfig / ModelConfig 已由 request 包导出，此处仅导出 plugin 专属类型
export type { SettingValue } from "./ui/setting";
export { ChatPanel } from "./ui/chat";
export { HttpAgent } from "./ui/chat";
export type {
  BrowserToolRequest,
  BrowserToolResult,
  DisplayModelHttpAgentRequestAIParams,
  ChatPanelProps,
  ChatPanelRef,
  HttpAgentOptions,
  HttpAgentRequestAIParams,
  MessageHttpAgentRequestAIParams,
} from "./ui/chat";
export * from "../../kit/src/preset";
export { default as pluginLowCodeAI } from "../../plugin-lowcode/src";
export * from "../../plugin-lowcode/src";

// ─── PluginAI 实例 API ────────────────────────────────────────────────────────

/** pluginAI() 返回的 controller 控制方法集合，与 Mybricks 插件属性隔离 */
export interface PluginAIController {
  /** 禁用输入框发送，等同于 setDisabled(true) */
  disable(): void;
  /** 启用输入框发送，等同于 setDisabled(false) */
  enable(): void;
  /** 动态设置禁用状态 */
  setDisabled(value: boolean): void;
  /**
   * 广播启用插件：影响所有已创建的 CodeAgent 实例，且对后续新建实例同样生效。
   * 下一个 turn 开始时生效（skills / tools / agents 会重新合并）。
   */
  enablePlugin(name: string): void;
  /**
   * 广播禁用插件：影响所有已创建的 CodeAgent 实例，且对后续新建实例同样生效。
   * 下一个 turn 开始时生效（skills / tools / agents 会重新合并）。
   */
  disablePlugin(name: string): void;
  /** 向指定 comId 的 Agent 发送消息，复用 sandbox helpers.sendToAgent 的队列/聚焦逻辑。 */
  requestAI(comId: string, params: SendToAgentParams): void;
  /**
   * ⚠️ 试验性 API：设置当前聚焦 Agent 的运行配置。
   * 直接更新当前 CodeAgent 实例。建议在 Agent 空闲时调用；执行中更新会在后续 LLM step 生效。
   * @experimental
   */
  setAgentRuntime(config: AgentRuntimeConfig): void;
  /**
   * ⚠️ 试验性 API：清除当前聚焦 Agent 的运行配置，恢复 pluginAI 初始化配置。
   * @experimental
   */
  clearAgentRuntime(): void;
  /** 向指定 comId 的对话输入框追加文本或图片附件。 */
  appendInput(comId: string, input: string | SendToAgentParams): void;
  /**
   * 获取指定 comId 对话框的当前输入草稿（文本 + 附件 + chips）。
   * 不传 comId 时返回当前活跃面板的草稿；面板未挂载时返回 undefined。
   */
  getInput(comId?: string): ReturnType<import("./ui/components/sender").SenderRef["getInput"]> | undefined;
}

/** pluginAI() 返回值，顶层为 Mybricks 插件标准属性，controller 为扩展控制接口 */
export interface PluginAIAPI {
  /** 扩展控制接口，非 Mybricks 设计器属性，与插件数据结构隔离 */
  controller: PluginAIController;
}

function isSameAiFocus(prev?: AiServiceFocusParams, next?: AiServiceFocusParams): boolean {
  return (
    prev?.comId === next?.comId &&
    prev?.pageId === next?.pageId &&
    prev?.title === next?.title &&
    prev?.focusArea === next?.focusArea
  );
}

// ─── plugin 主入口 ────────────────────────────────────────────────────────────

interface FileModules {
  /** 基于babel的自定义插件 */
  babelPlugins?: ((params: { filename: string }) => ((params: any) => any))[]
  /** 获取依赖信息 */
  getDependencies?: (params: any) => Record<string, any>
  /** 入口文件 */
  entryFile: string
}

interface FrontendFileModules extends FileModules {
  /** 模块类型 */
  type: 'frontend'
  /** 画布 */
  canvas?: {
    width?: number
    height?: number
  },
}

interface BackendFileModules extends FileModules {
  /** 模块类型 */
  type: 'backend'
}

export interface PluginAIParams {
  name?: string;
  user?: { name?: string; avatar?: string };
  /** 插件命名空间，用于隔离多实例的 agent 存储和队列，必填 */
  key: string;
  onRequest?: RequestAsStreamFn;
  onUpload?: (file: File) => Promise<string>;
  onDownload?: (params: { name: string; content: string }) => Promise<void> | void;
  /**
   * 插件处于 disabled 时若仍尝试发送消息、清空历史或写入版本，会调用此回调。
   * 典型用途：由宿主弹出 toast / message 提示用户当前不可操作。
   */
  onDisabledRequest?: () => void;
  codingConfig?: {
    availableLibraries?: any[];
    themes?: any[];
    codeRules?: string;
    designRules?: string;
  };
  /**
   * 注入到根工程虚拟 FS 的文件（每个 turn 调用一次）。
   * 典型用途：在根工程放 `.agent/agent.md` 提供项目规范，LLM 可通过 `read_file` 读取。
   * 同路径下 virtualFiles 优先级高于真实文件。
   *
   * @example
   * ```ts
   * virtualFiles: async (context) => [{
   *   path: ".agent/agent.md",
   *   content: "# 项目规范\n...",
   * }]
   * ```
   */
  virtualFiles?: (context: import("./sandbox").VirtualFilesRuntimeContext) => Promise<import("../../agent/src").UnifiedFile[]>;
  /** 技能文件列表，挂载为虚拟 .agent/skills/ 目录，LLM 通过 use_skill 工具按需加载 */
  skills?: SkillFile[];
  /** 插件列表，会将内部 skills / agents / tools / additionalDirectories 合并进 CodeAgent 顶层配置 */
  plugins?: CodeAgentPlugin[];
  /** 覆盖内置系统提示词各节，按 key 深度合并，未提供的 key 保留 MYBRICKS_PROMPT_SECTIONS 默认值 */
  promptSections?: PromptSections;
  /** 额外自定义工具，追加到内置工具（read_file / write_file 等）之后 */
  tools?: import("../../agent/src").Tool[];
  /**
   * 外部增量注入的用户上下文文本。每个 turn 开始时读取一次，
   * 返回内容会拼接到内置项目空间上下文后，作为 user context 注入给 CodeAgent。
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
  /** 组件运行时扩展 */
  componentRuntime?: {
    modules: Record<string, FrontendFileModules | BackendFileModules>
    /** 开发、调试 工作区 */
    workspace?: {
      /** 代码编辑器内复制回调 */
      onCodeEditorCopy: () => { filename: string; code: string; }
    }
  }
  /** 禁用调试环境列表 */
  disallowedDebugEnvs?: string[];
  /**
   * ⚠️ 试验性 API，后续版本将移除。
   * 在 Sender 附件上传按钮之后插入自定义渲染内容。
   */
  renderAttachmentSuffix?: () => React.ReactNode;
  /**
   * 自定义 mention 注册源。
   * 点击 Sender 的 + 号或输入 @ 时可选择，选中后插入 chip，发送前由 chip.format 转成模型上下文。
   */
  mentions?: MentionProvider[];
  /** LLM 配置（自定义渠道时使用） */
  llm?: {
    /**
     * 供应商配置列表。支持两种类型：
     * - RemoteProviderConfig：直连供应商（需提供 baseUrl / apiKey / format）
     * - CustomProviderConfig：自定义请求（只需提供 providerId / models / request），
     *   典型用途：配置 providerId 为 "auto" 的条目，把请求 delegate 给智能路由函数。
     */
    providers?: ProviderConfig[];
  };
  /** 透传给 CodeAgent 的历史记录实现，不传时使用内置 IDBHistory */
  history?: import("../../agent/src").History;
  /** 服务端 Agent 配置。设置后会创建 HTTP Agent；未设置时使用本地 CodeAgent。 */
  remoteAgent?: RemoteAgentConfig;
  /** 消息发送者信息，注入到每条用户消息中，UI 展示时优先使用 */
  sender?: TurnSender;
}

export default function pluginAI(params: PluginAIParams): PluginAIAPI & Record<string, any> {
  const {
    name = "智能助手",
    user,
    key: pluginKey,
    onRequest,
    onUpload,
    onDownload,
    onDisabledRequest,
    codingConfig,
    virtualFiles,
    skills,
    plugins,
    promptSections,
    tools,
    getUserContextMessage,
    formatUserMessage,
    disabledModes,
    componentRuntime,
    disallowedDebugEnvs,
    llm,
    history,
    // remoteAgent = {
    //   baseUrl: 'https://aicode.staging.kuaishou.com/agents/api',
    //   workspaceId: '29820'
    // },
    remoteAgent,
    sender,
    renderAttachmentSuffix,
    mentions,
  } = params;

  // 先设置 KV 命名空间，再恢复模型选择，避免读取到上一个 plugin 实例的状态。
  context.setPluginKey(pluginKey);
  const mergedSkills = [...DEFAULT_PLUGIN_SKILLS, ...(skills ?? [])];

  context.configureLLMProvider(pluginKey, llm?.providers);
  const effectiveRequest: RequestAsStreamFn = onRequest ?? createRequestAsStream();

  const requestAsStream: RequestAsStreamFn = effectiveRequest;
  const upload = onUpload ?? createOnUpload();
  const download = onDownload ?? (({ name, content }: { name: string; content: string }) => {
    const eleLink = document.createElement("a");
    eleLink.download = name;
    eleLink.style.display = "none";

    const blob = new Blob([content]);
    eleLink.href = URL.createObjectURL(blob);
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
  });

  context.name = name;
  (mentions ?? []).forEach((mention) => chipRegistry.register(mention.chip));
  context.pluginParams = { name, user, onUpload: upload, onDownload: download, renderAttachmentSuffix, mentions };

  // ── 调试工具：导入历史记录 ─────────────────────────────────────────────────

  (window as any).__importRxAIJson__ = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.rxai";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!Array.isArray(data.turns)) {
          alert("无效的历史记录文件格式");
          return;
        }
        
        const currentAgentKey = context.getAgentKey();
        if (!currentAgentKey) {
          alert("当前没有聚焦的组件，请先点击一个组件后再导入");
          return;
        }
        const currentAgent = context.agentMap.get(currentAgentKey);
        if (currentAgent?.kind === "http") {
          alert("当前是服务端 Agent，历史导入需要走服务端 history 接口，不能写入本地 IDB。");
          return;
        }
        
        const history = new IDBHistory({ dbName: "@plugin-ai/plugin/messages" });
        await history.import(currentAgentKey, data.turns);
        if (data.compactRecord) {
          await history.saveCompact(currentAgentKey, data.compactRecord);
        }
        alert(`导入成功！agentKey: ${currentAgentKey}, turns: ${data.turns.length}`);
      } catch (err) {
        console.error("导入失败:", err);
        alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    input.click();
  };

  // ── window._sandbox_：sandbox 与 Plugin 的统一交互 API ─────────────────────

  const agentRuntimeController = setupSandbox({
    requestAsStream,
    llmPluginKey: pluginKey,
    virtualFiles,
    skills: mergedSkills,
    plugins,
    promptSections,
    tools,
    getUserContextMessage,
    formatUserMessage,
    disabledModes,
    onDisabledRequest,
    availableLibraries: codingConfig?.availableLibraries ?? [],
    themes: codingConfig?.themes ?? [],
    disallowedDebugEnvs: disallowedDebugEnvs ?? [],
    codeRules: codingConfig?.codeRules,
    designRules: codingConfig?.designRules,
    componentRuntime,
    history,
    remoteAgent,
    sender,
  });

  return {
    name: "@mybricks/plugins/ai",
    title: name,
    author: "MyBricks",
    ["author.zh"]: "MyBricks",
    version: "0.0.1",
    // ─── 外部控制接口，与 Mybricks 插件属性隔离 ────────────────────────────
    controller: {
      disable() {
        context.setDisabled(true);
      },
      enable() {
        context.setDisabled(false);
      },
      setDisabled(value: boolean) {
        context.setDisabled(value);
      },
      enablePlugin(name: string) {
        context.enablePlugin(name);
      },
      disablePlugin(name: string) {
        context.disablePlugin(name);
      },
      requestAI(comId: string, params: SendToAgentParams) {
        window._sandbox_?.helpers.sendToAgent(comId, params);
      },
      setAgentRuntime(config: AgentRuntimeConfig) {
        agentRuntimeController.setAgentRuntime(config);
      },
      clearAgentRuntime() {
        agentRuntimeController.clearAgentRuntime();
      },
      appendInput(comId: string, input: string | SendToAgentParams) {
        ensureAIPanelOpen(comId).then(() => {
          context.appendInput(comId, input);
        });
      },
      getInput(comId?: string) {
        return context.getInput(comId);
      },
    },
    contributes: {
      aiService: {
        init(_api: any) {
          // 兼容旧版：给组件 runtime 提供项目配置读取入口
          (window as any)._getProjectConfig_ = () => {
            return {
              availableLibraries: codingConfig?.availableLibraries ?? [],
              themes: codingConfig?.themes ?? [],
              disallowedDebugEnvs: disallowedDebugEnvs ?? [],
              codeRules: codingConfig?.codeRules ?? "",
              designRules: codingConfig?.designRules ?? "",
            };
          };

          return {
            renderMessageBox() {
              return <ComChatFocusView />;
            },
            focus(params: AiServiceFocusParams) {
              // TODO：没comId的，都是没用的聚焦，之前设计器出过一次bug，兼容下这种情况，不要写进去
              if (!params.comId && params.pageId) {
                return
              }

              const currentFocus = params ?? undefined;
              if (isSameAiFocus(context.currentFocus, currentFocus)) {
                return;
              }

              context.currentFocus = currentFocus;

              // 后续要干掉
              ;(window as any)._ai_focus_params_ = params

              context.events.emit("focus", currentFocus);
            },

            request(requestParams: AiServiceRequestParams) {
              const focus = context.currentFocus;
              if (!focus) return;

              const comId = focus.comId ?? focus.pageId;
              if (!comId) return;

              const agentKey = context.getAgentKey(comId);
              const agent = context.agentMap.get(agentKey);

              if (!agent) return;

              const attachments = Array.isArray(requestParams.attachments)
                ? requestParams.attachments.map((a: any) => ({ ...a }))
                : [];
              const focusChip = requestParams.mentionFocus && focus.focusArea?.ele
                ? createDomChip(focus)
                : undefined;
              const requestMessage = focusChip
                ? `对于[[chip:${focusChip.id}]]${requestParams.message ?? ""}`
                : requestParams.message ?? "";
              const requestMeta = focusChip
                ? {
                    ...(requestParams.meta ?? {}),
                    chips: [...(requestParams.meta?.chips ?? []), focusChip],
                  }
                : requestParams.meta;

              ensureAIPanelOpen(comId).then(() => {
                context.aiQueue.send(
                  agent,
                  async () => {
                    await ensureFocusComId(comId);
                    await agent.requestAI(chipRegistry.formatRequestParams({
                      message: requestMessage,
                      attachments,
                      ...(requestMeta ? { meta: requestMeta } : {}),
                    }));
                  },
                  { message: requestMessage, attachments, ...(requestMeta ? { meta: requestMeta } : {}), focus }
                );
              })
            },
          };
        },
      },

      aiView: {
        render(_api: AiViewApi) {
          return <ChatPanelList user={user} copilot={{ name }} />;
        },
        display() {
          context.events.emit("aiViewDisplay", true);
        },
        hide() {},
      },
    },
  };
}
