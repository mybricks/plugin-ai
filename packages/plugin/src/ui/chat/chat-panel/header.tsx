import React from "react";
import { Delete } from "../../components/icons";
import { context } from "../../../context";
import css from "./header.less";

interface HeaderProps {
  onClear?: () => void;
}

const Header = ({ onClear }: HeaderProps) => {
  return (
    <div className={css.header}>
      <span className={css.title}>{context.name}</span>
      <div className={css.actions}>
        <div
          className={css.action}
          data-mybricks-tip="清空对话记录"
          onClick={onClear}
        >
          <Delete />
        </div>
      </div>
    </div>
  );
};

export { Header };
