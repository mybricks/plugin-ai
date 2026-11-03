import { CodeAgent } from '../../../agent/src';
import { buildDevelopmentGuideContext } from '../../../kit/src';
import { context } from '../context';
import { injectSkillRuntimeContext, type ConnectToAIResult, type PluginParams } from '../sandbox/connect-shared';
import type { RegistSandBoxConfig } from '../sandbox/types';
import { connectMcpBrowser, type McpBridgeOptions } from './browser-bridge';

/** Connect a local sandbox to the optional MCP bridge after its agent is ready. */
export function createMcpAttach(options: McpBridgeOptions, params: PluginParams) {
  const connections = new Map<string, () => void>();
  return (comId: string, config: RegistSandBoxConfig, result: ConnectToAIResult): void => {
    if (result.isRemoteAgent) return;
    const key = context.getAgentKey(comId);
    const agent = context.agentMap.get(key);
    const sandbox = context.sandboxMap.get(key);
    if (!(agent instanceof CodeAgent) || !sandbox || connections.has(key)) return;

    const { codeRules, designRules, agentRuntimeRefs, skills, promptSections } = params;
    const runtimeContext = config.designer
      ? { designer: config.designer, codeRules, designRules }
      : { agentSandbox: config.agentSandbox };
    connections.set(key, connectMcpBrowser({ ...options, workspaceId: options.workspaceId ?? comId }, agent, {
      getSkills: () => [
        ...(agentRuntimeRefs.get(key)?.current?.skills ?? skills ?? []).map(skill => injectSkillRuntimeContext(skill, runtimeContext)),
        ...agent.getPlugins().flatMap(plugin => plugin.skills ?? []),
      ],
      getDevelopmentGuide: async () => buildDevelopmentGuideContext({
        promptSections: agentRuntimeRefs.get(key)?.current?.promptSections ?? promptSections,
        codeRules,
        designRules,
        libraries: config.designer ? await config.designer.getEffectiveLibraries() : [],
      }),
    }, result.workspaceReady));
  };
}
