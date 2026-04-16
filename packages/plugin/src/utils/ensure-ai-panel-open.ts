import { context } from "../context";

/**
 * 确保 AI 对话面板已打开，resolve 后再发送消息，
 * 避免 ChatPanel 尚未挂载/订阅事件时 turn:start 被丢失。
 *
 * TODO: _showAIDialog_ 目前由组件库的钩子挂载到 window，
 *       后续应改为由插件层统一提供，避免依赖组件副作用。
 */
export function ensureAIPanelOpen(comId: string): Promise<void> {
  // _showAIDialog_ 由 ChatPanelList 组件挂载到 window
  ;(window as any)._showAIDialog_?.(comId);
  return new Promise((resolve) => setTimeout(resolve, 500));
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
