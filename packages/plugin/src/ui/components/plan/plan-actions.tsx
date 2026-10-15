import React from "react";
import classNames from "classnames";
import { lang } from "../../../i18n";

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
  executeLabel = lang.plan.execute(),
  abandonLabel = lang.plan.abandon(),
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
          title={lang.plan.abandon()}
          onClick={onAbandon}
        >
          {abandonLabel}
        </div>
      )}
      {onExecute && (
        <div
          className={classNames(classes.execute, { [classes.executeDisabled]: executeDisabled })}
          title={executeDisabled ? lang.plan.executeDisabled() : lang.plan.executeTip()}
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
