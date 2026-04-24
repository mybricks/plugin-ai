import type { CodeAgent, Sandbox } from "../../../agent/src";
import type { Designer, Hooks } from "../sandbox/types";
import { AIRequestQueue } from "./queue";
import type { LLMProviders } from "../../../request/src";

/** LLM 设置值类型（避免循环依赖） */
export interface SettingValue {
  channel?: "infra" | "mybricks" | "custom";
  providers?: Array<{
    format: "openai" | "anthropic";
    providerId: string;
    baseUrl: string;
    apiKey: string;
    models: Array<{ id: string; name: string }>;
  }>;
}

/** 沙箱注册信息 */
export interface SandboxEntry {
  sandbox: Sandbox;
  /** designer ref，供 check-status 工具闭包访问（延迟绑定） */
  designerRef?: { current: Designer | undefined };
  /** hooks ref，供 beforeTurn / beforeRequest 闭包访问（延迟绑定） */
  hooksRef?: { current: Hooks | undefined };
}

class Context {
  /** UI 显示名称 */
  name: string = "智能助手";

  /** 插件命名空间 key，用于 agentKey 拼接 */
  private _pluginKey: string = "";

  setPluginKey(key: string) {
    this._pluginKey = key;
  }

  /**
   * 根据 comId 生成 agentKey。
   * 不传 comId 时，从 currentFocus 中自动取。
   */
  getAgentKey(comId?: string): string {
    const id = comId ?? this.currentFocus?.comId ?? this.currentFocus?.pageId ?? "";
    return this._pluginKey + "_" + id;
  }

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
   * 组件通过 window._registSandBox_ 注册沙箱能力
   */
  sandboxMap = new Map<string, SandboxEntry>();

  /** AI 请求队列（防并发 + loading 状态管理） */
  aiQueue = new AIRequestQueue();

  /** LLM 配置值 */
  settingValue?: SettingValue;

  /** LLMProviders 实例（自定义渠道时使用） */
  llmProviders?: LLMProviders;

  /** 设置 LLMProviders 实例 */
  setLLMProviders(providers: LLMProviders | undefined) {
    this.llmProviders = providers;
  }
}

export const context = new Context();
