import type { Agent } from "./agent";
import type { Message, Tool } from "./types";

// TODO: 将 SubAgent 迁移为 CodeAgent 的内置运行时插件。
// 这样任务队列、beforeRequest 回传与动态工具创建都由插件自身管理，避免 CodeAgent 了解 SubAgent 细节。
// 依赖后续扩展插件生命周期：在 CodeAgent 实例创建后 setup，并支持按当前资源动态提供 tools / hooks。

/** 与 `createSubAgentTool` 注册的 `name` 一致，供 UI 等侧注册渲染器使用 */
export const CALL_SUB_AGENT_TOOL_NAME = "call-sub-agent";

/** 异步 SubAgent 在下一次模型请求前投递给父 Agent 的最终结果。 */
export interface CompletedSubAgentTask {
  /** ForkAgent 在 createFork 时分配的唯一 key。 */
  agentKey: string;
  type: string;
  title?: string;
  status: "success" | "error" | "aborted";
  output: string;
}

/**
 * CodeAgent 实例级的异步 SubAgent 任务队列。
 *
 * 当前 Agent 的 tool result 已经提交后，不能再向同一个 function-call 回写最终输出；
 * 因此完成结果会留在这里，并由父 Agent 的 beforeRequest hook 注入下一次 LLM 请求。
 */
export class SubAgentTaskManager {
  private completed: CompletedSubAgentTask[] = [];

  complete(task: CompletedSubAgentTask): void {
    this.completed.push(task);
  }

  /** 父 turn 已结束且结果尚未注入时，丢弃该异步任务的待回传结果。 */
  discard(agentKey: string): void {
    this.completed = this.completed.filter((task) => task.agentKey !== agentKey);
  }

  takeCompletedMessages(): Message[] {
    const tasks = this.completed.splice(0);
    return tasks.map((task) => ({
      role: "user",
      content: [
        `<agent-results agent-key="${task.agentKey}" type="${task.type}" status="${task.status}">`,
        task.output || "(SubAgent 未产生输出)",
        "</agent-results>",
      ].join("\n"),
    }));
  }
}

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
 *   - async   `false`（默认）等待最终结果；`true` 立即返回 agentKey。结果只会回传给仍在执行中的父 turn
 *
 * description 中会列出所有可用类型及其描述，便于 LLM 按需选择。
 *
 * @param getAgent         懒引用获取父 Agent 实例（避免在 super() 前访问 this）
 * @param subAgentConfigs  子 Agent 配置列表
 * @param resolvedSkills   已解析的 skill 文件列表（用于 skills 预加载）
 * @param taskManager      实例级异步任务队列；不传时仍可使用同步模式
 */
export function createSubAgentTool(
  getAgent: () => Agent,
  subAgentConfigs: SubAgentConfig[],
  resolvedSkills?: import("./code-agent/skills").SkillFile[],
  taskManager?: SubAgentTaskManager,
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
        async: {
          type: "boolean",
          default: false,
          description: "是否异步执行。false（默认）等待最终结果；true 立即返回 agentKey，完成结果会自动在下一次模型请求前送达",
        },
      },
      required: ["prompt", "type", "name"],
    },
    execute: async (
      { prompt, type, async: runAsync = false }: { prompt: string; type: string; name: string; async?: boolean },
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

      if (runAsync && !taskManager) {
        return { output: "Error: 当前 Agent 未配置异步 SubAgent 任务队列。" };
      }

      const subAgent = parentAgent.createSubAgent({
        system,
        tools: subAgentTools,
        aiRole,
      });
      const agentKey = subAgent.key;
      if (!agentKey) return { output: "Error: SubAgent 未分配 agentKey。" };
      const subAgentToolCalls = new Map<string, {
        callId: string;
        name: string;
        title?: string;
        status: "running" | "success" | "error";
      }>();
      let latestContent = "";
      let latestThinkingContent: string | undefined;
      const getSubAgentToolCalls = () => [...subAgentToolCalls.values()];
      const getSubAgentToolMetadata = () => ({ subAgentToolCalls: getSubAgentToolCalls() });
      const appendToolCallSummary = (output: string) => {
        const calls = getSubAgentToolCalls();
        const summary = calls.length === 0
          ? "工具调用总结：未调用工具。"
          : (() => {
              const counts = new Map<string, { name: string; title?: string; count: number }>();
              for (const toolCall of calls) {
                const current = counts.get(toolCall.name);
                if (current) current.count += 1;
                else counts.set(toolCall.name, { name: toolCall.name, title: toolCall.title, count: 1 });
              }
              const details = [...counts.values()]
                .map(({ name, title, count }) => `${title ? `${title}（${name}）` : name} × ${count}`)
                .join("、");
              return `工具调用总结：共调用 ${calls.length} 次：${details}。`;
            })();
        return output ? `${output}\n\n${summary}` : summary;
      };
      const emitSubAgentProgress = (data: Record<string, unknown> = {}) => {
        ctx?.emitProgress({
          status: "running",
          agentKey,
          subAgentType: type,
          title: config.title,
          ...getSubAgentToolMetadata(),
          content: latestContent,
          ...(latestThinkingContent !== undefined ? { thinkingContent: latestThinkingContent } : {}),
          ...data,
        });
      };
      emitSubAgentProgress();

      const run = async (): Promise<CompletedSubAgentTask> => {
        let lastProgressAt = 0;
        const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
          const now = Date.now();
          latestContent = content ?? "";
          latestThinkingContent = thinkingContent;
          if (now - lastProgressAt < 250) return;
          lastProgressAt = now;
          emitSubAgentProgress();
        });
        const unsubscribeToolCall = subAgent.events.on("tool:call", ({ callId, name, title }) => {
          subAgentToolCalls.set(callId, {
            callId,
            name,
            ...(title ? { title } : {}),
            status: "running",
          });
          emitSubAgentProgress();
        });
        const unsubscribeToolResult = subAgent.events.on("tool:result", ({ callId, name, title }) => {
          const previous = subAgentToolCalls.get(callId);
          subAgentToolCalls.set(callId, {
            ...previous,
            callId,
            name,
            ...(title ? { title } : {}),
            status: "success",
          });
          emitSubAgentProgress();
        });
        const unsubscribeToolError = subAgent.events.on("tool:error", ({ callId, name, title }) => {
          const previous = subAgentToolCalls.get(callId);
          subAgentToolCalls.set(callId, {
            ...previous,
            callId,
            name,
            ...(title ? { title } : {}),
            status: "error",
          });
          emitSubAgentProgress();
        });
        const abort = () => subAgent.abort();
        ctx?.signal?.addEventListener("abort", abort, { once: true });

        try {
          await subAgent.requestAI({ message: prompt });
          const turns = await subAgent.getTurns();
          const lastTurn = turns[turns.length - 1];
          const lastLLMIter = lastTurn?.iterations?.slice().reverse().find((iter) => !("type" in iter));
          const output = (lastLLMIter as any)?.content ?? "";
          const status = lastTurn?.status === "abort" ? "aborted" : lastTurn?.status === "error" ? "error" : "success";
          return {
            agentKey,
            type,
            title: config.title,
            status,
            output: appendToolCallSummary(output || "(SubAgent 未产生输出)"),
          };
        } catch (error) {
          return {
            agentKey,
            type,
            title: config.title,
            status: "error",
            output: appendToolCallSummary(`SubAgent 执行失败: ${String((error as Error)?.message ?? error)}`),
          };
        } finally {
          unsubscribe();
          unsubscribeToolCall();
          unsubscribeToolResult();
          unsubscribeToolError();
          ctx?.signal?.removeEventListener("abort", abort);
        }
      };

      if (runAsync) {
        let parentTurnEnded = false;
        const stopParentTurnListeners = () => {
          offParentComplete();
          offParentAbort();
          offParentError();
        };
        const onParentTurnEnd = () => {
          parentTurnEnded = true;
          taskManager!.discard(agentKey);
          stopParentTurnListeners();
        };
        const offParentComplete = parentAgent.events.on("turn:complete", onParentTurnEnd);
        const offParentAbort = parentAgent.events.on("turn:abort", onParentTurnEnd);
        const offParentError = parentAgent.events.on("turn:error", onParentTurnEnd);
        void run().then((task) => {
          // 父 Agent 已结束时，子任务可自行收尾，但不再写回下一轮对话。
          if (parentTurnEnded) return;
          taskManager!.complete(task);
          ctx?.emitProgress({
            status: task.status,
            agentKey,
            subAgentType: type,
            title: config.title,
            ...getSubAgentToolMetadata(),
            output: task.output,
          });
        });
        return {
          output: `SubAgent 已异步启动（agentKey: ${agentKey}）。仅当父 Agent 仍在执行时，完成结果才会自动在下一次模型请求前送达。`,
          metadata: {
            subAgentType: type,
            title: config.title,
            agentKey,
            status: "running",
            async: true,
            ...getSubAgentToolMetadata(),
          },
        };
      }

      const task = await run();
      return {
        output: task.output,
        metadata: {
          subAgentType: type,
          title: config.title,
          agentKey,
          status: task.status,
          async: false,
          ...getSubAgentToolMetadata(),
        },
      };
    },
  };
}
