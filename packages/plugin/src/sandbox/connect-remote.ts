import { DEFAULT_CONFIG_DIR_NAME, type AgentSandbox, type CodeAgentPlugin, type CodeAgentPluginFactory, type Tool } from "../../../agent/src";
import { createInitProjectTool } from "../../../agent/src/code-agent/tools";
import type { AuditPowerImplementation, DomainAuditImplementation } from "../../../kit/src";
import { context } from "../context";
import { HttpAgent } from "../ui/chat/chat-panel/remote/http-agent";
import { createBuiltInSandboxPlugins } from "./plugins";
import { createCheckStatusTool } from "./tools/check-status";
import type { Designer, Hooks, MentionProvider, SandboxChipsConfig } from "./types";
import { injectPluginRuntimeContext, registerChips, registerMentions, type AgentRuntimeRef, type ConnectToAIResult, type PluginParams } from "./connect-shared";

interface RemoteSandboxRegistration {
  agentSandbox: AgentSandbox;
  pageAnalysis?: AuditPowerImplementation;
  designer?: Designer;
  domainAudit?: DomainAuditImplementation;
  tasksManager?: any;
  hooks?: Hooks;
  chips?: SandboxChipsConfig;
  mentions?: MentionProvider[];
}

function collectBrowserTools(params: { baseTools: Tool[]; plugins: CodeAgentPlugin[] }): Tool[] {
  return [
    ...params.baseTools,
    ...params.plugins.flatMap((plugin) => plugin.tools ?? []),
    // 服务端也可能将子 Agent 的工具调用代理到浏览器。
    ...params.plugins.flatMap((plugin) => (plugin.agents ?? []).flatMap((agent) => agent.tools ?? [])),
  ];
}

/** HTTP Agent 绑定宿主的本地视图，并将远端文件操作交给 AgentSandbox。 */
export function connectToRemoteAI(
  comId: string,
  { agentSandbox, pageAnalysis, designer, domainAudit, tasksManager, hooks, chips, mentions }: RemoteSandboxRegistration,
  params: PluginParams & { remoteAgent: NonNullable<PluginParams["remoteAgent"]> },
): ConnectToAIResult {
  const { remoteAgent, disabledHandler, disabledModes, sender, plugins, tools, configDirName, llmPluginKey, agentRuntimeRefs, codeRules, designRules } = params;
  const resolvedConfigDirName = configDirName ?? DEFAULT_CONFIG_DIR_NAME;
  const agentKey = context.getAgentKey(comId);
  registerChips(agentKey, chips);
  registerMentions(agentKey, mentions);
  const runtimeRef: AgentRuntimeRef = agentRuntimeRefs.get(agentKey) ?? { current: undefined };
  agentRuntimeRefs.set(agentKey, runtimeRef);
  const activeTools = runtimeRef.current?.tools ?? tools;
  const runtimePlugins = [
    ...createBuiltInSandboxPlugins({ configDirName: resolvedConfigDirName, pageAnalysis }),
    ...(plugins ?? []),
  ].map((plugin) => {
    const withSandbox = typeof plugin === "function" && (tasksManager || domainAudit)
      ? ((ctx: Parameters<typeof plugin>[0]) => plugin({ ...ctx, sandbox: Object.assign({}, ctx.sandbox, { tasksManager, domainAudit }) }))
      : plugin;
    return injectPluginRuntimeContext(withSandbox, { agentSandbox, designer, codeRules, designRules });
  });
  const requestGuard = { disabledHandler };
  if (context.agentMap.has(agentKey)) {
    const existingAgent = context.agentMap.get(agentKey)!;
    context.aiQueue.setRequestGuard(existingAgent, requestGuard);
    return { history: existingAgent.getHistory(), disabledHandler, isRemoteAgent: true, remoteFs: existingAgent.remoteFs };
  }

  const staticPlugins = runtimePlugins.filter((plugin): plugin is CodeAgentPlugin => typeof plugin !== "function");
  const browserTools = collectBrowserTools({
    baseTools: [
      ...(designer ? [createCheckStatusTool({ current: designer }), createInitProjectTool(agentSandbox)] : []),
      ...(activeTools ?? []),
    ],
    plugins: staticPlugins,
  });
  const agent = new HttpAgent(
    { baseUrl: remoteAgent.baseUrl, workspaceId: remoteAgent.workspaceId, agentId: remoteAgent.agentId },
    {
      disabledHandler, disabledModes, browserTools, hooks, plugins: staticPlugins,
      onVersionSaved: remoteAgent.onVersionSaved,
      pluginFactories: runtimePlugins.filter((plugin): plugin is CodeAgentPluginFactory => typeof plugin === "function"),
      pluginContext: { sandbox: agentSandbox, configDirName: resolvedConfigDirName },
      sender,
    },
  );
  const workspaceReady = agent.files.bindSandbox(agentSandbox);
  if (llmPluginKey) context.createLLMRequest(llmPluginKey, agent.key);
  context.aiQueue.setRequestGuard(agent, requestGuard);
  context.agentMap.set(agentKey, agent);
  context.sandboxMap.set(agentKey, agentSandbox);
  context.registerAgentComId(comId);
  return { history: agent.getHistory(), disabledHandler, isRemoteAgent: true, workspaceReady, remoteFs: agent.remoteFs };
}
