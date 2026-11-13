import type { AgentSandbox, AgentOptions, Tool, CodeAgentPlugin, CodeAgentPluginInput, History, TurnSender, SkillFile, UnifiedFile, BoundHistory } from "../../../agent/src";
import { DEFAULT_CONFIG_DIR_NAME, getConfigDirPattern } from "../../../agent/src";
import type { PromptSections } from "../../../kit/src";
import type { RequestAsStreamFn } from "../../../request/src";
import type { DisabledHandler } from "../disabled-handler";
import type { Designer, SandboxChipConfig, SandboxChipsConfig, SandboxChipRecordConfig, MentionProvider } from "./types";
import { registerChipRemoveHandlers } from "./chip-remove";
import { chipRegistry } from "./chip-registry";
import { mentionRegistry } from "./mention-registry";

export type PluginGetUserContextMessage = () => string | null | undefined | Promise<string | null | undefined>;

/** Controls the automatic project-space context attached to each turn. */
export type ProjectContext =
  | { type?: "project" }
  | {
      type: "directory";
      directory: string;
    };

/** Directories omitted from automatic project-space context, not from tools. */
export function getProjectContextExclude(configDirName = DEFAULT_CONFIG_DIR_NAME): RegExp[] {
  return [new RegExp(`(^|/)(?:${getConfigDirPattern(configDirName)}|\\.(?:claude|codex|git|tmp)|node_modules|_lore)(/|$)`)];
}

export interface VirtualFilesRuntimeContext {
  getEffectiveLibrariesSection: (options?: { path?: string; moduleKey?: string }) => Promise<string>;
  /** The normalized CodeAgent configuration directory for this plugin instance. */
  configDirName: string;
}

/** 服务端 Agent 的初始化配置。传给 pluginAI 的 remoteAgent 时会创建 HTTP Agent 或 WebSocket Agent。 */
export interface RemoteAgentConfig {
  /** Agent 类型：'http' 使用 HTTP/SSE 方式（默认），'websocket' 使用 WebSocket + MCP 方式 */
  type?: "http" | "websocket";
  /** 方舟测试环境默认值：http://localhost:3001/agents/api（http 类型）或 http://112.17.139.222:8106（websocket 类型） */
  baseUrl?: string;
  /** 服务端 workspaceId；通常对应平台 conversation id。 */
  workspaceId: string;
  /** 服务端 agentId。未传时使用 workspace 的 default agent（仅 http 类型）。 */
  agentId?: string;
  /** 可选的应用版本补写回调；调用时文件已同步到对应版本（仅 http 类型）。 */
  onVersionSaved?: (version: { turnId: string; versionId: string }) => Promise<void>;
  /** 平台网关鉴权 token，websocket 类型必填；以 "token" header 发送，WS 握手以 "authToken" 参数发送。支持传函数按请求实时取值。 */
  token?: string | (() => string | undefined | null);
  /** 平台网关会话标识，websocket 类型必填；以 "session" header 发送，WS 握手以 "authSession" 参数发送。支持传函数按请求实时取值。 */
  session?: string | (() => string | undefined | null);
  /** 智能体代码（仅 websocket 类型）。 */
  agentCode?: string;
  /** 项目 ID（仅 websocket 类型），随 /chat/stream 的 variables 发送。 */
  projectId?: string | number;
  /** 应用类型（仅 websocket 类型），随 /chat/stream 的 variables 发送。 */
  appType?: string | number;
  /** 客户端类型标识（仅 websocket 类型）。 */
  clientType?: string;
  /** 业务元数据（仅 websocket 类型）。 */
  meta?: Record<string, any>;
  /** 服务端 sessionId（仅 websocket 类型）；传入时复用该会话。 */
  sessionId?: string;
  /**
   * 本地会话被重置/清除时触发；调用方可在此通知后端清理其保存的 sessionId。
   * 入参为被重置前的 sessionId。（仅 websocket 类型）
   */
  onSessionReset?: (sessionId: string) => void | Promise<void>;
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

export type RemoteFsOperation =
  | {
      type: "write";
      path: string;
      content: string;
      /** 省略时直接写入；null 表示要求文件不存在。 */
      baseHash?: string | null;
    }
  | {
      type: "delete";
      path: string;
      /** 省略时直接删除；null 表示要求文件不存在。 */
      baseHash?: string | null;
    };

export interface RemoteFsConflict {
  type: RemoteFsOperation["type"];
  path: string;
  baseHash: string | null;
  current: { path: string; content: string } | null;
  currentHash: string | null;
}

export interface RemoteFsOperationsResult {
  workspaceId: string;
  version: number;
  applied: Array<{ type: "write" | "delete"; path: string }>;
  conflicts: RemoteFsConflict[];
}

export interface RemoteFileSystem {
  applyOperations(
    operations: RemoteFsOperation[],
  ): Promise<RemoteFsOperationsResult>;
}

interface ConnectToAIResultBase {
  /**
   * 该 comId 对应的、已绑定 agentKey 的 History 视图。
   * 总是从 agent 实例上取，保证与 Agent 内部共享同一个引用。
   * 若 Agent 未配置 history 则为 null（正常情况下不会出现）。
   */
  history: BoundHistory | null;
  /** 统一的 disabled 判断与消息处理。 */
  disabledHandler: DisabledHandler;
  /**
   * 文件初始化完成后兑现，是 Runtime 和首个 Agent 请求的共同前置条件。
   * remote Agent 同步服务端 workspace；本地 Agent 按 initialFiles 同步。
   */
  workspaceReady?: Promise<void>;
}

/**
 * remoteFs 与 isRemoteAgent 是同一能力的两面：本地 Agent 不会暴露 remoteFs。
 */
export type ConnectToAIResult =
  | (ConnectToAIResultBase & {
      isRemoteAgent: true;
      remoteFs: RemoteFileSystem;
    })
  | (ConnectToAIResultBase & {
      isRemoteAgent: false;
      remoteFs?: never;
    });

export interface PluginParams {
  requestAsStream: RequestAsStreamFn;
  llmPluginKey?: string;
  /** 注入到根工程虚拟 FS 的文件（每个 turn 调用一次） */
  virtualFiles?: (context: VirtualFilesRuntimeContext) => Promise<UnifiedFile[]>;
  /** Directory passed to local CodeAgent instances; defaults to `.agent`. */
  configDirName?: string;
  /** 本地 CodeAgent 的初始化文件快照；首次请求前会执行 diff/update/delete。 */
  initialFiles?: Array<Pick<UnifiedFile, "path" | "content">>;
  skills?: SkillFile[];
  plugins?: CodeAgentPluginInput[];
  promptSections?: PromptSections;
  tools?: Tool[];
  codeRules?: string;
  designRules?: string;
  getUserContextMessage?: PluginGetUserContextMessage;
  projectContext?: ProjectContext;
  formatUserMessage?: AgentOptions["formatUserMessage"];
  disabledModes?: AgentOptions["disabledModes"];
  mask?: AgentOptions["mask"];
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

export function injectPluginRuntimeContext(plugin: CodeAgentPluginInput, runtimeContext: SkillRuntimeContext): CodeAgentPluginInput {
  if (typeof plugin === "function") {
    return async (context) => injectPluginRuntimeContext(await plugin(context), runtimeContext) as CodeAgentPlugin;
  }
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

/**
 * 注册该 comId 专属的 mention 来源，与 registerChips 同级。
 * - 把每个 provider.chip 注册进全局 chipRegistry（与 PluginAIParams.mentions 的处理逻辑一致）；
 * - 把 provider 列表存入 mentionRegistry，按 agentKey 隔离，供该 comId 对应的 ChatPanel 读取。
 */
export function registerMentions(agentKey: string, mentions?: MentionProvider[]): void {
  mentionRegistry.register(agentKey, mentions);
  if (!mentions?.length) return;
  for (const mention of mentions) {
    chipRegistry.register(mention.chip);
  }
}
