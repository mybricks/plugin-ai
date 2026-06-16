import React from "react";
import classNames from "classnames";

export interface PlanActionClasses {
  root: string;
  abandon: string;
  execute: string;
  executeDisabled: string;
}

export interface PlanActionsProps {
  canExecute: boolean;
  onExecute?: () => void;
  onAbandon?: () => void;
  classes: PlanActionClasses;
  executeLabel?: string;
  abandonLabel?: string;
  stopPropagation?: boolean;
}

export const PlanActions = ({
  canExecute,
  onExecute,
  onAbandon,
  classes,
  executeLabel = "执行方案",
  abandonLabel = "废弃方案",
  stopPropagation = true,
}: PlanActionsProps) => {
  if (!onExecute && !onAbandon) return null;

  const executeDisabled = !canExecute || !onExecute;

  return (
    <div
      className={classes.root}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
      }}
    >
      {onAbandon && (
        <div
          className={classes.abandon}
          title="废弃此方案"
          onClick={onAbandon}
        >
          {abandonLabel}
        </div>
      )}
      {onExecute && (
        <div
          className={classNames(classes.execute, { [classes.executeDisabled]: executeDisabled })}
          title={executeDisabled ? "当前无法执行方案" : "按当前方案进入执行模式"}
          onClick={() => {
            if (!executeDisabled) onExecute();
          }}
        >
          {executeLabel}
        </div>
      )}
    </div>
  );
};
