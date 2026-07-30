import React, { useEffect, useRef, useState } from "react";
import { Sender, SenderRef, SenderProps } from "../../components/sender";
import { context } from "../../../context";
import { chipRegistry } from "../../../sandbox/setup";
import type { ChatChipDef } from "../../../../../agent/src";
import { ensureAIPanelOpen } from "../../../utils/ensure-ai-panel-open";
import { createDomChip, DOM_CHIP_TYPE, formatDomChipMessage, matchDefaultDomFocusContent } from "../../../utils/dom-info";
import css from "./index.less";

export interface ChatFocusViewProps {
  /** 上传文件回调，不传则回退到 context.pluginParams.onUpload */
  onUpload?: (file: File) => Promise<string>;
  /** 占位符文案 */
  placeholder?: string;
}

// ─── dom chip 类型定义 ────────────────────────────────────────────────────────

/**
 * dom chip：代表当前聚焦的 DOM 元素。
 * - 无自定义 render，使用默认 chip 样式（label 文字）。
 * - format：提取 DOM 类名、代码位置与结构摘要，供 LLM 理解上下文。
 *
 * chip 实例的 data 字段格式：{ ele?: HTMLElement }
 */
const domChipDef: ChatChipDef = {
  type: DOM_CHIP_TYPE,
  // 不传 render：使用默认 chip 样式（图标 + label）
  format: formatDomChipMessage,
};

// 模块加载时一次性注册（chipRegistry 是单例，重复 register 同 type 会覆盖，幂等安全）
chipRegistry.register(domChipDef);

/**
 *
 * 无需传入 comId，内部订阅 focus 事件，跟随 context.currentFocus 动态感知当前聚焦元素。
 *
 * 在标准 Sender 基础上，通过 renderActionPrefix 扩展插槽
 * 在发送按钮左侧添加「追加到对话」按钮。
 *
 * - 「发送」：直接发起 AI 请求（同 chat-start-view 行为）
 * - 「追加到对话」：将当前输入框文本追加到 chat-panel 的输入框中，
 *    供用户在对话框里进一步编辑或批量积累后再发送
 *
 * 注意：附件暂不支持追加到对话框，仅在直接发送时携带。
 * TODO: 实现附件追加链路（appendInput 目前只支持文本和 SendToAgentParams）
 */
const ChatFocusView = ({
  onUpload,
  placeholder = "描述需求，追加到对话批量处理或者立即发送",
}: ChatFocusViewProps) => {
  const senderRef = useRef<SenderRef>(null);

  // 跟随 focus 事件动态解析当前聚焦的 comId 和 agent
  const [focusParams, setFocusParams] = useState<AiServiceFocusParams | undefined>(
    () => context.currentFocus
  );

  useEffect(() => {
    const unsub = context.events.on("focus", (params: AiServiceFocusParams) => {
      setFocusParams(params);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => senderRef.current?.focus());
    return () => clearTimeout(timer);
  }, [focusParams]);

  const comId = focusParams?.comId ?? focusParams?.pageId;
  const agentKey = comId ? context.getAgentKey(comId) : "";
  const agent = comId ? context.agentMap.get(agentKey) : undefined;

  const onSend: SenderProps["onSend"] = (params) => {
    if (!agent || !comId) return;
    const { message, attachments, chips } = params;
    const focusChip = focusParams?.focusArea?.ele ? createDomChip(focusParams) : undefined;
    const requestMessage = focusChip ? `对于[[chip:${focusChip.id}]]${message}` : message;
    const requestChips = [...(focusChip ? [focusChip] : []), ...(chips ?? [])];
    const meta = requestChips.length ? { chips: requestChips } : undefined;

    ensureAIPanelOpen(comId).then(() => {
      context.aiQueue.send(
        agentKey,
        async () => {
          context.aiQueue.registerAbort(agentKey, () => agent.abort());
          // focus-view 立即发送，不传 mode 即走默认 Build 模式
          await agent.requestAI({ message: requestMessage, attachments, ...(meta ? { meta } : {}) });
        },
        { message: requestMessage, attachments: params.attachments, ...(meta ? { meta } : {}) }
      );
    });
  };

  const onAppendToChat = (event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!comId) return;
    const input = senderRef.current?.getInput();
    const message = input?.message ?? "";
    if (!message.trim()) return;

    // 先确保 AI 面板已打开，再插入 chip + 文本
    ensureAIPanelOpen(comId).then(() => {
      const chip = createDomChip(focusParams);
      const suffix = message.trim() ? `${message}` : "";
      const panelInput = context.getInput(comId);
      const isPanelDefaultFocusContent = panelInput ? matchDefaultDomFocusContent({
        message: panelInput.message,
        chips: panelInput.chips,
      }) : false;
      const prefix = panelInput?.message?.trim() && !isPanelDefaultFocusContent ? "\n" : "";

      // appendInput 内部会解析 [[chip:id]] 并从 meta.chips 取实例渲染成 chip span
      context.appendInput(comId, {
        message: `${prefix}对于[[chip:${chip.id}]]${suffix}；`,
        meta: { chips: [chip] },
        animation: true,
      });
    });

    // 清空输入框，方便用户继续追加更多内容
    senderRef.current?.clear();
  };

  const renderActionPrefix: SenderProps["renderActionPrefix"] = ({ hasInput }) => (
    <button
      className={css["append-btn"]}
      title={hasInput ? "追加到对话框，可与其他消息一起编辑后发送" : "请输入内容后再追加"}
      disabled={!hasInput}
      onClick={onAppendToChat}
    >
      <svg className={css["append-icon"]} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      追加到对话
    </button>
  );

  return (
    <Sender
      ref={senderRef}
      variant="bubble"
      onSend={onSend}
      placeholder={placeholder}
      onUpload={onUpload ?? context.pluginParams.onUpload}
      renderActionPrefix={renderActionPrefix}
      chipTypes={chipRegistry.getAll()}
      mentions={context.pluginParams.mentions}
    />
  );
};

/**
 * ComChatFocusView — 无需任何 props，完全从 context 自动感知聚焦状态
 */
const ComChatFocusView = (props: Partial<ChatFocusViewProps>) => {
  return <ChatFocusView {...props} />;
};

export { ChatFocusView, ComChatFocusView };
