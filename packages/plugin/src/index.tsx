import React from "react";

import pkg from "../../../package.json";
console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { CodeAgent, IDBHistory } from "../../agent/src";
import type { SkillFile } from "../../agent/src";
import { createRequestAsStream, createOnUpload, LLMProviders } from "../../request/src";
import type { RequestAsStreamFn, ProviderConfig } from "../../request/src";
import { resolvePromptOptions, type PromptSections } from "./prompts";
import { CODE_SEARCH_USING_TOOLS_SECTION, CODE_SEARCH_EXAMPLES_SECTION } from "./prompts/mybricks";

import { context } from "./context";
import { setupSandbox } from "./sandbox";
import type { Designer, Hooks, RegistSandBoxConfig } from "./sandbox";
import { ChatPanelList, ChatStartView, ComChatStartView } from "./ui/chat";
import { ensureAIPanelOpen, ensureFocusComId } from "./utils/ensure-ai-panel-open";

// ─── 工具类型重导出 ────────────────────────────────────────────────────────────

export { CodeAgent, IDBHistory } from "../../agent/src";
export type { AgentEventMap, SkillFile } from "../../agent/src";
export { createRequestAsStream, createOnUpload } from "../../request/src";
export type { RequestAsStreamFn } from "../../request/src";
export { openSetting, closeSetting, SettingModal } from "./ui/setting";
export type { SettingModalProps } from "./ui/setting";
export type { Designer, Hooks, RegistSandBoxConfig, SandboxAPI, SandboxHelpers, SandboxConfig, SendToAgentParams } from "./sandbox";
export type { SettingValue, ProviderConfig, ModelConfig } from "./ui/setting";
export { ChatPanel, ChatPanelList, ChatStartView, ComChatStartView } from "./ui/chat";
export type { ChatPanelProps, ChatPanelListProps, ChatStartViewProps, ComChatStartViewProps } from "./ui/chat";

// ─── PluginAI 实例 API ────────────────────────────────────────────────────────

/** pluginAI() 返回的 controller 控制方法集合，与 Mybricks 插件属性隔离 */
export interface PluginAIController {
  /** 禁用输入框发送，等同于 setDisabled(true) */
  disable(): void;
  /** 启用输入框发送，等同于 setDisabled(false) */
  enable(): void;
  /** 动态设置禁用状态 */
  setDisabled(value: boolean): void;
}

/** pluginAI() 返回值，顶层为 Mybricks 插件标准属性，controller 为扩展控制接口 */
export interface PluginAIAPI {
  /** 扩展控制接口，非 Mybricks 设计器属性，与插件数据结构隔离 */
  controller: PluginAIController;
}

// ─── plugin 主入口 ────────────────────────────────────────────────────────────

export interface PluginAIParams {
  name?: string;
  user?: { name?: string; avatar?: string };
  /** 插件命名空间，用于隔离多实例的 agent 存储和队列，必填 */
  key: string;
  onRequest?: RequestAsStreamFn;
  onUpload?: (file: File) => Promise<string>;
  onDownload?: (params: { name: string; content: string }) => Promise<void> | void;
  codingConfig?: {
    availableLibraries?: any[];
    themes?: any[];
    codeRules?: string;
    designRules?: string;
  };
  /** agents.md 内容，对标 CLAUDE.md，注入到系统 prompt 末尾 */
  agentsMd?: string;
  /** 技能文件列表，挂载为虚拟 .skills/ 文件，LLM 按需读取 */
  skills?: SkillFile[];
  /** 覆盖内置系统提示词各节，按 key 深度合并，未提供的 key 保留 MYBRICKS_PROMPT_SECTIONS 默认值 */
  promptSections?: PromptSections;
  /** 额外自定义工具，追加到内置工具（read_file / write_file 等）之后 */
  tools?: import("../../agent/src").Tool[];
  /** 组件运行时扩展 */
  componentRuntime?: {
    /** 基于babel的自定义插件 */
    babelPlugins?: ((params: { filename: string }) => ((params: any) => any))[]
    /** 获取依赖信息 */
    getDependencies?: (params: any) => Record<string, any>
    /** 入口文件 */
    entryFile?: string
    /** 画布 */
    canvas?: {
      width?: number
      height?: number
    }
  }
  /** LLM 配置（自定义渠道时使用） */
  llm?: {
    providers?: import("./ui/setting").ProviderConfig[];
  };
  /**
   * @experimental 是否开启代码搜索模式（默认 false）。此参数为过渡阶段配置，后续可能移除。
   * - false（默认）：每次发送消息时将全量代码文件内容注入上下文。
   * - true：仅注入文件路径列表，LLM 通过 grep/glob 工具按需读取代码内容。
   */
  codeSearch?: boolean;
  /** 透传给 CodeAgent 的历史记录实现，不传时使用内置 IDBHistory */
  history?: import("../../agent/src").History;
}

export default function pluginAI(params: PluginAIParams): PluginAIAPI & Record<string, any> {
  const {
    name = "智能助手",
    user,
    key: pluginKey,
    onRequest,
    onUpload,
    onDownload,
    codingConfig,
    agentsMd,
    skills,
    promptSections,
    tools,
    componentRuntime,
    llm,
    codeSearch = true,
    history
  } = params;

  // TODO：以后 codeSearch配置 要删掉，开启全量，现在是过渡阶段，
  const codeSearchPromptSections: PromptSections = {
    agent: {
      usingToolsSection: CODE_SEARCH_USING_TOOLS_SECTION,
    },
    developeGuide: {
      examplesSection: CODE_SEARCH_EXAMPLES_SECTION,
    }
  };
  const mergedPromptSections = resolvePromptOptions(promptSections ? promptSections : (codeSearch ? codeSearchPromptSections : {}));

  // ─── 处理 LLMProviders 注入 ────────────────────────────────────────────────
  let effectiveRequest: RequestAsStreamFn;

  // 优先使用外部传入的 llm
  if (llm?.providers?.length) {
    // 如果提供了 llm.providers 配置，创建 LLMProviders 实例
    const providers = llm.providers;
    const llmProviders = new LLMProviders({
      providers: providers as ProviderConfig[],
      agentKey: pluginKey
    });
    context.setLLMProviders(llmProviders);
    effectiveRequest = llmProviders.request;
  } else if (onRequest) {
    effectiveRequest = onRequest;
  } else {
    effectiveRequest = createRequestAsStream();
  }

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
  context.setPluginKey(pluginKey);
  context.pluginParams = { name, user, onUpload: upload, onDownload: download };

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

  setupSandbox({
    requestAsStream,
    agentsMd,
    skills,
    promptSections: mergedPromptSections,
    tools,
    availableLibraries: codingConfig?.availableLibraries ?? [],
    themes: codingConfig?.themes ?? [],
    componentRuntime,
    codeSearch,
    history
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
    },
    contributes: {
      aiService: {
        init(_api: any) {
          // 兼容旧版：给组件 runtime 提供项目配置读取入口
          (window as any)._getProjectConfig_ = () => {
            return {
              availableLibraries: codingConfig?.availableLibraries ?? [],
              themes: codingConfig?.themes ?? [],
              codeRules: codingConfig?.codeRules ?? "",
              designRules: codingConfig?.designRules ?? "",
            };
          };

          return {
            focus(params: AiServiceFocusParams) {
              // TODO：没comId的，都是没用的聚焦，之前设计器出过一次bug，兼容下这种情况，不要写进去
              if (!params.comId && params.pageId) {
                return
              }

              const currentFocus = params ?? undefined;
              context.currentFocus = currentFocus;

              // 后续要干掉
              window._ai_focus_params_ = params

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

              ensureAIPanelOpen(comId).then(() => {
                context.aiQueue.send(
                  agentKey,
                  async () => {
                    await ensureFocusComId(comId);
                    context.aiQueue.registerAbort(agentKey, () => agent.abort());
                    await agent.requestAI({
                      message: requestParams.message ?? "",
                      attachments,
                    });
                  },
                  { message: requestParams.message, attachments, focus }
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
