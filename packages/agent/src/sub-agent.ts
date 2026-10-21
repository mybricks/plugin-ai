import type { Agent } from "./agent";
import { createChildAgentBridge } from "./child-agent";
import type { Tool } from "./types";

// TODO: 将 SubAgent 迁移为 CodeAgent 的内置运行时插件。
// 这样任务队列、beforeRequest 回传与动态工具创建都由插件自身管理，避免 CodeAgent 了解 SubAgent 细节。
// 依赖后续扩展插件生命周期：在 CodeAgent 实例创建后 setup，并支持按当前资源动态提供 tools / hooks。

/** 与 `createSubAgentTool` 注册的 `name` 一致，供 UI 等侧注册渲染器使用 */
export const CALL_SUB_AGENT_TOOL_NAME = "call-sub-agent";

// ─── SubAgentConfig ───────────────────────────────────────────────────────────

/** SubAgent 的纯配置声明。 */
export interface SubAgentConfig {
  /** 唯一标识，供 call-sub-agent.type 使用。 */
  name: string;
  /** 功能描述，供父 Agent 判断何时委派。 */
  description: string;
  /** UI 显示标题。 */
  title?: string;
  /** 子 Agent 的 system prompt；不传时不使用 system，也不继承父 Agent 的 system。 */
  system?: string;
  /** 仅允许使用的工具名称；不传则继承全部父工具并叠加私有工具。 */
  allowedTools?: string[];
  /** 禁止使用的工具名称。 */
  disallowedTools?: string[];
  /** 指定模型角色。 */
  aiRole?: string;
  /** 需要预加载到子 Agent 上下文的 Skill 名称。 */
  skills?: string[];
  /**
   * 仅在此 SubAgent 运行时可见的工具。
   *
   * 这些工具不会注册到父 Agent；配置了 allowedTools 时，仍需在其中列出
   * 对应名称才会被实际注入。
   */
  tools?: Tool[];
}

// ─── createSubAgentTool ────────────────────────────────────────────────────────

/**
 * 创建 `call-sub-agent` 工具。
 *
 * 工具参数：
 *   - prompt  传给子 Agent 的消息
 *   - type    选择哪种子 Agent（enum 由 subAgentConfigs 的 name 字段生成）
 *   - name    本次任务名，不超过 8 个字，用于界面标识
 *
 * description 中会列出所有可用类型及其描述，便于 LLM 按需选择。
 *
 * @param getAgent         懒引用获取父 Agent 实例（避免在 super() 前访问 this）
 * @param subAgentConfigs  子 Agent 配置列表
 * @param resolvedSkills   已解析的 skill 文件列表（用于 skills 预加载）
 */
export function createSubAgentTool(
  getAgent: () => Agent,
  subAgentConfigs: SubAgentConfig[],
  resolvedSkills?: import("./code-agent/skills").SkillFile[],
): Tool {
  const configMap = new Map<string, SubAgentConfig>();
  for (const config of subAgentConfigs) {
    configMap.set(config.name, config);
  }

  const description = `调用 SubAgent 处理特定任务。`;

  return {
    name: CALL_SUB_AGENT_TOOL_NAME,
    description,
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "传给子 Agent 的消息内容",
        },
        type: {
          type: "string",
          enum: subAgentConfigs.map((c) => c.name),
          description: "选择使用哪个子 Agent",
        },
        name: {
          type: "string",
          maxLength: 10,
          description: "本次任务名标识，不超过 8 个字，中文",
        },
      },
      required: ["prompt", "type", "name"],
    },
    execute: async (
      { prompt, type }: { prompt: string; type: string; name: string },
      ctx,
    ) => {
      const config = configMap.get(type);
      if (!config) {
        return { output: `Error: SubAgent type not found: ${type}` };
      }

      // 检查用户消息是否有图片附件，优先以附件决定 aiRole
      const { attachments } = ctx.getUserMessage();
      const hasImage = attachments?.some((a: any) => a.type === "image");
      const aiRole = hasImage ? "image" : config.aiRole;

      const parentAgent = getAgent();

      // 构建工具列表（按 tools 白名单 / disallowedTools 黑名单过滤父 Agent 工具，
      // 并合入仅此 SubAgent 可见的私有工具）。
      let subAgentTools: Tool[] | undefined;
      const parentTools: Tool[] = (parentAgent as any).options?.tools ?? [];
      const availableTools = [...parentTools, ...(config.tools ?? [])];

      if (config.allowedTools !== undefined) {
        // 白名单模式：只允许指定工具
        subAgentTools = availableTools.filter((t) => config.allowedTools!.includes(t.name));
      } else if (config.disallowedTools?.length) {
        // 黑名单模式：继承全部，排除指定工具（同时排除 call-sub-agent 自身）
        const denied = new Set([...config.disallowedTools, CALL_SUB_AGENT_TOOL_NAME]);
        subAgentTools = availableTools.filter((t) => !denied.has(t.name));
      } else if (config.tools?.length) {
        // 有私有工具时必须显式传入，否则 createSubAgent 会仅继承父 Agent 工具。
        subAgentTools = availableTools;
      }
      // 若两者都未指定，subAgentTools 为 undefined，createSubAgent 会继承父 Agent 工具（自动过滤 call-sub-agent）

      // 未配置 system 时显式使用空字符串，不能回退继承父 Agent 的 system。
      let system = config.system ?? "";

      if (config.skills?.length && resolvedSkills?.length) {
        const skillContents: string[] = [];
        for (const skillName of config.skills) {
          const skillFile = resolvedSkills.find((s) => s.name === skillName);
          if (!skillFile) continue;
          const mainSkillMd = skillFile.files.find((f) => f.path === "SKILL.md");
          if (!mainSkillMd) continue;
          skillContents.push(
            `<skill name="${skillName}">\n${mainSkillMd.content}\n</skill>`
          );
        }
        if (skillContents.length) {
          const skillsSection = `以下是预加载的 Skills，请直接遵照执行，无需再调用 use_skill 工具：\n\n${skillContents.join("\n\n")}`;
          system = system ? `${system}\n\n${skillsSection}` : skillsSection;
        }
      }

      const subAgent = parentAgent.createSubAgent({
        system,
        tools: subAgentTools,
        aiRole,
      });
      const bridge = createChildAgentBridge({
        subAgent,
        parentAgent,
        ctx,
        subAgentType: type,
        title: config.title,
        userText: prompt,
      });
      if ("error" in bridge) return { output: bridge.error };

      bridge.subscribe({ contentThrottleMs: 250 });
      const { lastTurn, status, error } = await bridge.runRequest(prompt);
      const finished = bridge.finish(lastTurn, status, error);
      if (error) {
        return {
          output: bridge.summarizeToolCalls(`SubAgent 执行失败: ${error}`),
          metadata: bridge.metadata(finished.status),
        };
      }
      const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter) => !("type" in iter));
      const output = (lastLLMIter as { content?: string } | undefined)?.content ?? "";
      return {
        output: bridge.summarizeToolCalls(output || "(SubAgent 未产生输出)"),
        metadata: bridge.metadata(finished.status),
      };
    },
  };
}
