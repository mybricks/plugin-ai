import React from "react";
import classNames from "classnames";
import { Delete, Export } from "../../components/icons";
import { context } from "../../../context";
import css from "./header.less";

interface HeaderProps {
  onClear?: () => void;
  onExport?: () => void;
  title?: string;
  disabled?: boolean;
  /**
   * 在清空/导出按钮之前插入自定义内容（如宿主的状态图标+文案）。
   * 内容、交互、状态完全由宿主决定，Header 只提供挂载位置。
   */
  renderExtra?: () => React.ReactNode;
}

const Header = ({ onClear, onExport, title, disabled = false, renderExtra }: HeaderProps) => {
  return (
    <div className={css.header}>
      <div className={css.left}>
        <span className={css.title}>{title ?? context.name}</span>
        <div className={css.actions}>
          <div
            className={classNames(css.action, { [css.disabled]: disabled })}
            data-mybricks-tip="清空对话记录"
            onClick={disabled ? undefined : onClear}
          >
            <Delete />
          </div>
          {renderExtra?.()}
        </div>
      </div>
      <div className={css.right}>
        <div
          className={classNames(css.action, css.export)}
          data-mybricks-tip="导出对话记录"
          onClick={onExport}
        >
          <Export />
        </div>
      </div>
    </div>
  );
};

export { Header };
