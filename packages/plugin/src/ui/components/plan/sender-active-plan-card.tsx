import React from "react";
import type { ActivePlanFile } from "../../../../../agent/src/mode-manager";
import { PlanActions } from "./plan-actions";
import css from "./sender-active-plan-card.less";

export interface SenderActivePlanCardProps {
  plan: ActivePlanFile;
  canExecute: boolean;
  onExecute?: () => void;
  onAbandon?: () => void;
}

export const SenderActivePlanCard = ({
  plan,
  canExecute,
  onExecute,
  onAbandon,
}: SenderActivePlanCardProps) => {
  const displayTitle = plan.title ?? plan.path;

  return (
    <div className={css["sender-plan-card"]}>
      <div className={css["sender-plan-card-left"]}>
        <span className={css["sender-plan-card-label"]}>当前讨论的方案：</span>
        <span className={css["sender-plan-card-title"]} title={displayTitle}>{displayTitle}</span>
        {plan.desc && <span className={css["sender-plan-card-desc"]} title={plan.desc}>{plan.desc}</span>}
      </div>
      <PlanActions
        canExecute={canExecute}
        onExecute={onExecute}
        onAbandon={onAbandon}
        classes={{
          root: css["sender-plan-card-actions"],
          abandon: css["sender-plan-card-abandon"],
          execute: css["sender-plan-card-execute"],
          executeDisabled: css["sender-plan-card-execute--disabled"],
        }}
      />
    </div>
  );
};
