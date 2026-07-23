import React, { useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import css from "./index.less";

export interface ModalProps {
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 弹窗标题，可以是文字或自定义 ReactNode */
  title?: React.ReactNode;
  /** 弹窗底部，传 null 表示不渲染 footer */
  footer?: React.ReactNode;
  /** 弹窗内容 */
  children: React.ReactNode;
  /** 弹窗宽度，默认 640 */
  width?: number | string;
  /** 自定义 className */
  className?: string;
  /** 是否点击遮罩关闭，默认 true */
  maskClosable?: boolean;
  /** 是否按 Esc 关闭，默认 true */
  escClosable?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  footer,
  children,
  width = 640,
  className,
  maskClosable = true,
  escClosable = true,
}) => {
  // Esc 关闭
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (escClosable && e.key === "Escape") {
        onClose();
      }
    },
    [escClosable, onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div
      className={css.overlay}
      onClick={maskClosable ? onClose : undefined}
    >
      <div
        className={classNames(css.modal, className)}
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className={css.header}>
            <div className={css.title}>{title}</div>
            <div
              className={css.closeButton}
              onClick={onClose}
              title="关闭"
            >
              <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
                <path d="M557.312 513.248l265.28-263.904c12.544-12.48 12.608-32.704 0.128-45.248-12.512-12.576-32.704-12.608-45.248-0.128L512.128 467.904 246.944 203.936c-12.48-12.544-32.704-12.608-45.248-0.128-12.576 12.512-12.608 32.704-0.128 45.248l265.216 263.84L201.6 776.8c-12.544 12.48-12.608 32.704-0.128 45.248 6.24 6.272 14.464 9.44 22.688 9.44 8.16 0 16.32-3.104 22.56-9.312l265.216-263.872 265.152 263.872c6.24 6.208 14.4 9.312 22.56 9.312 8.224 0 16.448-3.168 22.688-9.44 12.48-12.544 12.416-32.768-0.128-45.248L557.312 513.248z" fill="currentColor" />
              </svg>
            </div>
          </div>
        )}
        <div className={css.body}>{children}</div>
        {footer !== undefined && footer !== null && (
          <div className={css.footer}>{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};
