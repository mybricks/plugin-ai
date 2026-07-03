import { useEffect } from "react";
import { context } from "../context";

// ─── ChatPanelList 就绪状态（模块级闭包）────────────────────────────────────────

/** ChatPanelList 是否已 mounted 并完成事件监听注册 */
let _ready = false;

/** 等待 ready 的 pending resolvers 队列 */
let _pendingResolvers: Array<() => void> = [];

/**
 * 在 ChatPanelList 内调用，自动在 mount 时标记就绪、unmount 时重置。
 * 所有通过 ensureAIPanelOpen 排队等待的调用方将在 mount 完成后依次 resolve。
 */
export function useAIPanelReady() {
  useEffect(() => {
    _ready = true;
    const resolvers = _pendingResolvers;
    _pendingResolvers = [];
    resolvers.forEach(resolve => resolve());

    return () => {
      _ready = false;
    };
  }, []);
}

/**
 * 确保 AI 对话面板已打开且 ChatPanelList 已 mounted。
 *
 * - 先调用 _showAIDialog_ 触发面板渲染（如果未打开）
 * - 若 ChatPanelList 已 mounted，立即 resolve
 * - 否则排队等待 useAIPanelReady 通知后再 resolve，
 *   避免 appendInput 等事件在监听器注册前被丢弃
 */
export function ensureAIPanelOpen(comId: string): Promise<void> {
  // 先触发面板显示，让 ChatPanelList 开始渲染
  ;(window as any)._showAIDialog_?.(comId);

  if (_ready) return Promise.resolve();

  // ChatPanelList 尚未 mounted，排队等待
  return new Promise<void>(resolve => {
    _pendingResolvers.push(resolve);
  });
}

/**
 * 确保指定组件获得焦点
 * 通过 context.currentFocus 设置焦点信息
 */
export function ensureFocusComId(comId: string): Promise<void> {
  if (context?.currentFocus) {
    return Promise.resolve()
  }

  const mockFocus = {
    comId,
    title: "页面"
  };

  // 设置焦点信息，模拟 comId + title="页面" 的执行
  context.currentFocus = mockFocus
  context.events.emit("focus", mockFocus);
  return new Promise((resolve) => setTimeout(resolve, 0));
}
