import type { CodeAgentPlugin } from "../../../../agent/src";
import { designerPlugin } from "./designer";
import { createAuditPowerPlugin, type AuditPowerImplementation } from "../../../../kit/src";

/**
 * 所有 sandbox 共享的内置 Agent 插件。
 *
 * AuditPower 以 Plugin 内的隔离 SubAgent 形式注入；执行器由宿主的
 * Designer/AgentSandbox 注入，页面分析工具只由该 SubAgent 持有。
 */
export function createBuiltInSandboxPlugins(params: {
  configDirName: string;
  pageAnalysis?: AuditPowerImplementation;
}): CodeAgentPlugin[] {
  return [
    designerPlugin,
    createAuditPowerPlugin({ configDirName: params.configDirName, implementation: params.pageAnalysis }),
  ];
}

export { designerPlugin } from "./designer";
