import React from "react";
import "./ui/renders/register";

import pkg from "../package.json";
console.log(`%c ${pkg.name} %c@${pkg.version}`, `color:#FFF;background:#fa6400`, ``, ``);

import { CodeAgent, IDBHistory } from "@plugin-ai/agent";
import type { SandboxAdapter } from "@plugin-ai/agent";
import { createRequestAsStream, createOnUpload } from "@plugin-ai/request";
import type { RequestAsStreamFn } from "@plugin-ai/request";

import { context } from "./context";
import { ChatPanel, ChatStartView } from "./ui/chat";

// ─── 工具类型重导出 ────────────────────────────────────────────────────────────

export { CodeAgent, IDBHistory } from "@plugin-ai/agent";
export type { SandboxAdapter, AgentEventMap, SkillFile } from "@plugin-ai/agent";
export { createRequestAsStream, createOnUpload } from "@plugin-ai/request";
export type { RequestAsStreamFn } from "@plugin-ai/request";

// ─── window API 类型声明 ──────────────────────────────────────────────────────

declare global {
  interface Window {
    /**
     * 注册组件沙箱能力（文件系统适配器 + pluginContext）。
     * 组件侧在初始化时调用，plugin 会据此创建或更新 CodeAgent。
     *
     * @example
     * window._configSandBox_(comId, {
     *   adapter: { getFiles, updateFiles },
     *   pluginContext: { getFocusArea: () => currentFocusArea },
     * });
     */
    _configSandBox_: (
      comId: string,
      config: {
        adapter: SandboxAdapter;
        pluginContext?: {
          onProgress?: (status: any) => void;
          getFocusArea?: () => any;
        };
      }
    ) => void;
    /**
     * 组件沙箱可用的渲染工具，由 plugin 注册。
     * （由 register.tsx 写入）
     */
    _sandbox_renders_: any;
  }
}

// ─── plugin 主入口 ────────────────────────────────────────────────────────────

export default function pluginAI(params?: any): any {
  const {
    name = "智能助手",
    user,
    key,
    onRequest,
    onUpload,
    /**
     * agents.md 内容，注入到 CodeAgent 系统 prompt 末尾。
     *
     * 对标 claude-code 的 CLAUDE.md 机制：
     *   - CLAUDE.md 由文件系统发现并注入，供 Claude Code 了解项目规范
     *   - agentsMd 由 plugin 调用方在初始化时以字符串方式传入
     *
     * 典型用途：
     *   - 声明项目技术栈、编码规范、约束规则
     *   - 指定组件库版本、禁止使用的 API
     *   - 描述文件结构或设计原则
     *
     * @example
     * pluginAI({
     *   agentsMd: `
     * # 项目规范
     * - 使用 React 18 + TypeScript
     * - UI 库：mybricks/comlib-pc-normal
     * - 禁止使用 jQuery
     * `,
     * });
     */
    agentsMd,
    /**
     * 技能文件列表（Skills）。
     *
     * 对标 claude-code 的 .claude/skills/ 目录机制：
     *   - 每个 SkillFile 挂载为虚拟文件（路径前缀 .skills/）
     *   - system prompt 中列出 skills 目录（name + description + whenToUse）
     *   - LLM 按需通过 read_file 工具读取完整内容，不全量注入
     *
     * @example
     * pluginAI({
     *   skills: [
     *     {
     *       path: "react/component/SKILL.md",
     *       content: `---
     * name: React 组件规范
     * description: React 组件开发规范
     * when_to_use: 开发或修改 React 组件时使用
     * ---
     * # 规范内容...`,
     *     },
     *   ],
     * });
     */
    skills,
  } = params ?? {};

  const requestAsStream: RequestAsStreamFn = onRequest ?? createRequestAsStream();
  const upload = onUpload ?? createOnUpload();

  context.name = name;
  context.pluginParams = { name, user, key, onUpload: upload };

  // ── window._configSandBox_：组件注册沙箱能力 ──────────────────────────────

  window._configSandBox_ = (comId, config) => {
    // 更新或创建 sandboxEntry
    context.sandboxMap.set(comId, {
      adapter: config.adapter,
      pluginContext: config.pluginContext ?? {},
    });

    // 创建或更新 CodeAgent
    if (context.agentMap.has(comId)) {
      // 更新已有 agent 的沙箱适配器
      (context.agentMap.get(comId) as CodeAgent).setAdapter(config.adapter);
    } else {
      const agent = new CodeAgent({
        key: key ? `${key}_${comId}` : comId,
        history: new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
        request: requestAsStream,
        adapter: config.adapter,
        agentsMd,
        skills,
      });
      context.agentMap.set(comId, agent);
    }
  };

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

              const agent = context.agentMap.get(comId);
              const sandbox = context.sandboxMap.get(comId);

              if (!agent) return;

              const focusKey = key ? `${key}_${comId}` : comId;
              const attachments = Array.isArray(requestParams.attachments)
                ? requestParams.attachments.map((a: any) => ({ ...a }))
                : [];

              context.aiQueue.send(
                focusKey,
                async () => {
                  // pluginContext 在此动态取最新值
                  const contextPrompt = sandbox?.pluginContext?.getFocusArea?.();
                  await agent.requestAI({
                    message: requestParams.message ?? "",
                    attachments,
                    contextPrompt,
                  });
                },
                { message: requestParams.message, attachments, focus }
              );
            },
          };
        },
      },

      aiView: {
        render(api: AiViewApi) {
          return <ChatPanel user={user} copilot={{ name, avatar: "https://my.mybricks.world/image/icon.png" }} api={api} />;
        },
        display() {
          context.events.emit("aiViewDisplay", true);
        },
        hide() {},
      },
    },
  };
}
