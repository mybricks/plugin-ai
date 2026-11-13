/** Minimal event shape shared by native and React keyboard handlers. */
export interface MenuKeyboardEvent {
  key: string;
  preventDefault: () => void;
}

export interface ListNavigationOptions<T> {
  open: boolean;
  items: readonly T[];
  highlightedIndex: number;
  /** Move by direction; owners keep their own functional state update. */
  onMoveHighlight: (step: 1 | -1, itemCount: number) => void;
  onSelect: (item: T) => void | Promise<void>;
  onClose: () => void;
  /** Optional hierarchical navigation for menus that contain child options. */
  onEnterChild?: (item: T) => void | Promise<void>;
  /**
   * Whether the highlighted item actually has a child level to enter.
   * Defaults to always-true; without it, ArrowRight would swallow every
   * keystroke (even on leaf items) as soon as onEnterChild is supplied.
   */
  canEnterChild?: (item: T) => boolean;
  onLeaveChild?: () => void;
}

/**
 * Shared list-popup navigation: Escape closes, arrows move the highlighted
 * option, and Enter/Tab select it. Hierarchical menus can additionally supply
 * left/right callbacks to enter or leave a child option list.
 */
export function handleListNavigationKeyDown<T>(
  event: MenuKeyboardEvent,
  {
    open,
    items,
    highlightedIndex,
    onMoveHighlight,
    onSelect,
    onClose,
    onEnterChild,
    canEnterChild,
    onLeaveChild,
  }: ListNavigationOptions<T>,
): boolean {
  if (!open) return false;

  if (event.key === "Escape") {
    event.preventDefault();
    onClose();
    return true;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (items.length > 0) {
      onMoveHighlight(event.key === "ArrowDown" ? 1 : -1, items.length);
    }
    return true;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    const item = items[highlightedIndex];
    if (item) void onSelect(item);
    return true;
  }

  if (event.key === "ArrowRight" && onEnterChild) {
    const item = items[highlightedIndex];
    if (item && (!canEnterChild || canEnterChild(item))) {
      event.preventDefault();
      void onEnterChild(item);
      return true;
    }
    return false;
  }

  if ((event.key === "ArrowLeft" || event.key === "Backspace") && onLeaveChild) {
    event.preventDefault();
    onLeaveChild();
    return true;
  }

  return false;
}
