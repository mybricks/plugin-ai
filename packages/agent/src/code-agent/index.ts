import { Agent, type AgentHooks, type AgentOptions } from "../agent";
import type { Message, Tool } from "../types";
import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createMultiEditTool,
  createDeleteTool,
  createGrepTool,
  createBashTool,
  createHistoryReadTool,
  createSkillTool,
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  EDIT_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  DELETE_TOOL_NAME,
  GREP_TOOL_NAME,
  BASH_TOOL_NAME,
  HISTORY_READ_TOOL_NAME,
  USE_SKILL_TOOL_NAME,
} from "./tools";
import { createAgentSandboxOverlay, createAgentSandboxRuntime } from "../agent-sandbox";
import type { BashToolOptions } from "./tools/bash";
import {
  createAgentSandboxFromV1,
  isAgentSandbox,
  type AgentSandbox,
  type AgentSandboxFileEntry,
  type AgentSandboxFindResult,
} from "../agent-sandbox";
import { buildModeSection, getActivePlanFile, type ActivePlanFile } from "../mode-manager";
import { splitFrontmatter } from "../utils/frontmatter";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
import { createAgentsMdContextMessage } from "./agents-md";
export type { CodeAgentPromptOptions };
export type { BashToolOptions } from "./tools/bash";
import {
  type SkillFile,
  type SkillActivation,
  type SkillMeta,
  resolveSkillMeta,
  renderSkillContent,
  shouldAlwaysLoadSkill,
  shouldExposeSkillToModel,
} from "./skills";
import {
  createSubAgentTool,
  resolveSubAgentMeta,
  SubAgentTaskManager,
  type SubAgentConfig,
  CALL_SUB_AGENT_TOOL_NAME,
} from "../sub-agent";
export type { SubAgentConfig, CompletedSubAgentTask } from "../sub-agent";

export type { SkillActivation, SkillFile, SkillMeta };
export { resolveSkillMeta, USE_SKILL_TOOL_NAME };

// ─── UnifiedFile ────────────────────────────────────────────────────────────

/**
 * 统一文件模型。所有来源的文件（真实工程文件、只读规范文档、skills 等）
 * 都用此结构表示，通过权限字段区分行为，而不是通过不同的概念。
 *
 * 权限模型：
 * - `permissions.read`   — 是否允许 read_file 工具读取（默认 true）
 * - `permissions.write`  — 是否允许 write_file / edit_file 等工具写入（默认 false）
 * - `permissions.delete` — 是否允许 delete_file 工具删除（默认 false）
 */
export interface UnifiedFile {
  /** 路径（相对工程根） */
  path: string;
  /** 文件内容 */
  content: string;
  /** 文件权限，未填时默认 read:true, write:false, delete:false */
  permissions?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
}

export type FileExclude = RegExp | string;

export interface GetFilesOptions {
  /**
   * 可选过滤规则，命中的文件会被排除。
   *
   * - RegExp：匹配标准化后的文件路径
   * - string：匹配标准化后的完整路径或目录前缀
   */
  exclude?: FileExclude | FileExclude[];
}

export const AGENT_INTERNAL_FILE_EXCLUDE = /(^|\/)\.(agent|tmp)(\/|$)/;

const normalizeFilePath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '');

export const isFileExcluded = (file: UnifiedFile, exclude?: GetFilesOptions["exclude"]): boolean => {
  if (!exclude) return false;
  const excludes = Array.isArray(exclude) ? exclude : [exclude];
  const normalizedPath = normalizeFilePath(file.path);

  return excludes.some((pattern) => {
    if (pattern instanceof RegExp) {
      pattern.lastIndex = 0;
      return pattern.test(normalizedPath);
    }

    const normalizedPattern = normalizeFilePath(pattern);
    const directoryPattern = normalizedPattern.endsWith('/')
      ? normalizedPattern
      : `${normalizedPattern}/`;
    return normalizedPath === normalizedPattern || normalizedPath.startsWith(directoryPattern);
  });
};

// ─── Plugin 配置 ─────────────────────────────────────────────────────────────

/**
 * CodeAgent 插件配置。
 *
 * 对标 Claude Code plugin 的组件聚合语义：
 *   - skills 使用 SkillFile 声明
 *   - agents 使用 SubAgentConfig 声明（md 文件驱动），合并到顶层 subAgents
 *   - tools 使用 Tool 声明，并合并到顶层 tools
 *   - hooks 使用 AgentHooks 声明，仅在插件启用时参与执行
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
   * 用作 enablePlugin / disablePlugin 的查找键。
   * 命名规范：[a-z0-9][a-z0-9_-]*
   */
  name: string;
  /** 插件版本号（可选，展示用） */
  version?: string;
  /** 插件描述（可选，展示/调试用） */
  description?: string;
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
  /** 插件内置工具，使用原始工具名合并到顶层 tools */
  tools?: Tool[];
  /**
   * 插件生命周期 hooks，与 AgentOptions.hooks 的定义和行为一致。
   * 仅在插件启用时参与执行；多个插件按 plugins 数组顺序依次执行。
   */
  hooks?: AgentHooks;
}

export type CodeAgentBuiltinToolName =
  | typeof READ_TOOL_NAME
  | typeof WRITE_TOOL_NAME
  | typeof EDIT_TOOL_NAME
  | typeof MULTI_EDIT_TOOL_NAME
  | typeof DELETE_TOOL_NAME
  | typeof GREP_TOOL_NAME
  | typeof BASH_TOOL_NAME
  | typeof HISTORY_READ_TOOL_NAME;

const DEFAULT_BUILTIN_TOOLS: CodeAgentBuiltinToolName[] = [
  READ_TOOL_NAME,
  WRITE_TOOL_NAME,
  EDIT_TOOL_NAME,
  MULTI_EDIT_TOOL_NAME,
  DELETE_TOOL_NAME,
  GREP_TOOL_NAME,
  BASH_TOOL_NAME,
];

// ─── Sandbox V1 兼容接口 ──────────────────────────────────────────────────────

/**
 * 旧版 Sandbox V1 兼容接口。
 *
 * 新宿主应直接提供 `AgentSandbox`（原子 `files` + `commands`）；CodeAgent
 * 在入口将此 V1 接口转换为 AgentSandbox，因此保留它不会影响旧调用方。
 * V1 的 `getFiles()` 会返回全部文件内容，仅作为兼容层实现；新工具不直接依赖它。
 * 额外的设计器状态、日志等能力仍应通过 tools 参数注入。
 *
 * @deprecated 请改为提供 `AgentSandbox`。
 */
export interface Sandbox {
  /**
   * 旧版：获取全部文件及其内容。
   * @param options.exclude 可选过滤规则，命中的文件会被排除。
   *   典型用途：`exclude: /(^|\/)\.agent(\/|$)/` 过滤任意层级内部文件，用于向用户展示的文件列表。
   */
  getFiles(options?: GetFilesOptions): Promise<UnifiedFile[]>;
  /**
   * 写入文件。失败时 reject（抛出错误）。
   */
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 删除文件。失败时 reject（抛出错误）。
   */
  deleteFiles(paths: string[]): Promise<void>;
  /**
   * 获取静态背景上下文信息（代码规则、主题等项目信息）。
   * 返回的文本内容会通过 getStableContextMessages 注入到 LLM 上下文中。
   */
  getContext?: () => Promise<string | null>;
}

// ─── CodeAgentOptions ────────────────────────────────────────────────────────

export interface CodeAgentOptions extends Omit<AgentOptions, "system"> {
  /**
   * 推荐传入 AgentSandbox。为兼容既有宿主也接受 Sandbox V1，并在入口适配。
   * CodeAgent 内部只使用 AgentSandbox：文件工具走 files，grep 等结构化工具走 commands。
   * plugin 集成可通过 window._registSandBox_ 注入任一种契约。
   */
  sandbox: Sandbox | AgentSandbox;
  /** Restrict the bash tool to a host-approved command set. */
  bash?: BashToolOptions;
  /**
   * 系统提示词定制选项（可覆盖内置默认值）。
   * 传 false 则跳过所有内置段落，由 system 字段完全掌控系统提示词。
   */
  promptOptions?: CodeAgentPromptOptions | false;
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
  /**
   * 控制 CodeAgent 内置工具。
   *
   * - undefined：启用默认内置工具（不包含 history_read）
   * - false / []：不启用任何内置工具
   * - 指定工具名数组：只启用这些内置文件工具
   *
   * `tools` 仍然表示额外追加的自定义工具，不承担禁用内置工具的语义。
   */
  builtinTools?: false | CodeAgentBuiltinToolName[];
}

/** 虚拟 agent 资源路径前缀 */
const AGENT_PREFIX = ".agent/";
/** 虚拟 skills 路径前缀 */
const SKILLS_PREFIX = `${AGENT_PREFIX}skills/`;

/** 插件 name 命名规范校验 */
const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function composePluginHooks(
  baseHooks: AgentHooks | undefined,
  plugins: CodeAgentPlugin[],
  enabledNamesRef: { current: Set<string> },
): AgentHooks | undefined {
  const hasPluginHooks = plugins.some((plugin) => plugin.hooks);
  if (!baseHooks && !hasPluginHooks) return undefined;

  const getActiveHooks = (): Array<{ source: string; hooks: AgentHooks }> => [
    ...(baseHooks ? [{ source: "AgentOptions", hooks: baseHooks }] : []),
    ...plugins
      .filter((plugin) => enabledNamesRef.current.has(plugin.name))
      .flatMap((plugin) => plugin.hooks
        ? [{ source: `plugin "${plugin.name}"`, hooks: plugin.hooks }]
        : []),
  ];

  const runHook = async <T>(
    source: string,
    hookName: keyof AgentHooks,
    callback: () => T | Promise<T>,
  ): Promise<T | undefined> => {
    try {
      return await callback();
    } catch (error) {
      console.warn(`[CodeAgent] ${source}.hooks.${hookName} failed:`, error);
      return undefined;
    }
  };

  const hooks: AgentHooks = {
    async beforeTurn(params) {
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (activeHooks.beforeTurn) {
          await runHook(source, "beforeTurn", () => activeHooks.beforeTurn!(params));
        }
      }
    },
    async beforeRequest(params) {
      const additionalMessages: Message[] = [];
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (!activeHooks.beforeRequest) continue;
        const result = await runHook(
          source,
          "beforeRequest",
          () => activeHooks.beforeRequest!(params),
        );
        if (result?.additionalMessages?.length) {
          additionalMessages.push(...result.additionalMessages);
        }
      }
      return additionalMessages.length ? { additionalMessages } : undefined;
    },
    async beforeTurnStop(params) {
      const additionalMessages: Message[] = [];
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (!activeHooks.beforeTurnStop) continue;
        const result = await runHook(
          source,
          "beforeTurnStop",
          () => activeHooks.beforeTurnStop!(params),
        );
        if (result?.additionalMessages?.length) {
          additionalMessages.push(...result.additionalMessages);
        }
      }
      return additionalMessages.length ? { additionalMessages } : undefined;
    },
    async afterTurn(turn) {
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (activeHooks.afterTurn) {
          await runHook(source, "afterTurn", () => activeHooks.afterTurn!(turn));
        }
      }
    },
    async afterTurnSummary(turn, summary, result) {
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (activeHooks.afterTurnSummary) {
          await runHook(
            source,
            "afterTurnSummary",
            () => activeHooks.afterTurnSummary!(turn, summary, result),
          );
        }
      }
    },
    async afterTurnSettled(turn) {
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (activeHooks.afterTurnSettled) {
          await runHook(
            source,
            "afterTurnSettled",
            () => activeHooks.afterTurnSettled!(turn),
          );
        }
      }
    },
  };

  return hooks;
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
  const timeStr = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzOffset = -now.getTimezoneOffset() / 60;
  const tzOffsetStr = `UTC${tzOffset >= 0 ? "+" : ""}${tzOffset}`;
  sections.push(`当前时间：${dateStr} ${timeStr} (${tzOffsetStr}, ${tz})`);

  // ── Skills 目录 ───────────────────────────────────────────────────────────
  if (skills?.length) {
    const modelSkills = skills.filter(shouldExposeSkillToModel);
    if (modelSkills.length) {
      const lines = modelSkills.map((s) => {
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

async function buildAlwaysLoadedSkillsContent(skills: SkillFile[]): Promise<string> {
  const alwaysSkills = skills.filter(shouldAlwaysLoadSkill);
  if (!alwaysSkills.length) return "";

  const blocks: string[] = [];
  for (const skill of alwaysSkills) {
    blocks.push((await renderSkillContent(skill)).output);
  }

  return `以下 Skill 已默认打开，请直接遵照执行，无需再调用 ${USE_SKILL_TOOL_NAME} 工具：\n\n${blocks.join("\n\n---\n\n")}`;
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
 *   - `virtualFiles` — 只读文件（如根工程 `.agent/agent.md` 规则文档），由 Sandbox.virtualFiles 承载，合并进统一文件模型
 *   - `skills`    — 技能文件列表，挂载为 .agent/skills/ 目录（只读），LLM 按需读取
 *   - `subAgents` — 子 Agent 配置列表，注册 call-sub-agent 工具
 *   - `plugins`   — 插件列表（仅支持 skills / agents / tools / hooks）
 */

async function fetchPlanFiles(sandbox: AgentSandbox): Promise<Array<{ path: string; content: string }>> {
  const result = await sandbox.commands.execute({ name: "find", input: { path: ".agent/plans" } });
  const entries = ((result.structured as AgentSandboxFindResult<AgentSandboxFileEntry> | undefined)?.entries ?? [])
    .filter((e) => e.type !== "directory");
  return sandbox.files.readFiles(entries.map((e) => e.path));
}

export class CodeAgent extends Agent {
  /** 全量插件列表（构造时传入，不变） */
  private _plugins: CodeAgentPlugin[];
  /**
   * 当前已启用的插件名集合。
   * 由 plugin.enabled 字段（默认 true）初始化。
   * enablePlugin / disablePlugin 调用时即时更新，下一个 turn 生效。
   */
  private _enabledPluginNames: Set<string>;
  /** CodeAgent 内部只使用归一化后的 AgentSandbox。 */
  private _sandbox: AgentSandbox;
  /**
   * 顶层基础资源（来自 options.skills / options.subAgents / options.tools，不含 plugin 部分）。
   * 不参与动态重算，始终全量参与每次 turn 的资源合并。
   */
  private _base: { skills: SkillFile[]; subAgents: SubAgentConfig[]; tools: Tool[] };
  /** 运行中的异步 SubAgent 的完成结果，会在下一次 LLM 请求前注入。 */
  private _subAgentTaskManager: SubAgentTaskManager;

  constructor(options: CodeAgentOptions) {
    const {
      sandbox,
      skills,
      system,
      subAgents,
      plugins = [],
      builtinTools,
      bash,
      ...agentOptions
    } = options;

    const agentSandbox: AgentSandbox = isAgentSandbox(sandbox)
      ? sandbox
      : createAgentSandboxFromV1(sandbox, { allowedCommands: bash?.allowedCommands });

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
    const subAgentTaskManager = new SubAgentTaskManager();

    // super() 调用前 this 不可用，先用 enabledNamesRef 供 sandbox 闭包读取。
    // super() 之后再把它同步到真实的 this._enabledPluginNames 引用。
    const enabledNamesRef = { current: new Set<string>() };
    const hooks = composePluginHooks({
      ...agentOptions.hooks,
      async beforeRequest(params) {
        const messages = subAgentTaskManager.takeCompletedMessages();
        const base = await agentOptions.hooks?.beforeRequest?.(params);
        const additionalMessages = [...(base?.additionalMessages ?? []), ...messages];
        return additionalMessages.length ? { additionalMessages } : undefined;
      },
    }, plugins, enabledNamesRef);

    const getEnabledPluginSkills = (): SkillFile[] => plugins
      .filter((plugin) => enabledNamesRef.current.has(plugin.name))
      .flatMap((plugin) => plugin.skills ?? []);

    // 收集 skills 文件（只读，不可列出）
    const collectSkillFiles = (): UnifiedFile[] => {
      const allSkills = [...baseSkills, ...getEnabledPluginSkills()];
      return allSkills.flatMap((s) =>
        s.files.map((f) => ({
          path: `${SKILLS_PREFIX}${s.name}/${f.path}`,
          content: f.content,
          permissions: { read: true, write: false, delete: false },
        }))
      );
    };

    const enabledBuiltinToolNames = builtinTools === false
      ? []
      : builtinTools ?? DEFAULT_BUILTIN_TOOLS;
    const enabledBuiltinToolNameSet = new Set(enabledBuiltinToolNames);
    const runtimeSandbox = createAgentSandboxRuntime(agentSandbox);
    const { sandbox: toolSandbox } = createAgentSandboxOverlay(
      runtimeSandbox,
      collectSkillFiles,
    );
    const getPlanFiles = () => fetchPlanFiles(toolSandbox);
    const allBuiltinTools: Array<[CodeAgentBuiltinToolName, Tool]> = [
      [READ_TOOL_NAME, createReadTool(toolSandbox)],
      [WRITE_TOOL_NAME, createWriteTool(toolSandbox)],
      [EDIT_TOOL_NAME, createEditTool(toolSandbox)],
      [MULTI_EDIT_TOOL_NAME, createMultiEditTool(toolSandbox)],
      [DELETE_TOOL_NAME, createDeleteTool(toolSandbox)],
      [GREP_TOOL_NAME, createGrepTool(toolSandbox)],
      [BASH_TOOL_NAME, createBashTool(toolSandbox.commands, {
        ...bash,
        allowedCommands: bash?.allowedCommands ?? agentSandbox.commands.allowedCommands,
      })],
      [HISTORY_READ_TOOL_NAME, createHistoryReadTool()],
    ];
    const builtinToolInstances: Tool[] = allBuiltinTools
      .filter(([name]) => enabledBuiltinToolNameSet.has(name))
      .map(([, tool]) => tool);

    const base = {
      skills: baseSkills,
      subAgents: baseSubAgents,
      tools: [...builtinToolInstances, ...baseUserTools],
    };

    const getStableContextMessages = async (): Promise<Message[]> => {
      const skills = [...baseSkills, ...getEnabledPluginSkills()];
      const [agentsMdMessage, alwaysLoadedSkillsContent, ctx] = await Promise.all([
        createAgentsMdContextMessage(toolSandbox),
        buildAlwaysLoadedSkillsContent(skills),
        toolSandbox.getContext?.() ?? null,
      ]);
      return [
        ...(agentsMdMessage ? [agentsMdMessage] : []),
        ...(alwaysLoadedSkillsContent ? [{
          role: "user" as const,
          content: `<system-reminder>\n${alwaysLoadedSkillsContent}\n</system-reminder>`,
        }] : []),
        ...(ctx ? [{ role: "user" as const, content: ctx }] : []),
      ];
    };

    const builtinSystem = options.promptOptions === false
      ? ""
      : getCodeAgentSystemPrompt(agentOptions.promptOptions || undefined);
    const finalSystem = system ? `${builtinSystem}

${system}` : builtinSystem;

    super({
      ...agentOptions,
      hooks,
      system: finalSystem,
      getStableContextMessages,
      getAttachmentContextMessages: async (ctx) => {
        const sections: string[] = [];

        // 1. 环境信息：skills/subAgents/日期 + 模式提示词
        const { skills, subAgents } = this._getEnabledResources();
        const baseSection = buildEnvironmentSection(
          skills.length ? skills : undefined,
          subAgents.length ? subAgents : undefined,
        );
        const modeSection = await buildModeSection({
          mode: ctx.mode,
          previousMode: ctx.previousMode,
          disabledModes: agentOptions.disabledModes,
          getFiles: getPlanFiles,
        });
        const envText = [baseSection, modeSection].filter(Boolean).join("\n\n");
        if (envText) sections.push(envText);

        // 2. 外部传入的扩展内容（CodeAgentOptions.getAttachmentContextMessages）
        const extra = await agentOptions.getAttachmentContextMessages?.(ctx);
        if (extra?.length) sections.push(...extra);

        return sections;
      },
      tools: base.tools,
    });

    this._plugins = plugins;
    this._base = base;
    this._sandbox = toolSandbox;
    this._subAgentTaskManager = subAgentTaskManager;
    this._enabledPluginNames = new Set(
      plugins.filter((p) => p.enabled !== false).map((p) => p.name)
    );
    enabledNamesRef.current = this._enabledPluginNames;

    this._rebuildDynamicTools();
  }

  /**
   * 获取当前活跃的计划文件（status: active）。
   * 扫描 .agent/plans/ 目录，取日期最新的活跃计划文件。
   * 若不存在活跃计划则返回 null。
   */
  async getPlanFile(): Promise<ActivePlanFile | null> {
    return getActivePlanFile(() => fetchPlanFiles(this._sandbox));
  }

  /**
   * 将指定计划文件的 status 改为 abandoned（废弃）。
   * 修改 frontmatter 中的 status 字段后，通过 AgentSandbox.files.write 写回。
   */
  async abandonPlan(path: string, content: string): Promise<void> {
    const { fmText, body } = splitFrontmatter(content);
    if (!fmText) return; // 无 frontmatter，无法操作

    // 替换 status 字段，不存在则追加
    let newFmText: string;
    if (/^status\s*:/m.test(fmText)) {
      newFmText = fmText.replace(/^(status\s*:).+$/m, "$1 abandoned");
    } else {
      newFmText = `${fmText}\nstatus: abandoned`;
    }

    const newContent = `---\n${newFmText}\n---\n${body}`;
    await this._sandbox.files.write({ path, content: newContent });
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
    const pluginTools = enabledPlugins.flatMap((p) => p.tools ?? []);
    const tools = [...this._base.tools, ...pluginTools];

    return { skills, subAgents, tools };
  }

  /**
   * 根据当前启用插件状态，重建 use_skill、call-sub-agent 工具以及 plugin tools。
   * 每次 requestAI 前调用，确保工具列表与启用状态一致。
   */
  private _rebuildDynamicTools(): void {
    const { skills, subAgents, tools } = this._getEnabledResources();

    const modelSkills = skills.filter(shouldExposeSkillToModel);
    const skillTool = modelSkills.length ? createSkillTool(modelSkills) : null;
    const subAgentTool = subAgents.length
      ? createSubAgentTool(
          () => this,
          subAgents,
          skills.length ? skills : undefined,
          this._subAgentTaskManager,
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
