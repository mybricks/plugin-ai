import type { Agent } from "../agent";
import type { SkillFile } from "../code-agent/skills";
import type { Tool, ToolExecutionContext } from "../types";
import { CALL_SUB_AGENT_TOOL_NAME, resolveAiRole, resolveSubAgentConfig } from "./config";
import { runBackgroundSubAgent } from "./async-sub-agent";
import { runSyncSubAgent } from "./sync-sub-agent";
import type { ChildAgentRequest, CallSubAgentArgs, SubAgentConfig } from "./types";

/**
 * 创建 `call-sub-agent` 工具。
 *
 * 工具参数：
 *   - prompt  传给子 Agent 的消息
 *   - type    选择哪种子 Agent（enum 由 configs 的 name 字段生成）
 *   - name    本次任务名，不超过 8 个字，用于界面标识
 *   - async   是否后台执行，需该 SubAgent 声明 supportsAsync
 *
 * description 中会列出所有可用类型及其描述，便于 LLM 按需选择。
 * 同步与后台执行共用同一套配置解析（工具过滤 / system / aiRole），
 * 两种模式共用请求参数和执行生命周期；后台模式独立保存历史，不继承父 turn 的取消。
 *
 * @param getAgent  懒引用获取父 Agent 实例（避免在 super() 前访问 this）
 * @param configs   子 Agent 配置列表
 * @param skills    已解析的 skill 文件列表（用于 skills 预加载）
 */
export function createSubAgentTool(
  getAgent: () => Agent,
  configs: SubAgentConfig[],
  skills?: SkillFile[],
): Tool {
  const configMap = new Map(configs.map((config) => [config.name, config]));
  const description = [
    "调用 SubAgent 处理特定任务。",
    ...configs.map((config) => `${config.name}: ${config.description} (async: ${config.supportsAsync === true})`),
  ].join("\n");

  return {
    name: CALL_SUB_AGENT_TOOL_NAME,
    description,
    parameters: {
      type: "object",
      properties: {
        async: {
          type: "boolean",
          description: "后台运行并立即返回子会话标识，默认 false。",
        },
        prompt: {
          type: "string",
          description: "传给子 Agent 的消息内容",
        },
        type: {
          type: "string",
          enum: configs.map((config) => config.name),
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
    execute: async (rawArgs: CallSubAgentArgs, ctx: ToolExecutionContext) => {
      const args = rawArgs;
      const background = args.async === true;

      const config = configMap.get(args.type);
      if (!config) return { output: `Error: SubAgent type not found: ${args.type}` };
      if (background && !config.supportsAsync) throw new Error(`SubAgent ${args.type} does not support async`);

      const parent = getAgent();
      const resolved = resolveSubAgentConfig(parent, config, skills);

      // 检查用户消息是否有图片附件，优先以附件决定 aiRole
      const hasImage = ctx.getUserMessage().attachments?.some((attachment) => attachment.type === "image") ?? false;
      const aiRole = resolveAiRole(resolved, hasImage);
      const title = args.name?.trim() || config.title || args.type;

      const request: ChildAgentRequest = {
        parentAgentKey: parent.key ?? "",
        parentTurnId: ctx.turnId,
        parentToolCallId: ctx.callId,
        type: args.type,
        title,
        prompt: args.prompt,
        system: resolved.system,
        tools: resolved.tools,
        aiRole,
      };
      if (background) return runBackgroundSubAgent(parent, request);
      return runSyncSubAgent(parent, request, ctx);
    },
  };
}
