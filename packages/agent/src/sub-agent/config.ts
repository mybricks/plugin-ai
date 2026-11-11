import type { Agent } from "../agent";
import type { SkillFile } from "../code-agent/skills";
import type { ResolvedSubAgentConfig, SubAgentConfig } from "./types";

/** 与 `createSubAgentTool` 注册的 `name` 一致，供 UI 等侧注册渲染器使用 */
export const CALL_SUB_AGENT_TOOL_NAME = "call-sub-agent";

/**
 * 构建子 Agent 的工具列表与 system prompt，同步与后台执行共用。
 *
 * 工具：合并父 Agent 工具与 SubAgent 私有工具，先按 disallowedTools 排除（始终排除
 * call-sub-agent 自身），再按 allowedTools 白名单过滤。未配置白名单时保留全部。
 *
 * system：未配置 system 时显式使用空字符串，不能回退继承父 Agent 的 system；
 * 配置了 skills 时把对应 SKILL.md 拼到 system 后面。
 */
export function resolveSubAgentConfig(
  parent: Agent,
  config: SubAgentConfig,
  skills: SkillFile[] = [],
): ResolvedSubAgentConfig {
  const available = [...parent.getTools(), ...(config.tools ?? [])];
  const denied = new Set([CALL_SUB_AGENT_TOOL_NAME, ...(config.disallowedTools ?? [])]);
  const tools = available.filter((tool) => {
    if (denied.has(tool.name)) return false;
    if (config.allowedTools !== undefined && !config.allowedTools.includes(tool.name)) return false;
    return true;
  });

  const skillContents = (config.skills ?? []).flatMap((name) => {
    const skill = skills.find((item) => item.name === name);
    const mainSkillMd = skill?.files.find((file) => file.path === "SKILL.md");
    return mainSkillMd ? [`<skill name="${name}">\n${mainSkillMd.content}\n</skill>`] : [];
  });
  const skillSection = skillContents.length
    ? `以下是预加载的 Skills，请直接遵照执行，无需再调用 use_skill 工具：\n\n${skillContents.join("\n\n")}`
    : "";
  const system = [config.system ?? "", skillSection].filter(Boolean).join("\n\n");

  return { tools, system, aiRole: config.aiRole };
}

/**
 * flash 子 Agent 与 summary / compact 一样固定走轻量模型；其他子 Agent
 * 在用户消息带图片附件时优先以附件决定 aiRole，否则使用配置里的 aiRole。
 * 同步与后台执行共用。
 */
export function resolveAiRole(config: ResolvedSubAgentConfig, hasImage: boolean): string | undefined {
  if (config.aiRole === "flash") return config.aiRole;
  return hasImage ? "image" : config.aiRole;
}
