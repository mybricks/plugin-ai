import React from "react";

import pkg from "../../../package.json";
console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { CodeAgent, IDBHistory } from "../../agent/src";
import type { SkillFile, TurnSender } from "../../agent/src";
import { createRequestAsStream, createOnUpload, LLMProviders } from "../../request/src";
import type { RequestAsStreamFn, ProviderConfig } from "../../request/src";
import { resolvePromptOptions, type PromptSections } from "./prompts";
import { DEFAULT_PLUGIN_SKILLS } from "./skills/default";

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
  /** 技能文件列表，挂载为虚拟 .agent/skills/ 目录，LLM 通过 use_skill 工具按需加载 */
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
  /** 透传给 CodeAgent 的历史记录实现，不传时使用内置 IDBHistory */
  history?: import("../../agent/src").History;
  /** 消息发送者信息，注入到每条用户消息中，UI 展示时优先使用 */
  sender?: TurnSender;
}

export default function pluginAI(params: PluginAIParams): any {
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
    history,
    sender
  } = params;

  const mergedPromptSections = resolvePromptOptions(promptSections);
  const mergedSkills = [...DEFAULT_PLUGIN_SKILLS, ...(skills ?? [])];

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
    skills: mergedSkills,
    promptSections: mergedPromptSections,
    tools,
    availableLibraries: codingConfig?.availableLibraries ?? [],
    themes: codingConfig?.themes ?? [],
    componentRuntime,
    history,
    sender
  });

  return {
    name: "@mybricks/plugins/ai",
    title: name,
    author: "MyBricks",
    ["author.zh"]: "MyBricks",
    version: "0.0.1",
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
