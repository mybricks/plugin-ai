/**
 * Designer 接口：由组件库通过 window._registSandBox_ 注入。
 * 同时提供文件系统操作和设计器实时状态能力。
 */
export interface Designer {
  // ── 文件系统 ────────────────────────────────────────────────────────────────
  getFiles(): Promise<Array<{ path: string; content: string }>>;
  /**
   * 写入文件，失败时 reject（抛出错误）。
   */
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 删除文件，失败时 reject（抛出错误）。
   */
  deleteFiles(paths: string[]): Promise<void>;
  // ── 设计器状态 ───────────────────────────────────────────────────────────────
  /**
   * 获取设计器实时渲染状态并格式化为 Markdown。
   */
  exportDesignerToMessage(): Promise<string>;
  /**
   * 获取运行日志并格式化为 Markdown。
   */
  exportLogsToMessage(): string;
  /**
   * 实时获取当前 runtimeMode（`${comId}_edit` / `${comId}_runtime_mock` 等）。
   */
  getRuntimeMode(): string | undefined;
  /**
   * 获取当前生效的类库文档，由 plugin 侧拼接进 getContext。
   */
  getEffectiveLibraries(): Array<{ name: string; version?: string; usage: string }> | Promise<Array<{ name: string; version?: string; usage: string }>>;
  /**
   * 导出当前项目的资源代码（如依赖列表、公共资源引用等），
   * 用于注入当前项目源码上下文。
   */
  exportResourceCode(): string;

}

import type { AgentHooks, ChatChipDef, ChatChipInstance } from "../../../agent/src";
import type { AgentSandbox } from "../../../agent/src";

/** 沙箱 hooks，即 AgentHooks */
export type Hooks = AgentHooks;

/**
 * Chat chip 被用户从 Sender 中移除时触发的回调。
 */
export type ChatChipRemoveHandler = (chip: ChatChipInstance) => void;

/**
 * 单个 chip 能力配置。
 */
export interface SandboxChipConfig {
  /** chip 类型标识，对应 ChatChipInstance.type / ChatChipDef.type */
  type: string;
  /** chip 定义；传入后会注册到全局 chipRegistry，支持自定义 chip 或覆盖内置 chip 定义 */
  def?: ChatChipDef;
  /** 用户手动从 Sender 移除该类型 chip 时触发 */
  onRemove?: ChatChipRemoveHandler;
}

export type SandboxChipRecordConfig = Omit<SandboxChipConfig, "type"> & { type?: string };

/**
 * connectToAI 支持的 chip 能力配置。
 * - 数组形式：每项必须显式提供 type
 * - Record 形式：key 作为默认 type，value.type 可覆盖 key
 */
export type SandboxChipsConfig = SandboxChipConfig[] | Record<string, SandboxChipRecordConfig>;

/**
 * window._registSandBox_ 的第二个参数。
 */
export interface RegistSandBoxConfig {
  /**
   * Legacy Designer FS contract. Existing component libraries may keep using
   * this property without changing their integration.
   */
  designer?: Designer;
  /**
   * New AgentSandbox contract. When supplied, CodeAgent uses its commands
   * (including structured grep) while the host continues to provide its
   * virtual-file and additional-directory overlays.
   */
  agentSandbox?: AgentSandbox;
  hooks?: Hooks;
  /**
   * 注册 chip 相关能力，支持自定义 chip 定义和内置/自定义 chip 的 remove 回调。
   */
  chips?: SandboxChipsConfig;
}
