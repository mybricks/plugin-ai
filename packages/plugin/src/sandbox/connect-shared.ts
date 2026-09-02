import type { AgentSandbox, AgentOptions, Tool, CodeAgentPlugin, History, TurnSender, SkillFile, UnifiedFile, BoundHistory } from "../../../agent/src";
import type { PromptSections } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { DisabledHandler } from "../disabled-handler";
import type { Designer, SandboxChipConfig, SandboxChipsConfig, SandboxChipRecordConfig } from "./types";
import { registerChipRemoveHandlers } from "./chip-remove";
import { chipRegistry } from "./chip-registry";

export type PluginGetUserContextMessage = () => string | null | undefined | Promise<string | null | undefined>;

/** Controls the automatic project-space context attached to each turn. */
export type ProjectContext =
  | { type?: "project" }
  | { type: "directory"; directory: string };

/** Directories omitted from automatic project-space context, not from tools. */
export const PROJECT_CONTEXT_EXCLUDE = [
  /(^|\/)(\.(agent|claude|codex|git|tmp)|node_modules|_lore)(\/|$)/,
] as const;

export interface VirtualFilesRuntimeContext {
  getEffectiveLibrariesSection: (options?: { path?: string; moduleKey?: string }) => Promise<string>;
}

/** 服务端 Agent 的初始化配置。传给 pluginAI 的 remoteAgent 时会创建 HTTP Agent。 */
export interface RemoteAgentConfig {
  /** 方舟测试环境默认值：http://localhost:3001/agents/api */
  baseUrl?: string;
  /** 服务端 workspaceId；通常对应平台 conversation id。 */
  workspaceId: string;
  /** 服务端 agentId。未传时使用 workspace 的 default agent。 */
  agentId?: string;
}

export interface AgentRuntimeConfig {
  promptSections?: PromptSections;
  tools?: Tool[];
  skills?: SkillFile[];
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  componentRuntime?: any;
}

export interface AgentRuntimeRef {
  current: AgentRuntimeConfig | undefined;
  apply?: (config: AgentRuntimeConfig | undefined) => void;
}

export interface ConnectToAIResult {
  /**
   * 该 comId 对应的、已绑定 agentKey 的 History 视图。
   * 总是从 agent 实例上取，保证与 Agent 内部共享同一个引用。
   * 若 Agent 未配置 history 则为 null（正常情况下不会出现）。
   */
  history: BoundHistory | null;
  /** 统一的 disabled 判断与消息处理。 */
  disabledHandler: DisabledHandler;
  /** 当前 History 是否由 remote Agent 的 workspace API 提供。 */
  isRemoteAgent: boolean;
  /**
   * 文件初始化完成后兑现，是 Runtime 和首个 Agent 请求的共同前置条件。
   * remote Agent 优先同步服务端 workspace，失败后可回退 initialFiles；本地 Agent 按 initialFiles 同步。
   */
  workspaceReady?: Promise<void>;
}

export interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  llmPluginKey?: string;
  /** 注入到根工程虚拟 FS 的文件（每个 turn 调用一次） */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  /** 本地 CodeAgent 的初始化文件快照；首次请求前会执行 diff/update/delete。 */
  initialFiles?: Array<Pick<UnifiedFile, "path" | "content">>;
  skills?: SkillFile[];
  plugins?: CodeAgentPlugin[];
  promptSections?: PromptSections;
  tools?: Tool[];
  codeRules?: string;
  designRules?: string;
  getUserContextMessage?: PluginGetUserContextMessage;
  projectContext?: ProjectContext;
  formatUserMessage?: AgentOptions["formatUserMessage"];
  disabledModes?: AgentOptions["disabledModes"];
  disabledHandler: DisabledHandler;
  history?: History;
  remoteAgent?: RemoteAgentConfig;
  sender?: TurnSender;
  agentRuntimeRefs: Map<string, AgentRuntimeRef>;
}

export interface SkillRuntimeContext {
  designer?: Designer;
  agentSandbox?: AgentSandbox;
  codeRules?: string;
  designRules?: string;
}

export function injectSkillRuntimeContext(skill: SkillFile, runtimeContext: SkillRuntimeContext): SkillFile {
  const clonedSkill: SkillFile = {
    ...skill,
    files: skill.files.map((file) => ({ ...file })),
  };
  if (skill.updateContent) {
    const updateContent = skill.updateContent;
    clonedSkill.updateContent = () => updateContent.call(clonedSkill, runtimeContext);
  }
  return clonedSkill;
}

export function injectPluginRuntimeContext(plugin: CodeAgentPlugin, runtimeContext: SkillRuntimeContext): CodeAgentPlugin {
  if (!plugin.skills?.length) return plugin;
  return {
    ...plugin,
    skills: plugin.skills.map((skill) => injectSkillRuntimeContext(skill, runtimeContext)),
  };
}

export function formatLibraryDocs(libraries: Array<{ name: string; version?: string; usage: string }>): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

export function normalizeChipConfigs(chips?: SandboxChipsConfig): SandboxChipConfig[] {
  if (!chips) return [];
  if (Array.isArray(chips)) return chips;
  return Object.entries(chips).map(([type, config]) => ({
    ...(config as SandboxChipRecordConfig),
    type: (config as SandboxChipRecordConfig).type ?? type,
  }));
}

export function registerChips(agentKey: string, chips?: SandboxChipsConfig): void {
  const configs = normalizeChipConfigs(chips);
  if (!configs.length) return;
  for (const config of configs) {
    if (config.def) {
      chipRegistry.register(config.def);
    }
  }
  registerChipRemoveHandlers(agentKey, configs);
}
