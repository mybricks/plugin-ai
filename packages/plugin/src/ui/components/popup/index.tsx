import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";
import css from "./index.less";

interface PopupProps {
  /** 触发元素 */
  trigger: React.ReactNode;
  /** 弹出层内容 */
  children: React.ReactNode;
  /** 弹窗是否打开（受控） */
  open?: boolean;
  /** 打开状态改变时的回调 */
  onOpenChange?: (open: boolean) => void;
  /** 弹出位置，支持上/下。暂实现简单的 top / bottom-start 对齐方式 */
  placement?: 'top' | 'top-start' | 'bottom' | 'bottom-start';
  /** 弹窗距离 trigger 的 offset，默认 4px */
  offset?: number;
  /** 是否禁用弹窗 */
  disabled?: boolean;
  /** 自定义外层容器类名 */
  overlayClassName?: string;
  /** 自定义触发层类名 */
  className?: string;
  /** 虚拟锚点位置；传入时弹层按该 rect 定位，trigger 仍负责点击和 CSS 变量继承 */
  anchorRect?: DOMRect | null;
}

export const Popup = (props: PopupProps) => {
  const {
    trigger,
    children,
    open = false,
    onOpenChange,
    placement = 'top-start',
    offset = 4,
    disabled = false,
    overlayClassName,
    className,
    anchorRect
  } = props;

  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, flip: false, visible: false });
  const [cssVars, setCssVars] = useState<React.CSSProperties>({});

  const syncCssVariables = useCallback(() => {
    if (!triggerRef.current) return;
    const computed = window.getComputedStyle(triggerRef.current);
    const next: Record<string, string> = {};

    for (let i = 0; i < computed.length; i += 1) {
      const name = computed.item(i);
      if (name.startsWith("--mybricks-") || name.startsWith("--chat-")) {
        const value = computed.getPropertyValue(name).trim();
        if (value) {
          next[name] = value;
        }
      }
    }

    setCssVars(next as React.CSSProperties);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    syncCssVariables();
    const rect = anchorRect ?? triggerRef.current.getBoundingClientRect();
    const vpHeight = window.innerHeight;
    const popupHeight = popupRef.current?.offsetHeight ?? 0;
    
    // 如果是 top 系列，默认往上弹；如果是 bottom 系列，默认往下弹
    const isTopPlacement = placement.startsWith('top');
    
    // 如果上方空间不够，且下方空间充足，则翻转往下弹
    // 如果下方空间不够，且上方空间充足，则翻转往上弹
    const spaceAbove = rect.top;
    const spaceBelow = vpHeight - rect.bottom;
    
    let flip = false;
    let finalTop = 0;

    if (isTopPlacement) {
      if (spaceAbove < popupHeight + offset && spaceBelow > popupHeight + offset) {
        // 向上空间不够，往下翻转
        flip = true;
        finalTop = rect.bottom + offset;
      } else {
        // 正常向上
        finalTop = rect.top - offset;
      }
    } else {
      if (spaceBelow < popupHeight + offset && spaceAbove > popupHeight + offset) {
        // 向下空间不够，往上翻转
        flip = true;
        finalTop = rect.top - offset;
      } else {
        // 正常向下
        finalTop = rect.bottom + offset;
      }
    }
    
    // 横向对齐方式
    let finalLeft = rect.left;
    if (placement.endsWith('start')) {
      finalLeft = rect.left;
    } else {
      // 默认左右居中对齐
      const popupWidth = popupRef.current?.offsetWidth ?? 0;
      finalLeft = rect.left + rect.width / 2 - popupWidth / 2;
    }

    // 边界检测（防止横向超出屏幕）
    const popupWidth = popupRef.current?.offsetWidth ?? 0;
    if (finalLeft + popupWidth > window.innerWidth - 8) {
      finalLeft = window.innerWidth - popupWidth - 8;
    }
    if (finalLeft < 8) {
      finalLeft = 8;
    }

    const isFlippedUp = isTopPlacement ? !flip : flip;

    setPos({
      top: finalTop,
      left: finalLeft,
      width: rect.width,
      flip: isFlippedUp,
      visible: true
    });
  }, [placement, offset, open, syncCssVariables, anchorRect]);

  // 使用 useLayoutEffect 确保在渲染到屏幕前计算好位置，避免闪烁
  useLayoutEffect(() => {
    if (open) {
      // 初始计算可能没有 popupRef 高度，可以先计算一次，用 ResizeObserver 或者 setTimeout 再算一次
      updatePosition();
      const frameId = requestAnimationFrame(updatePosition);
      return () => cancelAnimationFrame(frameId);
    } else {
      setPos(prev => ({ ...prev, visible: false }));
    }
  }, [open, updatePosition, children]);

  // 处理点击外部关闭
  useEffect(() => {
    if (!open) return;
    
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && 
        !triggerRef.current.contains(target) &&
        popupRef.current && 
        !popupRef.current.contains(target)
      ) {
        onOpenChange?.(false);
      }
    };
    
    const handleScroll = (e: Event) => {
      // 如果是在 popup 内部滚动，不关闭也不重新计算位置
      if (popupRef.current?.contains(e.target as Node)) {
        return;
      }
      updatePosition();
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick, { capture: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { capture: true }); // capture 以便捕获所有滚动
    
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, { capture: true });
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open, onOpenChange, updatePosition]);

  return (
    <>
      <div 
        ref={triggerRef} 
        className={classNames(css.triggerContainer, className)}
        onClick={() => {
          if (!disabled) {
            onOpenChange?.(!open);
          }
        }}
      >
        {trigger}
      </div>
      {open && ReactDOM.createPortal(
        <div 
          ref={popupRef}
          data-zone-type="ai-fixed"
          className={classNames(
            css.popup, 
            { 
              [css.visible]: pos.visible,
              [css.flipUp]: pos.flip 
            },
            overlayClassName
          )}
          style={{
            ...cssVars,
            position: 'fixed',
            left: pos.left,
            // 如果向上弹，通过 bottom 定位，确保内容从底部开始撑开
            ...(pos.flip ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            zIndex: 99999
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
};
