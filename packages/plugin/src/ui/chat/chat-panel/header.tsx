import React from "react";
import classNames from "classnames";
import clearImg from "../../components/icons/imgs/clear.png";
import exportImg from "../../components/icons/imgs/export-chat.png";
import { context } from "../../../context";
import { lang } from "../../../i18n";
import css from "./header.less";

interface HeaderProps {
  onClear?: () => void;
  onExport?: () => void;
  title?: string;
  disabled?: boolean;
  /**
   * 在操作按钮组之前插入自定义内容（如宿主的状态图标+文案）。
   * 内容、交互、状态完全由宿主决定，Header 只提供挂载位置。
   */
  renderExtra?: () => React.ReactNode;
}

const Header = ({
  onClear,
  onExport,
  title,
  disabled = false,
  renderExtra,
}: HeaderProps) => {
  return (
    <div className={css.header}>
      <div className={css.left}>
        <span className={css.title}>{title ?? context.name}</span>
      </div>
      <div className={css.right}>
        {renderExtra?.()}
        <div className={css.actions}>
          <div
            className={classNames(css.action, { [css.disabled]: disabled })}
            data-mybricks-tip={lang.header.clearHistory()}
            onClick={disabled ? undefined : onClear}
          >
            <img className={css.actionIcon} src={clearImg} alt="" />
          </div>
          <div
            className={css.action}
            data-mybricks-tip={lang.header.exportHistory()}
            onClick={onExport}
          >
            <img className={css.actionIcon} src={exportImg} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
};

export { Header };
