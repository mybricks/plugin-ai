import React from "react";
import { Skill } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Label, Duration } from "../shared";
import css from "../render.less";

export const SkillRenderer = ({ tool }: { tool: ToolRecord }) => {
  const skillName: string = tool.args?.skill ?? "";
  const title = skillName ? `使用技能 ${skillName}` : "使用技能";

  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} icon={<Skill />} />
      <Label tool={tool} text={title} />
      <Duration tool={tool} />
    </div>
  );
};