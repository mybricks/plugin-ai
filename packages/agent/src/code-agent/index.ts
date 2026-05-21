import { Agent, type AgentOptions } from "../agent";
import type { Message, Tool } from "../types";
import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createMultiEditTool,
  createDeleteTool,
  createGrepTool,
  createSkillTool,
  USE_SKILL_TOOL_NAME,
} from "./tools";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
export type { CodeAgentPromptOptions };
import { type SkillFile, resolveSkillMeta } from "./skills";
import {
  createSubAgentTool,
  resolveSubAgentMeta,
  type SubAgentConfig,
  CALL_SUB_AGENT_TOOL_NAME,
} from "../sub-agent";
export type { SubAgentConfig };

export type { SkillFile };
export { resolveSkillMeta, USE_SKILL_TOOL_NAME };

// ─── Plugin 配置 ─────────────────────────────────────────────────────────────

/**
 * CodeAgent 插件挂载的额外目录。
 *
 * 目录通过虚拟路径前缀暴露给 CodeAgent 的文件工具；读写删除仍由宿主侧
 * sandbox 适配层路由到对应 API。
 */
export interface AdditionalDirectory {
  /**
   * 虚拟路径前缀，末尾必须带斜杠，例如 ".specs/" 或 "knowledge/"。
   * 所有 path.startsWith(dir.path) 的文件操作都会路由到此目录。
   */
  path: string;
  /**
   * 该扩展目录对应的 agents.md 内容（项目规范/约束），由宿主直接传入。
   *
   * 支持 YAML frontmatter，框架会从中解析目录元信息注入到 getUserContext：
   * ```yaml
   * ---
   * title: 设计规范
   * description: 产品设计规范文档，包含组件设计准则
   * permissions: read, write
   * ---
   * （可选：正文为 agents.md 规则内容，会注入到 LLM 上下文）
   * ```
   * - `title`/`description`：展示在每轮 getUserContext 中，让 LLM 了解目录用途
   * - `permissions`：逗号分隔，可选值 `read`/`write`/`bash`；仅作提示约束，
   *   实际能力边界由 updateFiles/deleteFiles 回调是否存在决定
   */
  agentsMd?: string;
  /** 读取该目录下的文件列表 */
  getFiles: () => Promise<Array<{ path: string; content: string }>>;
  /**
   * 写入文件（可选）。
   * 不传则视为只读目录，LLM 尝试写入时框架抛出错误。
   */
  updateFiles?: (files: Array<{ path: string; content: string }>) => Promise<void>;
  /**
   * 删除文件（可选）。
   * 不传则视为不支持删除，操作时框架抛出错误。
   */
  deleteFiles?: (paths: string[]) => Promise<void>;
}

/**
 * CodeAgent 插件配置。
 *
 * 对标 Claude Code plugin 的组件聚合语义：
 *   - skills 使用 SkillFile 声明
 *   - agents 使用 SubAgentConfig 声明（md 文件驱动），合并到顶层 subAgents
 *   - tools 使用 Tool 声明，并合并到顶层 tools
 *   - additionalDirectories 使用 AdditionalDirectory 声明，挂载额外文件目录
 *
 * name 命名规范：
 *   - 仅允许小写英文字母、数字、中划线、下划线
 *   - 格式：[a-z0-9][a-z0-9_-]*（参考 npm 包名 / 文件夹名规范）
 *   - 示例：my-plugin、code_review、mybricks-spec
 *   - 格式不符时：运行时 console.warn 提示，不阻断执行
 */
export interface CodeAgentPlugin {
  /**
   * 插件唯一标识（必填）。
   * 用作 enablePlugin / disablePlugin 的查找键，以及工具命名空间前缀。
   * 命名规范：[a-z0-9][a-z0-9_-]*
   */
  name: string;
  /** 插件版本号（可选，展示用） */
  version?: string;
  /** 插件描述（可选，展示/调试用） */
  description?: string;
  /** 项目级规则 */
  agentsMd?: never;
  /**
   * 初始启用状态，默认 true（全部启用）。
   * 设为 false 可让插件以禁用状态注册，需调用 enablePlugin(name) 后才会在 turn 中生效。
   */
  enabled?: boolean;
  /** 插件内置 Skills，合并到顶层 skills */
  skills?: SkillFile[];
  /**
   * 插件内置 SubAgents，合并到顶层 subAgents。
   * 每个 SubAgentConfig 通过 `${name}.md` 文件定义配置和系统提示词。
   */
  agents?: SubAgentConfig[];
  /** 插件内置工具，合并到顶层 tools（工具名自动加 pluginName_ 前缀） */
  tools?: Tool[];
  /**
   * 插件额外挂载目录（异步工厂函数）。
   * 仅在插件启用时参与文件读取、写入、删除和 user context 注入。
   *
   * 每个 turn 开始时调用，可根据运行时状态动态决定挂载哪些目录。
   * 返回空数组表示本轮不挂载任何额外目录。
   */
  additionalDirectories?: () => Promise<AdditionalDirectory[]>;
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

export interface CodeAgentOptions extends Omit<AgentOptions, "system"> {
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
   * 每个插件的 skills / agents / tools 会在每次 turn 开始时，根据当前启用状态
   * 动态合并到顶层 skills / subAgents / tools 中，而非构造期固化。
   *
   * 插件启用状态通过 enablePlugin / disablePlugin 控制，初始状态由 plugin.enabled 字段决定（默认 true）。
   */
  plugins?: CodeAgentPlugin[];
}

/** 虚拟 agent 资源路径前缀 */
const AGENT_PREFIX = ".agent/";
/** 虚拟 skills 路径前缀 */
const SKILLS_PREFIX = `${AGENT_PREFIX}skills/`;

/** 插件 name 命名规范校验 */
const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function prefixPluginToolName(pluginName: string, tool: Tool): Tool {
  return {
    ...tool,
    name: `${pluginName}_${tool.name}`,
  };
}

// ─── 构建环境信息 ──────────────────────────────────────────────────────────────

/**
 * 构建环境信息文本（每次 turn 开始时动态求值）。
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
    const lines = subAgents
      .map((c) => {
        const mainFile = c.files.find((f) => f.path === `${c.name}.md`);
        if (!mainFile) return `  ${c.name}`;
        const { description } = resolveSubAgentMeta(mainFile.content, c.name);
        return `  ${c.name}: ${description}`;
      })
      .join("\n");

    sections.push(
      `可用 SubAgent（需要时使用 ${CALL_SUB_AGENT_TOOL_NAME} 工具发起调用）：\n` +
        `${lines}`
    );
  }

  if (sections.length === 0) return "";

  return `<system-reminder>\n${sections.join("\n\n")}\n</system-reminder>`;
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
 * 初始化时可传入：
 *   - `sandbox`   — 沙箱（文件读写）
 *   - `tools`     — 额外自定义工具（如 check_design_status）
 *   - `agentsMd`  — 项目级 agents.md 规则文档，由基础 Agent 作为独立 user context 注入
 *   - `skills`    — 技能文件列表，挂载为虚拟文件系统，LLM 按需读取
 *   - `subAgents` — 子 Agent 配置列表，注册 call-sub-agent 工具
 *   - `plugins`   — 插件列表（仅支持 skills / agents / tools / additionalDirectories）
 */
export class CodeAgent extends Agent {
  /** 全量插件列表（构造时传入，不变） */
  private _plugins: CodeAgentPlugin[];
  /**
   * 当前已启用的插件名集合。
   * 由 plugin.enabled 字段（默认 true）初始化。
   * enablePlugin / disablePlugin 调用时即时更新，下一个 turn 生效。
   */
  private _enabledPluginNames: Set<string>;
  /**
   * 顶层基础资源（来自 options.skills / options.subAgents / options.tools，不含 plugin 部分）。
   * 不参与动态重算，始终全量参与每次 turn 的资源合并。
   */
  private _base: { skills: SkillFile[]; subAgents: SubAgentConfig[]; tools: Tool[] };

  constructor(options: CodeAgentOptions) {
    const {
      sandbox,
      skills,
      system,
      subAgents,
      plugins = [],
      ...agentOptions
    } = options;

    for (const plugin of plugins) {
      if (!PLUGIN_NAME_PATTERN.test(plugin.name)) {
        console.warn(
          `[CodeAgent] Plugin name "${plugin.name}" 不符合命名规范 [a-z0-9][a-z0-9_-]*，` +
            `建议使用小写英文字母、数字、中划线或下划线，且以字母或数字开头。`
        );
      }
    }

    const baseSkills = skills ?? [];
    const baseSubAgents = subAgents ?? [];
    const baseUserTools = agentOptions.tools ?? [];

    // super() 调用前 this 不可用，先用 enabledNamesRef 供 wrappedSandbox 闭包读取。
    // super() 之后再把它同步到真实的 this._enabledPluginNames 引用。
    const enabledNamesRef = { current: new Set<string>() };

    const wrappedSandbox: Sandbox | undefined = sandbox
      ? {
          getFiles: async () => {
            const realFiles = await sandbox.getFiles();
            const enabledPluginSkills = plugins
              .filter((p) => enabledNamesRef.current.has(p.name))
              .flatMap((p) => p.skills ?? []);
            const allSkills = [...baseSkills, ...enabledPluginSkills];
            const skillFiles = allSkills.flatMap((s) =>
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
      ? [
          createReadTool(wrappedSandbox),
          createWriteTool(wrappedSandbox),
          createEditTool(wrappedSandbox),
          createMultiEditTool(wrappedSandbox),
          createDeleteTool(wrappedSandbox),
          createGrepTool(wrappedSandbox),
        ]
      : [];

    // ── sandbox.getContext 作为 getContextMessages ────────────────────────────
      const base = {
      skills: baseSkills,
      subAgents: baseSubAgents,
      tools: [...sandboxTools, ...baseUserTools],
    };

    const getContextMessages = async (): Promise<Message[]> => {
      const ctx = (await wrappedSandbox?.getContext?.()) ?? null;
      if (!ctx) return [];
      return [{ role: "user", content: ctx }];
    };

    // ── sandbox.getUserContext 作为 getUserContextMessages（@experimental）────
    const getUserContextMessages = async (): Promise<Message[]> => {
      const uc = (await wrappedSandbox?.getUserContext?.()) ?? null;
      if (!uc) return [];
      if (Array.isArray(uc)) {
        return uc.map((text) => ({ role: "user", content: text }));
      }
      return [{ role: "user", content: uc }];
    };

    const builtinSystem = getCodeAgentSystemPrompt(agentOptions.promptOptions);
    const finalSystem = system ? `${builtinSystem}\n\n${system}` : builtinSystem;

    super({
      ...agentOptions,
      system: finalSystem,
      getContextMessages,
      getUserContextMessages,
      environmentSection: () => {
        const { skills, subAgents } = this._getEnabledResources();
        return buildEnvironmentSection(
          skills.length ? skills : undefined,
          subAgents.length ? subAgents : undefined,
        );
      },
      tools: base.tools,
    });

    this._plugins = plugins;
    this._base = base;
    this._enabledPluginNames = new Set(
      plugins.filter((p) => p.enabled !== false).map((p) => p.name)
    );

    enabledNamesRef.current = this._enabledPluginNames;

    this._rebuildDynamicTools();
  }

  private _getEnabledResources(): {
    skills: SkillFile[];
    subAgents: SubAgentConfig[];
    tools: Tool[];
  } {
    const enabledPlugins = this._plugins.filter((p) =>
      this._enabledPluginNames.has(p.name)
    );

    const skills = [
      ...this._base.skills,
      ...enabledPlugins.flatMap((p) => p.skills ?? []),
    ];
    const subAgents = [
      ...this._base.subAgents,
      ...enabledPlugins.flatMap((p) => p.agents ?? []),
    ];
    const pluginTools = enabledPlugins.flatMap((p) =>
      (p.tools ?? []).map((t) => prefixPluginToolName(p.name, t))
    );
    const tools = [...this._base.tools, ...pluginTools];

    return { skills, subAgents, tools };
  }

  /**
   * 根据当前启用插件状态，重建 use_skill、call-sub-agent 工具以及 plugin tools。
   * 每次 requestAI 前调用，确保工具列表与启用状态一致。
   */
  private _rebuildDynamicTools(): void {
    const { skills, subAgents, tools } = this._getEnabledResources();

    const skillTool = skills.length ? createSkillTool(skills) : null;
    const subAgentTool = subAgents.length
      ? createSubAgentTool(
          () => this,
          subAgents,
          skills.length ? skills : undefined,
        )
      : null;

    this.options.tools = [
      ...tools,
      ...(skillTool ? [skillTool] : []),
      ...(subAgentTool ? [subAgentTool] : []),
    ];
  }

  override async requestAI(params: Parameters<Agent["requestAI"]>[0]): Promise<void> {
    this._rebuildDynamicTools();
    return super.requestAI(params);
  }

  /**
   * 启用指定插件（仅影响当前实例）。
   * 下一个 turn 开始时生效（skills / tools / agents 会重新合并）。
   */
  enablePlugin(name: string): void {
    this._enabledPluginNames.add(name);
  }

  /**
   * 禁用指定插件（仅影响当前实例）。
   * 下一个 turn 开始时生效（skills / tools / agents 会重新合并）。
   */
  disablePlugin(name: string): void {
    this._enabledPluginNames.delete(name);
  }

  /**
   * 获取当前已启用的插件列表（快照，不影响内部状态）。
   */
  getEnabledPlugins(): CodeAgentPlugin[] {
    return this._plugins.filter((p) => this._enabledPluginNames.has(p.name));
  }
}
