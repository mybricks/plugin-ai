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
}

const Header = ({ onClear, onExport, title, disabled = false }: HeaderProps) => {
  return (
    <div className={css.header}>
      <span className={css.title}>{title ?? context.name}</span>
      <div className={css.actions}>
        <div
          className={classNames(css.action, { [css.disabled]: disabled })}
          data-mybricks-tip="清空对话记录"
          onClick={disabled ? undefined : onClear}
        >
          <Delete />
        </div>
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
