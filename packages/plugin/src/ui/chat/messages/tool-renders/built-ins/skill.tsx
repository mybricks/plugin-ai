import React from "react";
import { Skill } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Label, Duration, LineToolRenderer } from "../shared";
import { useChatPanel } from "../../../chat-panel/context";
import css from "../render.less";
import { lang } from "../../../../../i18n";

export const SkillRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const skillName: string = tool.args?.skill ?? "";
  const displayName: string = tool.result?.metadata?.displayName ?? skillName;
  const title = lang.tool.useSkill(displayName || undefined);

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
