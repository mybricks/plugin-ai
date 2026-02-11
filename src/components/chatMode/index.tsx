import React, { useState } from "react";
import { Dropdown } from "antd";
import css from "./index.less";
import { Agent, Vibe, Check } from "../icons";

export type ChatModeType = "agent" | "vibe" | null;

const CHAT_MODE_MAP: Record<
  NonNullable<ChatModeType>,
  { icon: React.ReactNode; title: string; shortcut?: string }
> = {
  agent: {
    icon: <Agent />,
    title: "Agent",
  },
  vibe: {
    icon: <Vibe />,
    title: "Vibe",
  },
};

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

  const overlay = (
    <div className={css.dropdown} role="menu">
      {(Object.keys(CHAT_MODE_MAP) as NonNullable<ChatModeType>[]).map((key) => {
        const item = CHAT_MODE_MAP[key];
        const isActive = chatMode === key;
        return (
          <div
            key={key}
            className={css.item}
            role="menuitem"
            onClick={() => {
              onChange?.(key);
              setOpen(false);
            }}
          >
            <span className={css.itemIcon}>{item.icon}</span>
            <span className={css.itemTitle}>{item.title}</span>
            {item.shortcut ? (
              <span className={css.itemShortcut}>{item.shortcut}</span>
            ) : null}
            {isActive ? (
              <span className={css.itemCheck} aria-hidden>
                <Check />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <Dropdown
      disabled={disabled}
      overlay={overlay}
      trigger={["click"]}
      visible={open}
      onVisibleChange={setOpen}
      getPopupContainer={(node) => node?.parentElement ?? document.body}
    >
      <button
        type="button"
        disabled={disabled}
        className={css.trigger}
      >
        <span className={css.triggerIcon}>{current.icon}</span>
        <span className={css.triggerTitle}>{current.title}</span>
      </button>
    </Dropdown>
  );
};

export { ChatMode };
