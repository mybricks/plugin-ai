import React from "react";
import { Eye } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Duration } from "../shared";
import { TextShimmer } from "../../../../components/text-shimmer";
import css from "../render.less";

export const CheckStatusRenderer = ({ tool }: { tool: ToolRecord }) => {
  const label = "查看当前状态";
  if (tool.status === "pending") {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Eye />} />
        <span className={css["tool-label"]}><TextShimmer>{`${label}...`}</TextShimmer></span>
        <Duration tool={tool} />
      </div>
    );
  }

  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} icon={<Eye />} />
      <span className={css["tool-label"]}>{label}</span>
      <Duration tool={tool} />
    </div>
  );
};
