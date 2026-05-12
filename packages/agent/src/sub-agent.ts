import type { Agent } from "./agent";
import type { Tool } from "./types";

/** 与 `createSubAgentTool` 注册的 `name` 一致，供 UI 等侧注册渲染器使用 */
export const CALL_SUB_AGENT_TOOL_NAME = "call-sub-agent";

// ─── SubAgentConfig ───────────────────────────────────────────────────────────

/**
 * 子 Agent 配置。
 * 每种 SubAgent 对应一个配置项，通过 `type` 唯一标识。
 */
export interface SubAgentConfig {
  /**
   * 唯一类型标识，与 `call-sub-agent` 工具的 type 参数对应。
   * 同时参与 AgentTool 的 description 拼接，LLM 可据此感知有哪些子 Agent 可调用。
   */
  type: string;

  /**
   * 该 SubAgent 的功能描述。
   * 会拼接到 `call-sub-agent` 工具的 description 中，告知 LLM 此类子 Agent 的能力。
   */
  description: string;

  /**
   * 工具结果标题（显示在 UI 工具调用卡片上）。
   * 不传则截取 description 前 20 字。
   */
  title?: string;

  /**
   * 该 SubAgent 的系统 prompt。
   * 不传则继承父 Agent 的 system。
   */
  system?: string;

  /**
   * 该 SubAgent 的 aiRole（指定模型角色）。
   * 不传则继承父 Agent 的请求参数。
   */
  aiRole?: string;

  /**
   * 该 SubAgent 的工具列表。
   * 不传则继承父 Agent 的工具列表（自动过滤掉 call-sub-agent 工具本身）。
   * 传入则使用指定工具列表（同样会过滤掉 call-sub-agent）。
   */
  tools?: Tool[];

  /**
   * 自定义执行逻辑。
   * 子Agent完全控制执行流程，包括进度发送、事件监听、结果格式化。
   *
   * @param subAgent  子Agent实例
   * @param prompt    用户prompt
   * @param ctx       工具执行上下文，含 emitProgress 和 getUserMessage 方法
   * @returns         工具返回结果
   */
  execute: (
    subAgent: Agent,
    prompt: string,
    ctx: {
      emitProgress: (data: any) => void;
      getUserMessage: () => { message: string; attachments?: any[] };
    }
  ) => Promise<{ output: string; metadata?: any }>;
}

// ─── createSubAgentTool ────────────────────────────────────────────────────────

/**
 * 创建 `call-sub-agent` 工具。
 *
 * 工具参数：
 *   - prompt  传给子 Agent 的消息
 *   - type    选择哪种子 Agent（enum 由 subAgentConfigs 的 type 字段生成）
 *   - name    本次任务名，不超过 8 个字，用于界面标识
 *
 * description 中会列出所有可用类型及其描述，便于 LLM 按需选择。
 *
 * @param getAgent         懒引用获取父 Agent 实例（避免在 super() 前访问 this）
 * @param subAgentConfigs  子 Agent 配置列表
 */
export function createSubAgentTool(
  getAgent: () => Agent,
  subAgentConfigs: SubAgentConfig[]
): Tool {
  // 拼接 description：列出每种 subAgent 的 type 和 description
  const typeListDesc = subAgentConfigs
    .map((c) => `  - ${c.type}: ${c.description}`)
    .join("\n");

  const description =
    `调用子 Agent 处理特定任务。可用的子 Agent 类型：\n${typeListDesc}`;

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
          enum: subAgentConfigs.map((c) => c.type),
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
    execute: async ({ prompt, type }: { prompt: string; type: string; name: string }, ctx) => {
      const config = subAgentConfigs.find((c) => c.type === type);
      if (!config) {
        return { output: `Error: SubAgent type not found: ${type}` };
      }

      // 检查用户消息是否有图片附件，有则注入 aiRole
      const { attachments } = ctx.getUserMessage();
      const hasImage = attachments?.some((a: any) => a.type === "image");
      const configWithAiRole = hasImage ? { ...config, aiRole: "image" } : config;

      const parentAgent = getAgent();
      const subAgent = parentAgent.createSubAgent(configWithAiRole);

      return config.execute(subAgent, prompt, {
        emitProgress: ctx?.emitProgress ?? (() => {}),
        getUserMessage: ctx.getUserMessage
      });
    },
  };
}
