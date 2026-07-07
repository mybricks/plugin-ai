import React, { useState } from "react";
import css from "./index.less";

// ─── Line-style Icons (stroke, rounded) ──────────────────────────────────────

const ACTION_ICON_COLOR = "#333";
const ACTION_ICON_ACTIVE_COLOR = "#fa6400";

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={ACTION_ICON_COLOR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CopyDoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={ACTION_ICON_ACTIVE_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={ACTION_ICON_COLOR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const RetryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke={ACTION_ICON_COLOR} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
  </svg>
);

// ─── ActionBarButton ───────────────────────────────────────────────────────────

interface ActionBarButtonProps {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
  active?: boolean;
}

const ActionBarButton = ({ onClick, title, disabled, children, active }: ActionBarButtonProps) => (
  <button
    className={`${css["action-bar-btn"]}${active ? ` ${css["action-bar-btn--active"]}` : ""}`}
    onClick={onClick}
    title={title}
    disabled={disabled}
    type="button"
  >
    {children}
  </button>
);

// ─── ActionBar.Copy ───────────────────────────────────────────────────────────

interface CopyProps {
  text: string;
}

const Copy = ({ text }: CopyProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ActionBarButton onClick={handleCopy} title={copied ? "已复制" : "复制"} active={copied}>
      {copied ? <CopyDoneIcon /> : <CopyIcon />}
    </ActionBarButton>
  );
};

// ─── ActionBar.Delete ─────────────────────────────────────────────────────────

interface DeleteProps {
  onDelete: () => void;
}

const DeleteBtn = ({ onDelete }: DeleteProps) => (
  <ActionBarButton onClick={onDelete} title="删除">
    <DeleteIcon />
  </ActionBarButton>
);

// ─── ActionBar.Retry ──────────────────────────────────────────────────────────

interface RetryProps {
  onRetry: () => void;
  disabled?: boolean;
}

const Retry = ({ onRetry, disabled }: RetryProps) => (
  <ActionBarButton onClick={onRetry} title="重试" disabled={disabled}>
    <RetryIcon />
  </ActionBarButton>
);

// ─── ActionBar ────────────────────────────────────────────────────────────────

interface ActionBarProps {
  children: React.ReactNode;
  endTime?: string;
}

const ActionBar = ({ children, endTime }: ActionBarProps) => (
  <div className={css["action-bar"]}>
    {children}
    {endTime ? <span className={css["action-bar-end-time"]}>{endTime}</span> : null}
  </div>
);

ActionBar.Copy = Copy;
ActionBar.Delete = DeleteBtn;
ActionBar.Retry = Retry;

export { ActionBar };
