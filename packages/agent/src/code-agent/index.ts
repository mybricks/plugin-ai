import { Agent, type AgentOptions } from "../agent";
import type { Message, Tool } from "../types";
import {
  createReadTool, READ_TOOL_NAME,
  createWriteTool, WRITE_TOOL_NAME,
  createMultiWriteTool, MULTI_WRITE_TOOL_NAME,
  createEditTool, EDIT_TOOL_NAME,
  createMultiEditTool, MULTI_EDIT_TOOL_NAME,
  createDeleteTool, DELETE_TOOL_NAME,
  createGrepTool,
  createGlobTool,
  createSkillTool, USE_SKILL_TOOL_NAME,
} from "./tools";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
export type { CodeAgentPromptOptions };
import { type SkillFile, resolveSkillMeta } from "./skills";
import { createSubAgentTool, type SubAgentConfig, CALL_SUB_AGENT_TOOL_NAME } from "../sub-agent";
export type { SubAgentConfig };

export type { SkillFile };
export { resolveSkillMeta, USE_SKILL_TOOL_NAME };

// ─── Plugin 配置 ─────────────────────────────────────────────────────────────

/**
 * CodeAgent 插件配置。
 *
 * 对标 Claude Code plugin 的组件聚合语义：
 *   - skills 使用现有 SkillFile 声明
 *   - agents 使用现有 SubAgentConfig 声明，并合并到顶层 subAgents
 *   - tools 使用现有 Tool 声明，并合并到顶层 tools
 */
export interface CodeAgentPlugin {
  /** 插件名称，仅用于调用侧标识；CodeAgent 不额外命名空间化组件 */
  name?: string;
  /** 插件内置 Skills，合并到顶层 skills */
  skills?: SkillFile[];
  /** 插件内置 Agents，合并到顶层 subAgents */
  agents?: SubAgentConfig[];
  /** 插件内置工具，合并到顶层 tools */
  tools?: Tool[];
}

// ─── 沙箱接口 ─────────────────────────────────────────────────────────────────

/**
 * 沙箱接口，由调用方通过 window._registSandBox_ 注入。
 * CodeAgent 通过此接口操作文件系统（读取、写入文件）。
 * 额外的设计器状态、日志等能力通过 tools 参数注入，CodeAgent 本身不感知。
 */
export interface Sandbox {
  getFiles(): Promise<Array<{ path: string; content: string }>>;
  /**
   * 写入文件。失败时 reject（抛出错误）。
   */
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 删除文件。失败时 reject（抛出错误）。
   */
  deleteFiles(paths: string[]): Promise<void>;
  /**
   * 获取当前动态上下文信息（代码规则、主题等项目信息）。
   * 返回的文本内容会通过 getContextMessages 注入到 LLM 上下文中。
   */
  getContext?: () => Promise<string | null>;
  /**
   * @experimental
   * 获取用户自定义上下文信息。
   * 返回的文本内容会通过 getUserContextMessages 注入到 LLM 上下文中，
   * 放置在用户消息之前。
   * - 返回字符串：构造为一条 user 消息注入。
   * - 返回字符串数组：每个元素构造为一条独立的 user 消息注入。
   */
  getUserContext?: () => Promise<string | string[] | null>;
}

// ─── CodeAgentOptions ────────────────────────────────────────────────────────

export interface CodeAgentOptions extends Omit<AgentOptions, 'system'> {
  /**
   * 沙箱，提供文件读写工具的底层实现。
   * 通常由 plugin 侧通过 window._registSandBox_ 注入。
   */
  sandbox?: Sandbox;
  /**
   * 系统提示词定制选项（可覆盖内置默认值）。
   */
  promptOptions?: CodeAgentPromptOptions;
  /**
   * 技能文件列表（Skills）。
   *
   * 对标 claude-code 的 .claude/skills/ 目录机制：
   *   - 每个 SkillFile.name 作为虚拟目录名（.agent/skills/<name>/）
   *   - SKILL.md 为必填入口文件
   *   - 技能目录（name + description）列出在环境消息中，随每轮 user 消息注入
   *   - LLM 通过 use_skill 工具按需加载 SKILL.md 内容
   *   - 支持文件可通过 read_file 工具读取（.agent/skills/<name>/<path>）
   *   - 不全量注入，避免 token 浪费
   */
  skills?: SkillFile[];
  /**
   * 追加到内置 system prompt 末尾的额外系统提示词。
   * 可用于注入项目特定规范、约束或上下文。
   */
  system?: string;
  /**
   * 子 Agent 配置列表。
   * 配置后会自动注册一个 `call-sub-agent` 工具，LLM 可通过工具调用来发起子 Agent 任务。
   * 不传或传空数组时不注册该工具。
   */
  subAgents?: SubAgentConfig[];
  /**
   * 插件配置列表。
   *
   * 构造时会将每个 plugin 的 skills / agents / tools 追加到顶层
   * skills / subAgents / tools 中，后续虚拟文件、环境信息和工具注册逻辑保持一致。
   */
  plugins?: CodeAgentPlugin[];
}

/** 虚拟 agent 资源路径前缀 */
const AGENT_PREFIX = ".agent/";
/** 虚拟 skills 路径前缀 */
const SKILLS_PREFIX = `${AGENT_PREFIX}skills/`;

// ─── 构建环境信息 ──────────────────────────────────────────────────────────────

/**
 * 构建环境信息文本（静态，随每轮 user 消息注入到最上方）。
 *
 * 包含 skills 目录信息和可用 sub-agents 类型信息，
 * 用 <system-reminder>环境信息</system-reminder> 包裹，返回字符串。
 * 如果无任何内容则返回空字符串。
 */
function buildEnvironmentSection(skills?: SkillFile[], subAgents?: SubAgentConfig[]): string {
  const sections: string[] = [];

  // ── 当前日期 ──────────────────────────────────────────────────────────────
  const now = new Date();
  const dateStr = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  sections.push(`当前日期：${dateStr}`);

  // ── Skills 目录 ───────────────────────────────────────────────────────────
  if (skills?.length) {
    const lines = skills.map((s) => {
      const skillMd = s.files.find((f) => f.path === "SKILL.md");
      if (!skillMd) return `  ${s.name}`;
      const { description, whenToUse } = resolveSkillMeta(skillMd.content, s.name);
      let line = `  ${s.name}: ${description}`;
      if (whenToUse) line += `（适用场景：${whenToUse}）`;
      return line;
    });

    sections.push(
      `可用 Skill（当任务涉及相关场景时，使用 ${USE_SKILL_TOOL_NAME} 工具调用指定 Skill 获取完整指导）：\n` +
      `${lines.join("\n")}\n` +
      `注意：When a skill matches the user's request, this is a BLOCKING REQUIREMENT. NEVER mention a skill without actually calling this tool.`
    );
  }

  // ── SubAgent 目录 ─────────────────────────────────────────────────────────
  if (subAgents?.length) {
    const lines = subAgents.map((c) => `  ${c.type}: ${c.description}`).join("\n");
    sections.push(
      `可用 SubAgent（需要时使用 ${CALL_SUB_AGENT_TOOL_NAME} 工具发起调用）：\n` +
      `${lines}`
    );
  }

  if (sections.length === 0) return "";

  return (
    `<system-reminder>\n` +
    `${sections.join("\n\n")}\n` +
    `</system-reminder>`
  );
}

// ─── CodeAgent ────────────────────────────────────────────────────────────────

/**
 * CodeAgent：面向代码编辑场景的 Agent。
 *
 * 内置原子级文件操作工具（read_file / write_file / edit_file），通过 Sandbox 接口
 * 连接任意文件系统/编译系统/运行系统。
 *
 * 额外能力（如 check_design_status）通过 `tools` 参数从外部注入，
 * CodeAgent 本身不感知 project / hooks 等具体概念。
 *
 * plugin 初始化时可传入：
 *   - `sandbox`   — 沙箱（文件读写）
 *   - `tools`     — 额外自定义工具（如 check_design_status）
 *   - `agentsMd`  — agents.md 规则文档，追加到系统 prompt 末尾
 *   - `skills`    — 技能文件列表，挂载为虚拟文件系统，LLM 按需读取
 *   - `subAgents` — 子 Agent 配置列表，注册 call-sub-agent 工具
 */
export class CodeAgent extends Agent {
  constructor(options: CodeAgentOptions) {
    const { sandbox, skills, system, subAgents, plugins, ...agentOptions } = options;
    const pluginSkills = plugins?.flatMap((plugin) => plugin.skills ?? []) ?? [];
    const pluginSubAgents = plugins?.flatMap((plugin) => plugin.agents ?? []) ?? [];
    const pluginTools = plugins?.flatMap((plugin) => plugin.tools ?? []) ?? [];

    const resolvedSkills = [...(skills ?? []), ...pluginSkills];
    const resolvedSubAgents = [...(subAgents ?? []), ...pluginSubAgents];
    const resolvedTools = [...(agentOptions.tools ?? []), ...pluginTools];

    // ── 包装 sandbox.getFiles()，追加 skills 虚拟文件 ─────────────────────────
    const wrappedSandbox: Sandbox | undefined = sandbox
      ? {
          getFiles: async () => {
            const realFiles = await sandbox.getFiles();
            const skillFiles = resolvedSkills.flatMap((s) =>
              s.files.map((f) => ({
                path: `${SKILLS_PREFIX}${s.name}/${f.path}`,
                content: f.content,
              }))
            );
            return [...realFiles, ...skillFiles];
          },
          updateFiles: sandbox.updateFiles.bind(sandbox),
          deleteFiles: sandbox.deleteFiles.bind(sandbox),
          ...(sandbox.getContext ? { getContext: sandbox.getContext.bind(sandbox) } : {}),
          ...(sandbox.getUserContext ? { getUserContext: sandbox.getUserContext.bind(sandbox) } : {}),
        }
      : undefined;

    const sandboxTools: Tool[] = wrappedSandbox
      ? [createReadTool(wrappedSandbox), createWriteTool(wrappedSandbox), createEditTool(wrappedSandbox), createMultiEditTool(wrappedSandbox), createDeleteTool(wrappedSandbox), createGrepTool(wrappedSandbox)]
      : [];

    // ── sandbox.getContext 作为 getContextMessages ────────────────────────────
    const getContextMessages = async (): Promise<Message[]> => {
      const ctx = await wrappedSandbox?.getContext?.() ?? null;
      if (!ctx) return [];
      return [{ role: "user", content: ctx }];
    };

    // ── sandbox.getUserContext 作为 getUserContextMessages（@experimental）────
    const getUserContextMessages = async (): Promise<Message[]> => {
      const uc = await wrappedSandbox?.getUserContext?.() ?? null;
      if (!uc) return [];
      if (Array.isArray(uc)) {
        return uc.map(text => ({ role: "user", content: text }));
      }
      return [{ role: "user", content: uc }];
    };

    // ── 构建环境信息（skills 目录 + sub-agents 目录），静态注入 ─────────────────
    const environmentSection = buildEnvironmentSection(
      resolvedSkills.length ? resolvedSkills : undefined,
      resolvedSubAgents.length ? resolvedSubAgents : undefined,
    );

    const builtinSystem = getCodeAgentSystemPrompt(agentOptions.promptOptions);
    const finalSystem = system ? `${builtinSystem}\n\n${system}` : builtinSystem;

    super({
      ...agentOptions,
      system: finalSystem,
      getContextMessages,
      getUserContextMessages,
      environmentSection,
      // 内置沙箱工具在前，外部注入工具（如 check_design_status）在后
      tools: [...sandboxTools, ...resolvedTools],
    });

    // ── 注册 use_skill 工具（需要 skills 列表，在 super() 之后处理）───────────────
    if (resolvedSkills.length) {
      const skillTool = createSkillTool(resolvedSkills);
      this.options.tools = [...(this.options.tools ?? []), skillTool];
    }

    // ── 注册 call-sub-agent 工具（需要 this，在 super() 之后处理）─────────────────
    // 用懒引用 () => this 避免在 super() 前访问 this
    if (resolvedSubAgents.length) {
      const subAgentTool = createSubAgentTool(() => this, resolvedSubAgents);
      this.options.tools = [...(this.options.tools ?? []), subAgentTool];
    }
  }
}
