import React from "react";
import { Skill } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Label, Duration, LineToolRenderer } from "../shared";
import { useChatPanel } from "../../../chat-panel/context";
import css from "../render.less";

export const SkillRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const skillName: string = tool.args?.skill ?? "";
  const title = skillName ? `使用技能 ${skillName}` : "使用技能";

  if (messagesRenderVariant === "line") {
    return (
      <LineToolRenderer
        tool={tool}
        icon={<Skill />}
        title={title}
      />
    );
  }

  return (
    <div className={css["tool-card"]}>
      <StatusIcon tool={tool} icon={<Skill />} />
      <Label tool={tool} text={title} />
      <Duration tool={tool} />
    </div>
  );
};
