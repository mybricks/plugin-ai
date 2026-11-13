import React from "react";
import { Eye } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Duration, LineToolRenderer } from "../shared";
import { useChatPanel } from "../../../chat-panel/context";
import { TextShimmer } from "../../../../components/text-shimmer";
import { lang } from "../../../../../i18n";
import css from "../render.less";

export const CheckStatusRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const label = lang.tool.viewStatus();

  if (messagesRenderVariant === "line") {
    const detail = [
      tool.result?.output ? String(tool.result.output) : "",
      tool.error ? `${lang.tool.error()}: ${tool.error}` : "",
    ].filter(Boolean).join("\n\n");

    return (
      <LineToolRenderer
        tool={tool}
        icon={<Eye />}
        title={tool.status === "pending" ? `${label}...` : label}
        detail={detail}
      />
    );
  }

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
