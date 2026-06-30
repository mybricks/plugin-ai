import type { TurnRecord, AgentMode } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { ProviderConfig } from "@request/providers";
import type { Tool } from "@agent/types";
import type { SkillFile } from "@agent/code-agent";
import type { FsFile } from "../lib/mem-fs";
import type React from "react";

export type Priority = "P0" | "P1" | "P2";

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
  request: RequestAsStreamFn;
  /** 预设 LLM 配置，用于测试模型选择器和模型切换 */
  llm?: {
    providers?: ProviderConfig[];
  };
  tools?: Tool[];
  /** 预设技能文件列表，传入 CodeAgent.skills */
  skills?: SkillFile[];
  maskOptions?: {
    maxTurns?: number;
    maxAgeMinutes?: number;
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
  /** 在 Sender 下方渲染的自定义内容。 */
  renderSenderFooter?: () => React.ReactNode;
  /**
   * 特殊 playground 展示布局。
   * 默认走原始调试布局；chat-panel-skin 只展示皮肤预览用 ChatPanel。
   */
  playgroundLayout?: "chat-panel-skin";
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
   */
  historyOptions?: {
    loadDelayMs?: number;
    loadError?: boolean;
  };
  /**
   * 是否将模式 / 模型选择器渲染在输入框上方。
   * 对应 ChatPanelProps.selectorRenderInTop。
   */
  selectorRenderInTop?: boolean;
}
