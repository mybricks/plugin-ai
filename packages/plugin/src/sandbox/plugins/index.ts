import type { CodeAgentPlugin } from "../../../../agent/src";
import { designerPlugin } from "./designer";
import { createAuditPowerPlugin, type AuditPowerImplementation } from "../../../../kit/src";

/**
 * 所有 sandbox 共享的内置 Agent 插件。
 *
 * AuditPower 的 Skill 在两条链路保持一致；`connectToAI` 注册时按运行时注入
 * 执行器由宿主的 Designer/AgentSandbox 注入；工具声明始终由 AuditPower 持有。
 */
export function createBuiltInSandboxPlugins(params: {
  configDirName: string;
  pageAnalysis?: AuditPowerImplementation;
}): CodeAgentPlugin[] {
  return [
    designerPlugin,
    // 暂时注释，等测试完
    // createAuditPowerPlugin({ configDirName: params.configDirName, implementation: params.pageAnalysis }),
  ];
}

export { designerPlugin } from "./designer";
