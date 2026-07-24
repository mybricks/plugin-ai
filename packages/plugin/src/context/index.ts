import type { SendToAgentParams } from "../sandbox";
import { AIRequestQueue } from "./queue";
import type { ProviderConfig } from "../../../request/src";
import type { SenderRef } from "../ui/components/sender";
import { PluginAIKVStore } from "./kv";

type SenderInputValue = ReturnType<SenderRef["getInput"]>;

/** LLM 设置值类型（避免循环依赖） */
export interface SettingValue {
  channel?: "infra" | "mybricks" | "custom";
  providers?: ProviderConfig[];
}

class Context {
  /** UI 显示名称 */
  name: string = "智能助手";

  /** 插件命名空间 key，用于 agentKey 拼接 */
  private _pluginKey: string = "";

  /** pluginAI KV 持久化层 */
  readonly kv = new PluginAIKVStore();

  setPluginKey(key: string) {
    this._pluginKey = key;
    this.kv.setNamespace(key);
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
  agentMap = new Map<string, any>();

  /** AI 请求队列（防并发 + loading 状态管理） */
  aiQueue = new AIRequestQueue();

  /** LLM 配置值 */
  settingValue?: SettingValue;

  /** 全局禁用输入框发送 */
  disabled: boolean = false;

  /** 设置全局禁用状态，并通过事件总线通知所有订阅组件 */
  setDisabled(value: boolean) {
    this.disabled = value;
    this.events.emit("disabled", value);
  }

  /**
   * 向指定 comId 的输入框追加内容。ChatPanelList 会负责确保面板存在。
   * - string / SendToAgentParams：纯文本追加
   * - { message, meta }：message 中可含 [[chip:id]] 占位符，meta.chips 提供实例数据
   */
  appendInput(comId: string, input: string | SendToAgentParams | { message: string; meta?: { chips?: import("../../../agent/src").ChatChipInstance[] }; animation?: boolean }) {
    this.events.emit("appendInput", { comId, input });
  }

  // ─── 输入框草稿读取 ────────────────────────────────────────────────────────

  /** 由 ChatPanelList 注册：comId → 输入框草稿 的同步 getter */
  private _inputGetter?: (comId?: string) => SenderInputValue | undefined;

  /** ChatPanelList mount 后注册 getter；unmount 时传 undefined 清空 */
  registerInputGetter(getter: ((comId?: string) => SenderInputValue | undefined) | undefined) {
    this._inputGetter = getter;
  }

  /**
   * 获取指定 comId 对话框的当前输入草稿（文本 + 附件 + mentions）。
   * 不传 comId 时返回当前活跃面板的草稿；面板不存在时返回 undefined。
   */
  getInput(comId?: string): SenderInputValue | undefined {
    return this._inputGetter?.(comId);
  }

  /** 插件启停覆盖值，用于影响后续新建的 CodeAgent 实例。 */
  private _pluginEnabledOverrides = new Map<string, boolean>();

  applyPluginEnabledOverrides<T extends { name: string; enabled?: boolean }>(plugins?: T[]): T[] | undefined {
    if (!plugins?.length || this._pluginEnabledOverrides.size === 0) return plugins;
    return plugins.map((plugin) => {
      const enabled = this._pluginEnabledOverrides.get(plugin.name);
      return enabled === undefined ? plugin : { ...plugin, enabled };
    });
  }

  /**
   * 启用插件：更新全局集合，并广播到所有已存在的 CodeAgent 实例。
   */
  enablePlugin(name: string) {
    this._pluginEnabledOverrides.set(name, true);
    for (const agent of this.agentMap.values()) {
      agent.enablePlugin?.(name);
    }
  }

  /**
   * 禁用插件：更新全局集合，并广播到所有已存在的 CodeAgent 实例。
   */
  disablePlugin(name: string) {
    this._pluginEnabledOverrides.set(name, false);
    for (const agent of this.agentMap.values()) {
      agent.disablePlugin?.(name);
    }
  }
}

export const context = new Context();
