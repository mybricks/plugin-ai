import type { SubAgentTurnRecord, Tool } from "../types";

/** SubAgent 的纯配置声明。 */
export interface SubAgentConfig {
  /** 唯一标识，供 call-sub-agent.type 使用。 */
  name: string;
  /** 功能描述，供父 Agent 判断何时委派。 */
  description: string;
  /**
   * 是否允许后台执行（`async: true`）。
   * 默认 false：只能同步执行，同步阻塞父 Agent 直到子 Agent 结束。
   */
  supportsAsync?: boolean;
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

/** 从 SubAgentConfig 解析出、可直接传给 createSubAgent 的运行时参数。 */
export interface ResolvedSubAgentConfig {
  tools: Tool[];
  system: string;
  aiRole?: string;
}

/** `call-sub-agent` 工具的参数。 */
export interface CallSubAgentArgs {
  prompt: string;
  type: string;
  name: string;
  /** 后台运行并立即返回子会话标识，默认 false。 */
  async?: boolean;
}

/** 发起一次子 Agent 所需的参数，同步和后台模式共用。 */
export interface ChildAgentRequest {
  parentAgentKey: string;
  parentTurnId: string;
  parentToolCallId: string;
  /** SubAgent 类型（SubAgentConfig.name）。 */
  type: string;
  title: string;
  prompt: string;
  system: string;
  aiRole?: string;
  tools: Tool[];
}

/** 保留后台入口的原有类型名称，供外部调用方使用。 */
export type BackgroundSubAgentRequest = ChildAgentRequest;

/** 工具结果中用于定位子 Agent 的信息；运行状态以对应子 turn 为准。 */
export interface SubAgentMetadata {
  agentKey: string;
  turnId: string;
  parentAgentKey: string;
  parentTurnId: string;
  parentToolCallId: string;
  subAgentType: string;
  title?: string;
  startedAt: number;
}

/** 后台子 Agent 的会话标识与状态。 */
export interface BackgroundSubAgentInfo {
  agentKey: string;
  turnId: string;
  parentAgentKey: string;
  parentTurnId: string;
  parentToolCallId: string;
  type: string;
  title: string;
  status: "running" | "success" | "error" | "abort";
  startedAt: number;
  endedAt?: number;
  error?: string;
}

/** 后台子 Agent 的完整结果，包含最终 turn 记录。 */
export interface BackgroundSubAgentResult extends BackgroundSubAgentInfo {
  turn?: SubAgentTurnRecord;
}
