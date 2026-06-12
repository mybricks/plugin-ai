import React, { useState } from "react";
import classNames from "classnames";
import { Popup } from "../popup";
import { AgentModeEnum } from "../../../../../agent/src";
import css from "./index.less";

// build = 智能（默认执行）| plan = 计划（先规划再执行）
export type ChatModeType = typeof AgentModeEnum.Build | typeof AgentModeEnum.Plan | null;

const CHAT_MODE_MAP: Record<
  NonNullable<ChatModeType>,
  { triggerTitle: string; title: string; description: string }
> = {
  [AgentModeEnum.Build]: {
    triggerTitle: "智能",
    title: "智能模式",
    description: "模型智能执行，快速交付任务",
  },
  [AgentModeEnum.Plan]: {
    triggerTitle: "计划",
    title: "计划模式",
    description: "执行前先制定方案，再决定是否执行",
  },
};

const ChatModeIcon = ({ mode }: { mode: NonNullable<ChatModeType> }) => (
  mode === AgentModeEnum.Build ? (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" fill="currentColor" stroke="currentColor" strokeWidth="0.3" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 4h11M2.5 8h7M2.5 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
);

interface ChatModeProps {
  disabled?: boolean;
  chatMode: ChatModeType;
  onChange?: (chatMode: ChatModeType) => void;
}

const ChatMode = (props: ChatModeProps) => {
  const { chatMode, disabled, onChange } = props;
  const [open, setOpen] = useState(false);

  if (!chatMode) {
    return null;
  }

  const current = CHAT_MODE_MAP[chatMode];

  return (
    <Popup
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      placement="top-start"
      trigger={
        <div 
          className={classNames(css.trigger, { 
            [css.disabled]: disabled,
          })}
        >
          <span className={classNames(css.iconSlot, { [css.agentIconSlot]: chatMode === AgentModeEnum.Build })}>
            <ChatModeIcon mode={chatMode} />
          </span>
          <span className={css.triggerText}>{current.triggerTitle}</span>
          <svg className={css.arrow} viewBox="0 0 1024 1024" width="10" height="10" fill="currentColor">
            <path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" />
          </svg>
        </div>
      }
    >
      <div className={css.menu}>
        {(Object.keys(CHAT_MODE_MAP) as NonNullable<ChatModeType>[]).map((key) => {
          const item = CHAT_MODE_MAP[key];
          const isSelected = chatMode === key;
          return (
            <div
              key={key}
              className={classNames(css.item, { [css.selected]: isSelected })}
              onClick={() => {
                onChange?.(key);
                setOpen(false);
              }}
            >
              <div className={css.itemContent}>
                <div className={css.itemTitle}>
                  <span className={css.itemIcon}>
                    <ChatModeIcon mode={key} />
                  </span>
                  <span>{item.title}</span>
                </div>
                <div className={css.itemDesc}>{item.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Popup>
  );
};

export { ChatMode };
