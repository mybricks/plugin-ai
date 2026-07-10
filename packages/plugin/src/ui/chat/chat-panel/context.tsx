import React, { createContext, useContext } from "react";
import type { MessageRecord } from "../use-session";

interface User {
  name?: string;
  avatar?: string;
}

/**
 * Markdown 皮肤配置。
 * 外部可通过 ChatPanel 的 markdownSkin prop 自定义每种场景的 class 名。
 * 不传时各场景自动使用内置默认皮肤。
 */
export interface MarkdownSkinConfig {
  /**
   * AI 消息内容的 markdown 皮肤 class 名。
   * 默认：css["markdown-skin-message"]（来自 skin-message.less）
   */
  message?: string;
  /**
   * 计划卡片 body 的 markdown 皮肤 class 名。
   * 默认：css["markdown-skin-plan"]（来自 skin-plan.less）
   */
  plan?: string;
}

export type MessagesRenderVariant = "card" | "line";

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
  /**
   * Markdown 皮肤配置，允许外部覆盖消息 / plan 场景的皮肤 class。
   * 不传时使用内置默认皮肤。
   */
  markdownSkin?: MarkdownSkinConfig;
  /** 消息内工具调用的展示形态，默认 card。 */
  messagesRenderVariant: MessagesRenderVariant;
}

const ChatPanelContext = createContext<ChatPanelContextValue>({
  disabled: false,
  messagesRenderVariant: "card",
});

/** 在 ChatPanel 根节点注入面板级上下文 */
export const ChatPanelProvider = ChatPanelContext.Provider;

/** 在 ChatPanel 内任意子组件中消费面板级上下文 */
export const useChatPanel = () => useContext(ChatPanelContext);
