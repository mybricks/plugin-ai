import { CodeAgent, IDBHistory } from "../../../agent/src";
import type { Tool, Sandbox, CodeAgentPromptOptions, AgentHooks } from "../../../agent/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { Designer, RegistSandBoxConfig } from "./types";
import { createCheckStatusTool } from "./tools/check-status";
import { context } from "../context";

export type { Designer, RegistSandBoxConfig };
export type { AgentHooks as Hooks };

export interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  agentsMd?: string;
  skills?: any[];
  promptOptions?: CodeAgentPromptOptions;
  tools?: Tool[];
}

/**
 * 将 window._registSandBox_ 挂载到全局，供组件库调用。
 * 在 pluginAI() 初始化时调用一次。
 */
export function setupRegistSandBox(pluginParams: PluginParams): void {
  window._registSandBox_ = (comId, config) => {
    registSandBox(comId, config, pluginParams);
  };
}

function registSandBox(
  comId: string,
  { designer, hooks }: RegistSandBoxConfig,
  { requestAsStream, agentsMd, skills, promptOptions, tools }: PluginParams
): void {
  const agentKey = context.getAgentKey(comId);

  // 已注册过则忽略
  if (context.agentMap.has(agentKey)) return;

  // designer 同时承担 Sandbox（文件读写）角色
  const sandbox: Sandbox = {
    getFiles: designer.getFiles.bind(designer),
    updateFiles: designer.updateFiles.bind(designer),
    deleteFiles: designer.deleteFiles.bind(designer),
    getContext: async () => {
      return designerRef.current?.exportToMessage() ?? null;
    },
  };

  // designerRef 用 ref 包裹，供工具闭包访问
  const designerRef: { current: Designer | undefined } = { current: designer };

  const checkStatusTool = createCheckStatusTool(designerRef);

  const agent = new CodeAgent({
    key: agentKey,
    history: new IDBHistory({ dbName: "@plugin-ai/plugin/messages" }),
    request: requestAsStream,
    sandbox,
    tools: [checkStatusTool, ...(tools ?? [])],
    promptOptions,
    hooks,
    agentsMd,
    skills,
  });

  // agentMap / sandboxMap 统一用 agentKey 存储，与 agent.key 一致
  context.sandboxMap.set(agentKey, { sandbox, designerRef });
  context.agentMap.set(agentKey, agent);
}
