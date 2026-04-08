import type { CodeAgent } from "@plugin-ai/agent";
import type { SandboxAdapter } from "@plugin-ai/agent";
import { AIRequestQueue } from "./queue";

/** plugin 提供给沙箱的上下文（设计器能力） */
export interface PluginContext {
  /** 通知设计器进度 */
  onProgress?: (status: any) => void;
  /** 获取当前聚焦区域信息，调用时机由组件自决 */
  getFocusArea?: () => any;
}

/** 沙箱注册信息 */
export interface SandboxEntry {
  adapter: SandboxAdapter;
  pluginContext: PluginContext;
}

class Context {
  /** UI 显示名称 */
  name: string = "智能助手";

  /** 当前聚焦元素 */
  currentFocus?: AiServiceFocusParams;

  /** plugin 初始化参数 */
  pluginParams: any = {};

  /** 事件总线 */
  events = new (class {
    private listeners: Record<string, Function[]> = {};
    on(event: string, handler: Function) {
      (this.listeners[event] ??= []).push(handler);
      return () => {
        this.listeners[event] = this.listeners[event].filter(h => h !== handler);
      };
    }
    emit(event: string, data?: any) {
      (this.listeners[event] ?? []).forEach(h => h(data));
    }
  })();

  /**
   * comId → CodeAgent 映射
   * agent 在 plugin 侧统一管理，保证按 comId 复用
   */
  agentMap = new Map<string, CodeAgent>();

  /**
   * comId → SandboxEntry 映射
   * 组件通过 window._configSandBox_ 注册沙箱能力
   */
  sandboxMap = new Map<string, SandboxEntry>();

  /** AI 请求队列（防并发 + loading 状态管理） */
  aiQueue = new AIRequestQueue();
}

export const context = new Context();
