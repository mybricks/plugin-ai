import { Agent, normalizeAgentLocale, type AgentHooks, type AgentOptions } from "../agent";
import type { AgentMode, AttachmentContextItem, Message, Tool } from "../types";
import {
  createAfterToolCallParams,
  createBeforeToolCallParams,
  getToolCallOutcome,
  withToolCallOutcome,
} from "../hooks";
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
import { buildModeCatalogSection, buildModeStatusSection, getActivePlanFile, getAvailableAgentModes, type ActivePlanFile } from "../mode-manager";
import { splitFrontmatter } from "../utils/frontmatter";
import { getCodeAgentSystemPrompt, type CodeAgentPromptOptions } from "./prompt";
import { createAgentsMdContextMessage } from "./agents-md";
import { getAgentInternalFileExclude, getPlanDir, getSkillsDir, normalizeConfigDirName } from "./config-dir";
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
import type { PromptTemplateFile } from "./prompt-templates";
import { collectPluginPromptTemplates, createMbsTemplates, expandMbsTemplateMessage } from "./mbs";
import type { MbsTemplateDescriptor } from "./mbs";
import {
  createSubAgentTool,
  type SubAgentConfig,
  CALL_SUB_AGENT_TOOL_NAME,
} from "../sub-agent";
export type { SubAgentConfig } from "../sub-agent";

export type { SkillActivation, SkillFile, SkillMeta };
export type { PromptTemplateFile } from "./prompt-templates";
export { parseMbsTemplateRecord } from "./mbs";
export type { MbsTemplateRecord } from "./mbs";
export {
  DEFAULT_CONFIG_DIR_NAME,
  getAgentInternalFileExclude,
  getAgentMdPath,
  getConfigDirNameFromAgent,
  getConfigDirPath,
  getConfigDirPattern,
  getPlanDir,
  getSkillDir,
  getSkillsDir,
  normalizeConfigDirName,
} from "./config-dir";
export { resolveSkillMeta, USE_SKILL_TOOL_NAME };

/** @deprecated Use getAgentInternalFileExclude(configDirName) for custom directories. */
export const AGENT_INTERNAL_FILE_EXCLUDE = getAgentInternalFileExclude();

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
 *   - agents 使用 SubAgentConfig 声明，合并到顶层 subAgents
 *   - tools 使用 Tool 声明，并合并到顶层 tools
 *   - hooks 使用 AgentHooks 声明
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
   * 命名规范：[a-z0-9][a-z0-9_-]*
   */
  name: string;
  /** 插件版本号（可选，展示用） */
  version?: string;
  /** 插件描述（可选，展示/调试用） */
  description?: string;
  /** 插件内置 Skills，合并到顶层 skills */
  skills?: SkillFile[];
  /** 插件级 Prompt Templates。 */
  promptTemplates?: PromptTemplateFile[];
  /** 固定工作流程提示词，进入 system。 */
  promptSections?: Pick<CodeAgentPromptOptions, "workflowSection">;
  getAttachmentContextMessages?: (context: {
    sandbox: AgentSandbox;
    configDirName: string;
    mode: Parameters<NonNullable<AgentOptions["getAttachmentContextMessages"]>>[0]["mode"];
    previousMode: Parameters<NonNullable<AgentOptions["getAttachmentContextMessages"]>>[0]["previousMode"];
    turnStartTime: Parameters<NonNullable<AgentOptions["getAttachmentContextMessages"]>>[0]["turnStartTime"];
  }) => (AttachmentContextItem | string)[] | Promise<(AttachmentContextItem | string)[]>;
  /**
   * 插件内置 SubAgents，合并到顶层 subAgents。
   * 每个 SubAgentConfig 直接定义描述、工具和可选 system prompt。
   */
  agents?: SubAgentConfig[];
  /** 插件内置工具；按注册顺序合并到顶层 tools，同名时保留最先注册的实现。 */
  tools?: Tool[];
  /**
   * 插件生命周期 hooks，与 AgentOptions.hooks 的定义和行为一致。
   * 多个插件按 plugins 数组顺序依次执行。
   */
  hooks?: AgentHooks;
  /** 客户端可选渲染扩展；宿主决定是否展示。 */
  ui?: { todoArea?: (props: { setActive: (active: boolean) => void }) => any };
}

/**
 * 延迟创建插件。适合依赖 sandbox 状态的能力（例如 Git 探测）：工厂只执行一次，
 * 返回的仍是普通静态插件，不会在每个 turn 中重复求值。
 */
export type CodeAgentPluginFactory = (context: {
  sandbox: AgentSandbox;
  configDirName: string;
}) => CodeAgentPlugin | Promise<CodeAgentPlugin>;

export type CodeAgentPluginInput = CodeAgentPlugin | CodeAgentPluginFactory;

interface PluginRuntimeState {
  /** 已可用的静态插件；factory 解析成功后追加到此数组。 */
  plugins: CodeAgentPlugin[];
  /** 尚未执行的一次性插件工厂。 */
  factories: CodeAgentPluginFactory[];
  /** 并发调用 initializePlugins 时复用同一个初始化任务。 */
  initializing?: Promise<void>;
}

interface SystemPromptState {
  options: CodeAgentPromptOptions | false | undefined;
  customSystem: string | undefined;
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

/**
 * 工具按注册顺序稳定去重：同名时保留最先注册的实现。
 *
 * 这既避免将重复 function definition 发送给模型，也让调用方可以通过
 * 更靠前的来源（例如 AgentOptions.tools）显式覆盖后续插件的默认工具。
 */
function deduplicateTools(tools: Tool[]): Tool[] {
  const names = new Set<string>();
  return tools.filter((tool) => {
    if (names.has(tool.name)) return false;
    names.add(tool.name);
    return true;
  });
}

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
   *   典型用途：`exclude: getAgentInternalFileExclude(configDirName)` 过滤任意层级内部文件，用于向用户展示的文件列表。
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

export interface CodeAgentOptions extends Omit<AgentOptions, "system" | "getAttachmentContextMessages"> {
  /**
   * 推荐传入 AgentSandbox。为兼容既有宿主也接受 Sandbox V1，并在入口适配。
   * CodeAgent 内部只使用 AgentSandbox：文件工具走 files，grep 等结构化工具走 commands。
   * plugin 集成可通过 window._registSandBox_ 注入任一种契约。
   */
  sandbox: Sandbox | AgentSandbox;
  /**
   * Directory used for CodeAgent-owned project resources. Defaults to `.agent`.
   * Skills are exposed at `<configDirName>/skills/`, rules are read from
   * `<configDirName>/agent.md`, and plans live in `<configDirName>/plans/`.
   */
  configDirName?: string;
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
   *   - 每个 SkillFile.name 作为虚拟目录名（<configDirName>/skills/<name>/）
   *   - SKILL.md 为必填入口文件
   *   - 技能目录（name + description）列出在环境消息中，随每轮 user 消息注入
   *   - LLM 通过 use_skill 工具按需加载 SKILL.md 内容
   *   - 支持文件可通过 read_file 工具读取（<configDirName>/skills/<name>/<path>）
   *   - 不全量注入，避免 token 浪费
   */
  skills?: SkillFile[];
  /**
   * 追加到内置 system prompt 末尾的额外系统提示词。
   * 可用于注入项目特定规范、约束或上下文。
   */
  system?: string;
  getAttachmentContextMessages?: (ctx: {
    mode: AgentMode;
    previousMode: AgentMode | null;
    turnStartTime: number;
  }) => (AttachmentContextItem | string)[] | Promise<(AttachmentContextItem | string)[]>;
  /**
   * 子 Agent 配置列表。
   * 配置后会自动注册一个 `call-sub-agent` 工具，LLM 可通过工具调用来发起子 Agent 任务。
   * 不传或传空数组时不注册该工具。
   */
  subAgents?: SubAgentConfig[];
  /**
   * 插件配置列表。
   *
   * 普通对象会立即生效；函数工厂在首次使用前基于已初始化的 sandbox 执行一次，
   * 适合在 Git 等工作区状态已可读取后决定模板与工作流。
   */
  plugins?: CodeAgentPluginInput[];
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

/** 插件 name 命名规范校验 */
const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function collectPluginTemplates(plugins: CodeAgentPlugin[]) {
  return collectPluginPromptTemplates(plugins);
}

function composeSystemPrompt(
  promptOptions: CodeAgentPromptOptions | false | undefined,
  customSystem: string | undefined,
  plugins: CodeAgentPlugin[],
  locale: string,
): string {
  const workflowSections = [
    promptOptions === false ? undefined : promptOptions?.workflowSection,
    ...plugins.map((plugin) => plugin.promptSections?.workflowSection),
  ].filter((section): section is string => Boolean(section?.trim()));
  const builtin = promptOptions === false
    ? workflowSections.join("\n\n")
    : getCodeAgentSystemPrompt({
      ...promptOptions,
      workflowSection: workflowSections.join("\n\n") || undefined,
    }, locale);
  return [builtin, customSystem].filter(Boolean).join("\n\n");
}

export function composePluginHooks(
  baseHooks: AgentHooks | undefined,
  plugins: CodeAgentPlugin[],
  hasPendingFactories = false,
): AgentHooks | undefined {
  const hasPluginHooks = plugins.some((plugin) => plugin.hooks);
  if (!baseHooks && !hasPluginHooks && !hasPendingFactories) return undefined;

  const getActiveHooks = (): Array<{ source: string; hooks: AgentHooks }> => [
    ...(baseHooks ? [{ source: "AgentOptions", hooks: baseHooks }] : []),
    ...plugins.flatMap((plugin) => plugin.hooks
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
    async beforeToolCall(params) {
      let args = params.toolCall.args;
      let changed = false;
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (!activeHooks.beforeToolCall) continue;
        const result = await runHook(
          source,
          "beforeToolCall",
          () => activeHooks.beforeToolCall!(createBeforeToolCallParams({
            ...params,
            toolCall: { ...params.toolCall, args },
          })),
        );
        if (!result) continue;
        // 任一插件 deny 即短路，后续插件不再有机会改写参数。
        if (result.decision === "deny") return result;
        if (Object.prototype.hasOwnProperty.call(result, "args")) {
          args = result.args;
          changed = true;
        }
      }
      return changed ? { args } : undefined;
    },
    async afterToolCall(params) {
      // 逐个插件串联改写：后一个插件看到的是前一个插件改写后的结果。
      let toolCall = params.toolCall;
      let changed = false;
      for (const { source, hooks: activeHooks } of getActiveHooks()) {
        if (!activeHooks.afterToolCall) continue;
        const result = await runHook(
          source,
          "afterToolCall",
          () => activeHooks.afterToolCall!(createAfterToolCallParams({ ...params, toolCall })),
        );
        if (!result) continue;
        toolCall = withToolCallOutcome(toolCall, result);
        changed = true;
      }
      return changed ? getToolCallOutcome(toolCall) : undefined;
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

function buildCapabilityCatalogSection(skills?: SkillFile[], subAgents?: SubAgentConfig[]): string {
  const sections: string[] = [];

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

  // ── SubAgent 列表 ─────────────────────────────────────────────────────────
  if (subAgents?.length) {
    const lines = subAgents
      .map((c) => `  ${c.name}: ${c.description}`)
      .join("\n");

    sections.push(
      `可用 SubAgent（需要时使用 ${CALL_SUB_AGENT_TOOL_NAME} 工具发起调用）：\n` +
        `${lines}`
    );
  }

  if (sections.length === 0) return "";

  return `<system-reminder>\n${sections.join("\n\n")}\n</system-reminder>`;
}

function buildCurrentTimeSection(referenceTime: number, locale: string): string {
  const now = new Date(referenceTime);
  const english = /^en(?:-|$)/i.test(locale);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const dateTime = new Intl.DateTimeFormat(english ? "en-US" : "zh-CN", {
    timeZone: tz, year: "numeric", month: "long", day: "numeric", weekday: "long",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZoneName: "shortOffset",
  }).format(now);
  const content = english
    ? `Current time: ${dateTime} (${tz}).`
    : `当前时间：${dateTime}（${tz}）。`;
  return `<system-reminder>\n${content}\n</system-reminder>`;
}

function buildLocaleSection(locale: string): string {
  const content = /^en(?:-|$)/i.test(locale)
    ? "Always use English to communicate with the user and generate content."
    : "建议使用中文与用户交流并生成内容。";
  return `<system-reminder>\n${content}\n</system-reminder>`;
}

async function buildAlwaysLoadedSkillsContent(skills: SkillFile[], configDirName: string): Promise<string> {
  const alwaysSkills = skills.filter(shouldAlwaysLoadSkill);
  if (!alwaysSkills.length) return "";

  const blocks: string[] = [];
  for (const skill of alwaysSkills) {
    blocks.push((await renderSkillContent(skill, configDirName)).output);
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
 *   - `virtualFiles` — 只读文件（如根工程 `<configDirName>/agent.md` 规则文档），由 Sandbox.virtualFiles 承载，合并进统一文件模型
 *   - `skills`    — 技能文件列表，挂载为 `<configDirName>/skills/` 目录（只读），LLM 按需读取
 *   - `subAgents` — 子 Agent 配置列表，注册 call-sub-agent 工具
 *   - `plugins`   — 插件列表（仅支持 skills / agents / tools / hooks）
 */

async function fetchPlanFiles(
  sandbox: AgentSandbox,
  configDirName: string,
): Promise<Array<{ path: string; content: string }>> {
  const result = await sandbox.commands.execute({ name: "find", input: { path: getPlanDir(configDirName).slice(0, -1) } });
  const entries = ((result.structured as AgentSandboxFindResult<AgentSandboxFileEntry> | undefined)?.entries ?? [])
    .filter((e) => e.type !== "directory");
  return sandbox.files.readFiles(entries.map((e) => e.path));
}

export class CodeAgent extends Agent {
  private _pluginRuntime: PluginRuntimeState;
  private _systemPrompt: SystemPromptState;
  /** CodeAgent 内部只使用归一化后的 AgentSandbox。 */
  private _sandbox: AgentSandbox;
  /** Normalized directory used by this CodeAgent for its virtual resources. */
  readonly configDirName: string;
  /**
   * 顶层基础资源（来自 options.skills / options.subAgents / options.tools，不含 plugin 部分）。
   * 不参与动态重算，始终全量参与每次 turn 的资源合并。
   */
  private _base: { skills: SkillFile[]; subAgents: SubAgentConfig[]; tools: Tool[] };

  constructor(options: CodeAgentOptions) {
    const {
      sandbox,
      configDirName: configDirNameOption,
      skills,
      system,
      subAgents,
      plugins: pluginInputs = [],
      builtinTools,
      bash,
      ...agentOptions
    } = options;
    const locale = normalizeAgentLocale(options.locale);
    const configDirName = normalizeConfigDirName(configDirNameOption);
    const skillsPrefix = getSkillsDir(configDirName);

    const agentSandbox: AgentSandbox = isAgentSandbox(sandbox)
      ? sandbox
      : createAgentSandboxFromV1(sandbox, { allowedCommands: bash?.allowedCommands });

    const pluginRuntime: PluginRuntimeState = {
      plugins: pluginInputs.filter((plugin): plugin is CodeAgentPlugin => typeof plugin !== "function"),
      factories: pluginInputs.filter((plugin): plugin is CodeAgentPluginFactory => typeof plugin === "function"),
    };
    const { plugins, factories: pluginFactories } = pluginRuntime;
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
    const hooks = composePluginHooks(agentOptions.hooks, plugins, pluginFactories.length > 0);

    const getPluginSkills = (): SkillFile[] => plugins.flatMap((plugin) => plugin.skills ?? []);

    const formatUserMessage = async (params: Parameters<NonNullable<AgentOptions["formatUserMessage"]>>[0]) => {
      const mbsMessage = expandMbsTemplateMessage(
        params.message,
        createMbsTemplates(collectPluginTemplates(plugins), locale),
      );
      const formattedParams = { ...params, message: mbsMessage ?? params.message };
      return agentOptions.formatUserMessage
        ? agentOptions.formatUserMessage(formattedParams)
        : { message: formattedParams.message };
    };

    // 收集 skills 文件（只读，不可列出）
    const collectSkillFiles = (): UnifiedFile[] => {
      const allSkills = [...baseSkills, ...getPluginSkills()];
      return allSkills.flatMap((s) =>
        s.files.map((f) => ({
          path: `${skillsPrefix}${s.name}/${f.path}`,
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
    const getPlanFiles = () => fetchPlanFiles(toolSandbox, configDirName);
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

    const getStableContextMessages = async (
      { includeSandboxContext = true }: { includeSandboxContext?: boolean } = {},
    ): Promise<Message[]> => {
      const skills = [...baseSkills, ...getPluginSkills()];
      const [agentsMdMessage, alwaysLoadedSkillsContent, ctx] = await Promise.all([
        createAgentsMdContextMessage(toolSandbox, configDirName),
        buildAlwaysLoadedSkillsContent(skills, configDirName),
        includeSandboxContext ? (toolSandbox.getContext?.() ?? null) : null,
      ]);

      const { skills: allSkills, subAgents: allSubAgents } = this._getPluginResources();
      const capabilityCatalog = buildCapabilityCatalogSection(
        allSkills.length ? allSkills : undefined,
        allSubAgents.length ? allSubAgents : undefined,
      );
      const modeCatalog = buildModeCatalogSection({
        availableModes: getAvailableAgentModes({ disabledModes: agentOptions.disabledModes }),
        configDirName,
      });

      return [
        ...(agentsMdMessage ? [agentsMdMessage] : []),
        ...(alwaysLoadedSkillsContent ? [{
          role: "user" as const,
          content: `<system-reminder>\n${alwaysLoadedSkillsContent}\n</system-reminder>`,
        }] : []),
        ...(ctx ? [{ role: "user" as const, content: ctx }] : []),
        ...(capabilityCatalog ? [{ role: "user" as const, content: capabilityCatalog }] : []),
        ...(modeCatalog ? [{ role: "user" as const, content: modeCatalog }] : []),
      ];
    };

    const finalSystem = composeSystemPrompt(
      options.promptOptions,
      system,
      plugins,
      locale,
    );

    super({
      ...agentOptions,
      locale,
      hooks,
      formatUserMessage,
      system: finalSystem,
      getStableContextMessages,
      getAttachmentContextMessages: async (ctx) => {
        const items: AttachmentContextItem[] = [];

        const customSections: string[] = [];
        const extra = await agentOptions.getAttachmentContextMessages?.(ctx);
        for (const item of extra ?? []) {
          if (typeof item === "string") { if (item) customSections.push(item); continue; }
          if (!item?.content) continue;
          if (item.key) items.push(item);
          else customSections.push(item.content);
        }

        for (const plugin of plugins) {
          if (!plugin.getAttachmentContextMessages) continue;
          try {
            const pluginItems = await plugin.getAttachmentContextMessages({
              ...ctx,
              sandbox: toolSandbox,
              configDirName,
            });
            for (const item of pluginItems ?? []) {
              if (typeof item === "string") { if (item) customSections.push(item); continue; }
              if (!item?.content) continue;
              if (item.key) items.push(item);
              else customSections.push(item.content);
            }
          } catch (error) {
            console.warn(`[CodeAgent] plugin "${plugin.name}" attachment context failed:`, error);
          }
        }
        if (customSections.length) items.push({ key: "__legacy_attachment_context__", content: customSections.join("\n\n"), dedupThreshold: "always" });

        const modeStatus = await buildModeStatusSection({
          mode: ctx.mode,
          previousMode: ctx.previousMode,
          disabledModes: agentOptions.disabledModes,
          getFiles: getPlanFiles,
          configDirName,
        });
        if (modeStatus) items.push({ key: "mode", content: modeStatus });

        items.push({ key: "locale", content: buildLocaleSection(locale) });
        items.push({ key: "time", content: buildCurrentTimeSection(ctx.turnStartTime, locale), dedupThreshold: "always" });

        return items;
      },
      tools: base.tools,
    });

    this._pluginRuntime = pluginRuntime;
    this._systemPrompt = { options: options.promptOptions, customSystem: system };
    this._base = base;
    this._sandbox = toolSandbox;
    this.configDirName = configDirName;
    this._rebuildDynamicTools();
  }

  /**
   * 获取当前活跃的计划文件（status: active）。
   * 扫描 `<configDirName>/plans/` 目录，取日期最新的活跃计划文件。
   * 若不存在活跃计划则返回 null。
   */
  async getPlanFile(): Promise<ActivePlanFile | null> {
    return getActivePlanFile(() => fetchPlanFiles(this._sandbox, this.configDirName), this.configDirName);
  }

  /** Active MBS templates. UI may present these through any interaction it owns. */
  getMbsTemplates(): MbsTemplateDescriptor[] {
    return createMbsTemplates(collectPluginTemplates(this._pluginRuntime.plugins), this.locale).map((item) => item.descriptor);
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

  private _getPluginResources(): {
    skills: SkillFile[];
    subAgents: SubAgentConfig[];
    tools: Tool[];
  } {
    const skills = [
      ...this._base.skills,
      ...this._pluginRuntime.plugins.flatMap((p) => p.skills ?? []),
    ];
    const subAgents = [
      ...this._base.subAgents,
      ...this._pluginRuntime.plugins.flatMap((p) => p.agents ?? []),
    ];
    const pluginTools = this._pluginRuntime.plugins.flatMap((p) => p.tools ?? []);
    const tools = deduplicateTools([...this._base.tools, ...pluginTools]);

    return { skills, subAgents, tools };
  }

  /**
   * 重建 use_skill、call-sub-agent 工具以及 plugin tools。
   */
  private _rebuildDynamicTools(): void {
    const { skills, subAgents, tools } = this._getPluginResources();

    const modelSkills = skills.filter(shouldExposeSkillToModel);
    const skillTool = modelSkills.length ? createSkillTool(modelSkills, this.configDirName) : null;
    const subAgentTool = subAgents.length
      ? createSubAgentTool(
          () => this,
          subAgents,
          skills.length ? skills : undefined,
        )
      : null;

    this.options.tools = deduplicateTools([
      ...tools,
      ...(skillTool ? [skillTool] : []),
      ...(subAgentTool ? [subAgentTool] : []),
    ]);
  }

  override async requestAI(params: Parameters<Agent["requestAI"]>[0]): Promise<void> {
    await this.initializePlugins();
    this._rebuildDynamicTools();
    return super.requestAI(params);
  }

  override async retry(params: Parameters<Agent["retry"]>[0]): Promise<void> {
    await this.initializePlugins();
    return super.retry(params);
  }

  /** 仅执行一次延迟插件工厂；工厂产物随后等同于普通静态插件。 */
  initializePlugins(): Promise<void> {
    const runtime = this._pluginRuntime;
    if (runtime.initializing) return runtime.initializing;
    if (!runtime.factories.length) return Promise.resolve();
    const factories = runtime.factories.splice(0);
    const initialize = async () => {
      for (const factory of factories) {
        try {
          const plugin = await factory({
            sandbox: this._sandbox,
            configDirName: this.configDirName,
          });
          if (!PLUGIN_NAME_PATTERN.test(plugin.name)) {
            console.warn(`[CodeAgent] Plugin name "${plugin.name}" 不符合命名规范 [a-z0-9][a-z0-9_-]。`);
          }
          runtime.plugins.push(plugin);
        } catch (error) {
          console.warn("[CodeAgent] plugin factory failed to initialize:", error);
        }
      }
      this._refreshSystemPrompt();
      this._rebuildDynamicTools();
    };
    runtime.initializing = initialize().finally(() => {
      runtime.initializing = undefined;
    });
    return runtime.initializing;
  }

  private _refreshSystemPrompt(): void {
    this.options.system = composeSystemPrompt(
      this._systemPrompt.options,
      this._systemPrompt.customSystem,
      this._pluginRuntime.plugins,
      this.locale,
    );
  }

  /** 更新基础提示词并重组 system。 */
  setPromptOptions(promptOptions: CodeAgentPromptOptions | false | undefined): void {
    this._systemPrompt.options = promptOptions;
    this._refreshSystemPrompt();
  }

  /** 已初始化插件的快照。 */
  getPlugins(): CodeAgentPlugin[] {
    return [...this._pluginRuntime.plugins];
  }
}
