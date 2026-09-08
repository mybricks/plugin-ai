import type { HistoryPersistMode, TurnRecord, AgentMode } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { ProviderConfig } from "@request/providers";
import type { Tool } from "@agent/types";
import type { CodeAgent } from "@agent/code-agent";
import type { SkillFile } from "@agent/code-agent";
import type { AgentSandbox } from "@agent/agent-sandbox";
import type { ChatPanelProps } from "@plugin/ui/chat";
import type { MentionProvider } from "@plugin/index";
import type { AttachProcessor } from "@plugin/content-limits";
import type { FsFile } from "../lib/mem-fs";
import type { RequestSnapshot } from "../lib/use-request-inspector";
import type React from "react";

export type Priority = "P0" | "P1" | "P2";

export interface AssertionContext {
  snapshots: RequestSnapshot[];
  agent: CodeAgent | null;
  memFS: import("../lib/mem-fs").MemFS | null;
}

export interface AssertionResult {
  pass: boolean;
  message?: string;
}

export interface TestCaseAssertion {
  name: string;
  run: (ctx: AssertionContext) => AssertionResult | null;
}

export interface TestCase {
  id: string;
  name: string;
  group: string;
  /** 优先级，P0 最高，排序时 P0 排在最前 */
  priority?: Priority;
  description: string;
  expectedBehavior: string;
  /** 预设历史轮次 */
  initialTurns: TurnRecord[];
  /** 预设文件系统（不传则使用 DEFAULT_FILES） */
  initialFiles?: FsFile[];
  /** 选择 CodeAgent 的 sandbox 路径；默认保持 V1。 */
  sandboxKind?: "v1" | "agent";
  /** 为 AgentSandbox 用例提供原生实现，用于覆盖命令 transport 等能力。 */
  agentSandboxFactory?: (fs: import("../lib/mem-fs").MemFS) => AgentSandbox;
  request: RequestAsStreamFn;
  /** 预设 LLM 配置，用于测试模型选择器和模型切换 */
  llm?: {
    providers?: ProviderConfig[];
  };
  tools?: Tool[] | ((fs: import("../lib/mem-fs").MemFS) => Tool[]);
  /** 预设技能文件列表，传入 CodeAgent.skills */
  skills?: SkillFile[];
  maskOptions?: {
    maxTurns?: number;
    maxAgeMinutes?: number;
  };
  handoffOptions?: {
    enabled?: boolean;
  };
  compactOptions?: {
    enabled?: boolean;
    maxTurns?: number;
    contextWindow?: number;
  };
  summaryOptions?: {
    enabled: boolean;
    suggestions?: boolean;
  };
  /** 覆盖 CodeAgent 的其他配置（maxSteps、doomLoopThreshold 等） */
  agentOptions?: {
    maxSteps?: number;
    doomLoopThreshold?: number;
    retry?: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    };
  };
  /** 禁用的 Agent 运行模式；传入后模式切换器隐藏 */
  disabledModes?: AgentMode[];
  /**
   * 消息列表为空时，在 Sender 上方渲染的自定义内容。
   * 对应 ChatPanelProps.renderEmpty。
   */
  renderEmpty?: () => React.ReactNode;
  /** 是否让 ChatPanel 的消息滚动容器包含 Sender 区域。 */
  scrollWithSender?: boolean;
  /** ChatPanel 工具消息展示形态。 */
  messagesRenderVariant?: ChatPanelProps["messagesRenderVariant"];
  /** ChatPanel messages 专用 Markdown 扩展配置。 */
  markdownit?: ChatPanelProps["markdownit"];
  /** 在 Sender 下方渲染的自定义内容。 */
  renderSenderFooter?: () => React.ReactNode;
  /** 在右侧 Inspector 上方渲染的自定义操作区。 */
  renderRightPanelActions?: (params: { agent: CodeAgent | null }) => React.ReactNode;
  /** 自动断言；返回 null 表示等待用户运行或异步流程尚未到达可判定状态。 */
  assertions?: TestCaseAssertion[];
  /**
   * 特殊 playground 展示布局。
   * 默认走原始调试布局；chat-panel-skin 只展示皮肤预览用 ChatPanel。
   */
  playgroundLayout?: "chat-panel-skin" | "tool-contract";
  /** ChatPanel 皮肤预览模式；default 不注入变量，custom 注入 demo 变量。 */
  chatPanelSkin?: "default" | "custom";
  /** ChatPanel 超长历史折叠配置 */
  historyCollapse?: {
    maxIters?: number;
  };
  /**
   * MockHistory 行为控制（测试历史加载状态）
   * - loadDelayMs： load() 延迟毫秒数，模拟慢加载
   * - loadError：若为 true， load() 直接抛异常，模拟加载失败
   * - pageDelayMs：loadTurns()（翻页）延迟毫秒数，模拟按需加载慢响应
   * - supportsPagination：是否实现 loadTurns()，默认 true
   * - persistMode：历史持久化粒度，默认 turn
   */
  historyOptions?: {
    loadDelayMs?: number;
    loadError?: boolean;
    pageDelayMs?: number;
    supportsPagination?: boolean;
    persistMode?: HistoryPersistMode;
  };
  /**
   * 是否将模式 / 模型选择器渲染在输入框上方。
   * 对应 ChatPanelProps.selectorRenderInTop。
   */
  selectorRenderInTop?: boolean;
  /**
   * 附件前置处理器列表。
   * 对应 ChatPanelProps.attachProcessors，可在 case 中传入自定义处理器以测试文件上传行为。
   */
  attachProcessors?: AttachProcessor[];
  /**
   * 自定义 mention 注册源。
   * 对应 ChatPanelProps.mentions。
   */
  mentions?: MentionProvider[];
  /**
   * 在 Sender 附件 / + 按钮之后渲染自定义内容。
   * 对应 ChatPanelProps.renderAttachmentSuffix。
   */
  renderAttachmentSuffix?: ChatPanelProps["renderAttachmentSuffix"];
  /**
   * 在 Sender 输入框上方渲染自定义 focus 内容。
   * 对应 ChatPanelProps.renderFocus。
   */
  renderFocus?: ChatPanelProps["renderFocus"];
  /**
   * 消息操作栏按钮配置。
   * 对应 ChatPanelProps.actionBar。
   */
  actionBar?: ChatPanelProps["actionBar"];
}
