import React from "react";

import pkg from "../../../package.json";
console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { CodeAgent, IDBHistory } from "../../agent/src";
import type { SkillFile } from "../../agent/src";
import { createRequestAsStream, createOnUpload } from "../../request/src";
import type { RequestAsStreamFn } from "../../request/src";
import { resolvePromptOptions, type PromptSections } from "./prompts";

import { context } from "./context";
import { setupSandbox } from "./sandbox";
import type { Designer, Hooks, RegistSandBoxConfig } from "./sandbox";
import { ChatPanelList, ChatStartView, ComChatStartView } from "./ui/chat";
import { ensureAIPanelOpen, ensureFocusComId } from "./utils/ensure-ai-panel-open";

// ─── 工具类型重导出 ────────────────────────────────────────────────────────────

export { CodeAgent, IDBHistory } from "../../agent/src";
export type { AgentEventMap, SkillFile } from "../../agent/src";
export { createRequestAsStream, createOnUpload, createCustomRequest } from "../../request/src";
export type { RequestAsStreamFn, CustomRequestConfig } from "../../request/src";
export { openSetting, closeSetting, SettingModal } from "./ui/setting";
export type { SettingModalProps } from "./ui/setting";
export type { Designer, Hooks, RegistSandBoxConfig, SandboxAPI, SandboxHelpers, SandboxConfig, SendToAgentParams } from "./sandbox";
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
    componentRuntime
  } = params;

  const mergedPromptSections = resolvePromptOptions(promptSections);

  const requestAsStream: RequestAsStreamFn = onRequest ?? createRequestAsStream();
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

  // ── window._sandbox_：sandbox 与 Plugin 的统一交互 API ─────────────────────

  setupSandbox({
    requestAsStream,
    agentsMd,
    skills,
    promptSections: mergedPromptSections,
    tools,
    availableLibraries: codingConfig?.availableLibraries ?? [],
    themes: codingConfig?.themes ?? [],
    componentRuntime
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
