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

import type { AgentHooks, ChatChipInstance } from "../../../agent/src";

/** 沙箱 hooks，即 AgentHooks */
export type Hooks = AgentHooks;

/**
 * Chat chip 被用户从 Sender 中移除时触发的回调。
 */
export type ChatChipRemoveHandler = (chip: ChatChipInstance) => void;

/**
 * 按 ChatChipInstance.type 注册的 remove 回调集合。
 */
export type ChatChipRemoveHandlers = Record<string, ChatChipRemoveHandler>;

/**
 * window._registSandBox_ 的第二个参数。
 */
export interface RegistSandBoxConfig {
  designer: Designer;
  hooks?: Hooks;
  /**
   * 按 chip type 注册用户手动移除 chip 时的回调。
   * 通过 window._sandbox_.connectToAI 注册；重复注册同 type 会覆盖旧回调。
   */
  chipRemoveHandlers?: ChatChipRemoveHandlers;
}
