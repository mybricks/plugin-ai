import React, { useCallback, useEffect, useRef, useState } from "react";
import classNames from "classnames";
import { Popup } from "../popup";
import { handleListNavigationKeyDown } from "../menu-keyboard";
import { AgentModeEnum } from "../../../../../agent/src";
import css from "./index.less";

// build = 智能体（默认执行）| plan = 计划（先规划再执行）| ask = 询问（先澄清再决定）
export type ChatModeType = typeof AgentModeEnum.Build | typeof AgentModeEnum.Plan | typeof AgentModeEnum.Ask | null;

const CHAT_MODE_MAP: Record<
  NonNullable<ChatModeType>,
  { triggerTitle: string; title: string; description: string }
> = {
  [AgentModeEnum.Build]: {
    triggerTitle: "智能体模式",
    title: "智能体模式",
    description: "模型智能执行，快速交付任务",
  },
  [AgentModeEnum.Plan]: {
    triggerTitle: "计划",
    title: "计划模式",
    description: "执行前先制定方案，再决定是否执行",
  },
  [AgentModeEnum.Ask]: {
    triggerTitle: "询问",
    title: "询问模式",
    description: "先澄清并质询关键决策，不创建计划或修改项目",
  },
};

const CHAT_MODE_OPTIONS = Object.keys(CHAT_MODE_MAP) as NonNullable<ChatModeType>[];

/** 莫比乌斯环图标（∞，横着的8），线条流动动画 */
const MobiusIcon = () => (
  <svg viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 左叶片 */}
    <path
      d="M12 6C10.5 3.5 8.5 2 6.5 2C4 2 2.5 3.8 2.5 6C2.5 8.2 4 10 6.5 10C8.5 10 10.5 8.5 12 6Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 右叶片 */}
    <path
      d="M12 6C13.5 8.5 15.5 10 17.5 10C20 10 21.5 8.2 21.5 6C21.5 3.8 20 2 17.5 2C15.5 2 13.5 3.5 12 6Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 计划模式图标（列表） */
const PlanIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 4h11M2.5 8h7M2.5 12h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/** 询问模式图标（对话气泡） */
const AskIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 3.5h10v7H7l-3 2v-2H3v-7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M5.5 6.75h.01M8 6.75h.01M10.5 6.75h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

export const ChatModeIcon = ({ mode }: { mode: NonNullable<ChatModeType> }) => (
  mode === AgentModeEnum.Build ? <MobiusIcon /> : mode === AgentModeEnum.Plan ? <PlanIcon /> : <AskIcon />
);

interface ChatModeProps {
  disabled?: boolean;
  chatMode: ChatModeType;
  onChange?: (chatMode: ChatModeType) => void;
}

const ChatMode = (props: ChatModeProps) => {
  const { chatMode, disabled, onChange } = props;
  const [open, setOpen] = useState(false);
  const [highlightedMode, setHighlightedMode] = useState<NonNullable<ChatModeType>>(chatMode ?? AgentModeEnum.Build);
  const highlightedModeRef = useRef(highlightedMode);

  const updateHighlightedMode = useCallback((mode: NonNullable<ChatModeType>) => {
    highlightedModeRef.current = mode;
    setHighlightedMode(mode);
  }, []);

  const selectMode = useCallback((mode: NonNullable<ChatModeType>) => {
    onChange?.(mode);
    setOpen(false);
  }, [onChange]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen && chatMode) updateHighlightedMode(chatMode);
    setOpen(nextOpen);
  }, [chatMode, updateHighlightedMode]);

  useEffect(() => {
    if (!open || !chatMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      handleListNavigationKeyDown(event, {
        open,
        items: CHAT_MODE_OPTIONS,
        highlightedIndex: highlightedModeRef.current,
        onMoveHighlight: (step, itemCount) => {
          const currentIndex = Math.max(0, CHAT_MODE_OPTIONS.indexOf(highlightedModeRef.current));
          updateHighlightedMode(CHAT_MODE_OPTIONS[(currentIndex + step + itemCount) % itemCount]);
        },
        onSelect: selectMode,
        onClose: () => setOpen(false),
      });
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [chatMode, open, selectMode, updateHighlightedMode]);

  if (!chatMode) {
    return null;
  }

  const current = CHAT_MODE_MAP[chatMode];

  return (
    <Popup
      open={open}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      placement="top-start"
      trigger={
        <div
          className={classNames(css.trigger, {
            [css.disabled]: disabled,
            [css.triggerBuild]: chatMode === AgentModeEnum.Build,
          })}
          title={current.triggerTitle}
        >
          <span className={classNames(css.iconSlot, { [css.agentIconSlot]: chatMode === AgentModeEnum.Build })}>
            <ChatModeIcon mode={chatMode} />
          </span>
          <svg className={css.arrow} viewBox="0 0 1024 1024" width="10" height="10" fill="currentColor">
            <path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z" />
          </svg>
        </div>
      }
    >
      <div className={css.menu} role="listbox" aria-label="选择模式">
        {CHAT_MODE_OPTIONS.map((key) => {
          const item = CHAT_MODE_MAP[key];
          const isSelected = chatMode === key;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={classNames(css.item, {
                [css.selected]: isSelected,
                [css.highlighted]: highlightedMode === key,
              })}
              onMouseMove={() => updateHighlightedMode(key)}
              onClick={() => selectMode(key)}
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
            </button>
          );
        })}
      </div>
    </Popup>
  );
};

export { ChatMode };
