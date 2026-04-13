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
  /** agents.md 内容，对标 CLAUDE.md，注入到系统 prompt 末尾 */
  agentsMd?: string;
  /** 技能文件列表，挂载为虚拟 .skills/ 文件，LLM 按需读取 */
  skills?: SkillFile[];
  /** 覆盖内置系统提示词各节，按 key 深度合并，未提供的 key 保留 MYBRICKS_PROMPT_SECTIONS 默认值 */
  promptSections?: PromptSections;
  /** 额外自定义工具，追加到内置工具（read_file / write_file 等）之后 */
  tools?: import("../../agent/src").Tool[];
}

export default function pluginAI(params: PluginAIParams): any {
  const {
    name = "智能助手",
    user,
    key: pluginKey,
    onRequest,
    onUpload,
    agentsMd,
    skills,
    promptSections,
    tools,
  } = params;

  const mergedPromptSections = resolvePromptOptions(promptSections);

  const requestAsStream: RequestAsStreamFn = onRequest ?? createRequestAsStream();
  const upload = onUpload ?? createOnUpload();

  context.name = name;
  context.setPluginKey(pluginKey);
  context.pluginParams = { name, user, onUpload: upload };

  // ── window._sandbox_：sandbox 与 Plugin 的统一交互 API ─────────────────────

  setupSandbox({ requestAsStream, agentsMd, skills, promptSections: mergedPromptSections, tools });

  return {
    name: "@mybricks/plugins/ai",
    title: name,
    author: "MyBricks",
    ["author.zh"]: "MyBricks",
    version: "0.0.1",
    contributes: {
      aiService: {
        init(_api: any) {
          return {
            focus(params: AiServiceFocusParams) {
              const currentFocus = params ?? undefined;
              context.currentFocus = currentFocus;
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

              context.aiQueue.send(
                agentKey,
                async () => {
                  await agent.requestAI({
                    message: requestParams.message ?? "",
                    attachments,
                  });
                },
                { message: requestParams.message, attachments, focus }
              );
            },
          };
        },
      },

      aiView: {
        render(_api: AiViewApi) {
          return <ChatPanelList user={user} copilot={{ name, avatar: "https://my.mybricks.world/image/icon.png" }} />;
        },
        display() {
          context.events.emit("aiViewDisplay", true);
        },
        hide() {},
      },
    },
  };
}
