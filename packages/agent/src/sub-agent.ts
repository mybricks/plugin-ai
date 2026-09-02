import type { Agent } from "./agent";
import type { Message, Tool } from "./types";
import { splitFrontmatter, getFrontmatterString, getFrontmatterStringArray } from "./utils/frontmatter";

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

/**
 * SubAgent 文件条目。
 */
export interface SubAgentFile {
  /** 相对于 subAgent 目录的路径（如 "code-reviewer.md"） */
  path: string;
  /** 文件完整内容 */
  content: string;
}

/**
 * SubAgent 配置。
 *
 * 类比 Claude Code 的 agents/*.md 文件结构：
 *   - `name`  ：唯一标识，同时作为主入口 md 文件名（`${name}.md`）
 *   - `files` ：文件列表，必须包含 `${name}.md`（含 YAML frontmatter + 系统提示词正文）
 *
 * `${name}.md` 支持的 YAML frontmatter 字段：
 *   - name           (必须) — 唯一标识，与 SubAgentConfig.name 一致
 *   - description    (必须) — 功能描述，LLM 据此决定何时调用
 *   - tools          (可选) — 英文逗号分隔的工具名，如 `read_file, bash`；不传则继承父 Agent 所有工具
 *   - disallowedTools(可选) — string[]，要拒绝的工具
 *   - aiRole         (可选) — 指定模型角色
 *   - title          (可选) — UI 显示标题
 *   - skills         (可选) — string[]，在启动时注入完整 skill 内容到子 Agent 上下文
 *
 * md 正文成为子 Agent 的系统提示词（system prompt）。
 *
 * @example
 * {
 *   name: "code-reviewer",
 *   files: [
 *     {
 *       path: "code-reviewer.md",
 *       content: `---
 * name: code-reviewer
 * description: 审查代码质量、安全性和可维护性
 * tools: read_file, grep_search
 * title: 代码审查
 * ---
 *
 * 你是一名资深代码审查专家...`
 *     }
 *   ]
 * }
 */
export interface SubAgentConfig {
  /** 唯一标识，同时作为主入口 md 文件名（`${name}.md`） */
  name: string;
  /** 文件列表，必须包含 path === `${name}.md` 的条目 */
  files: SubAgentFile[];
}

// ─── 解析 ─────────────────────────────────────────────────────────────────────

/**
 * 解析 subAgent 主入口 md 文件，提取 frontmatter 配置和系统提示词正文。
 */
export interface SubAgentMeta {
  /** 来自 frontmatter.name，回退为 SubAgentConfig.name */
  name: string;
  /** 来自 frontmatter.description，LLM 据此决定何时调用 */
  description: string;
  /** 系统提示词（md 正文，去掉 frontmatter 后的内容） */
  system: string;
  /** 工具白名单（名称列表） */
  tools: string[] | null;
  /** 工具黑名单（名称列表） */
  disallowedTools: string[] | null;
  /** 模型角色 */
  aiRole: string | null;
  /** UI 显示标题 */
  title: string | null;
  /** 需要预加载到子 Agent 上下文的 skill 名称列表 */
  skills: string[] | null;
}

/**
 * 解析 SubAgent 主入口 md 文件（`${name}.md`）。
 *
 * @param content      md 文件内容
 * @param fallbackName 回退名称（SubAgentConfig.name）
 */
export function resolveSubAgentMeta(content: string, fallbackName: string): SubAgentMeta {
  const { fmText, body } = splitFrontmatter(content);

  const name = getFrontmatterString(fmText, "name") ?? fallbackName;
  const description =
    getFrontmatterString(fmText, "description") ?? name;
  const aiRole = getFrontmatterString(fmText, "aiRole") ?? getFrontmatterString(fmText, "ai_role");
  const title = getFrontmatterString(fmText, "title");

  const tools = getFrontmatterStringArray(fmText, "tools");
  const disallowedTools = getFrontmatterStringArray(fmText, "disallowedTools") ??
    getFrontmatterStringArray(fmText, "disallowed_tools");
  const skills = getFrontmatterStringArray(fmText, "skills");

  return { name, description, system: body, tools, disallowedTools, aiRole, title, skills };
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
  // 预解析所有 meta（避免每次调用都重新解析）
  const metaMap = new Map<string, SubAgentMeta>();
  for (const config of subAgentConfigs) {
    const mainFile = config.files.find((f) => f.path === `${config.name}.md`);
    if (!mainFile) continue;
    const meta = resolveSubAgentMeta(mainFile.content, config.name);
    metaMap.set(config.name, meta);
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
      const meta = metaMap.get(type);
      if (!meta) {
        return { output: `Error: SubAgent type not found: ${type}` };
      }

      // 检查用户消息是否有图片附件，优先以附件决定 aiRole
      const { attachments } = ctx.getUserMessage();
      const hasImage = attachments?.some((a: any) => a.type === "image");
      const aiRole = hasImage ? "image" : (meta.aiRole ?? undefined);

      const parentAgent = getAgent();

      // 构建工具列表（按 tools 白名单 / disallowedTools 黑名单过滤父 Agent 工具）
      let subAgentTools: Tool[] | undefined;
      const parentTools: Tool[] = (parentAgent as any).options?.tools ?? [];

      if (meta.tools) {
        // 白名单模式：只允许指定工具
        subAgentTools = parentTools.filter((t) => meta.tools!.includes(t.name));
      } else if (meta.disallowedTools) {
        // 黑名单模式：继承全部，排除指定工具（同时排除 call-sub-agent 自身）
        const denied = new Set([...meta.disallowedTools, CALL_SUB_AGENT_TOOL_NAME]);
        subAgentTools = parentTools.filter((t) => !denied.has(t.name));
      }
      // 若两者都未指定，subAgentTools 为 undefined，createSubAgent 会继承父 Agent 工具（自动过滤 call-sub-agent）

      // 构建系统提示词：正文 + 预加载 skills 内容
      let system = meta.system || undefined;

      if (meta.skills?.length && resolvedSkills?.length) {
        const skillContents: string[] = [];
        for (const skillName of meta.skills) {
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

      const subAgent = parentAgent.createSubAgent({ system, tools: subAgentTools, aiRole });
      const agentKey = subAgent.key;
      if (!agentKey) return { output: "Error: SubAgent 未分配 agentKey。" };

      const run = async (): Promise<CompletedSubAgentTask> => {
        let lastProgressAt = 0;
        const unsubscribe = subAgent.events.on("llm:content", ({ content, thinkingContent }) => {
          const now = Date.now();
          if (now - lastProgressAt < 250) return;
          lastProgressAt = now;
          ctx?.emitProgress({
            status: "running",
            agentKey,
            subAgentType: type,
            title: meta.title ?? undefined,
            content: content ?? "",
            ...(thinkingContent !== undefined ? { thinkingContent } : {}),
          });
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
          return { agentKey, type, title: meta.title ?? undefined, status, output: output || "(SubAgent 未产生输出)" };
        } catch (error) {
          return {
            agentKey,
            type,
            title: meta.title ?? undefined,
            status: "error",
            output: `SubAgent 执行失败: ${String((error as Error)?.message ?? error)}`,
          };
        } finally {
          unsubscribe();
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
          ctx?.emitProgress({ status: task.status, agentKey, subAgentType: type, title: meta.title ?? undefined, output: task.output });
        });
        return {
          output: `SubAgent 已异步启动（agentKey: ${agentKey}）。仅当父 Agent 仍在执行时，完成结果才会自动在下一次模型请求前送达。`,
          metadata: { subAgentType: type, title: meta.title ?? undefined, agentKey, status: "running", async: true },
        };
      }

      const task = await run();
      return {
        output: task.output,
        metadata: { subAgentType: type, title: meta.title ?? undefined, agentKey, status: task.status, async: false },
      };
    },
  };
}
