import React, { createContext, useContext } from "react";
import type { MessageRecord } from "../use-session";

interface User {
  name?: string;
  avatar?: string;
}

interface ChatPanelContextValue {
  /** 用户信息（头像、名称），用于消息气泡展示 */
  user?: User;
  /** AI 助手信息（头像、名称），用于消息气泡展示 */
  copilot?: User;
  /**
   * 当前面板是否被禁用（由 ChatPanelProps.disabled 与 agent 状态决定）。
   * 禁用时 Sender 不可输入，SuggestionsBlock 不可点击。
   */
  disabled: boolean;
  /** 用户消息的自定义渲染函数 */
  renderUserMessage?: (record: MessageRecord) => React.ReactNode;
}

const ChatPanelContext = createContext<ChatPanelContextValue>({
  disabled: false,
});

/** 在 ChatPanel 根节点注入面板级上下文 */
export const ChatPanelProvider = ChatPanelContext.Provider;

/** 在 ChatPanel 内任意子组件中消费面板级上下文 */
export const useChatPanel = () => useContext(ChatPanelContext);
