import React from "react";
import { Eye } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { useChatPanel } from "../../../chat-panel/context";
import { PendingCodeCard, CodeCard, LineToolRenderer } from "../shared";
import { lang } from "../../../../../i18n";

export const GrepSearchRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const pattern: string = tool.args?.pattern ?? "";
  const title = lang.tool.searchContent(pattern || undefined);

  let lineMeta: string | null = null;
  if (tool.status === "success" && tool.result) {
    const metadata = tool.result.metadata;
    if (metadata != null) {
      const total = metadata.totalCount ?? 0;
      lineMeta = lang.tool.searchResults(total);
    }
  }

  if (messagesRenderVariant === "line") {
    const detail = [
      pattern ? `${lang.tool.keyword()}: ${pattern}` : "",
      lineMeta ? `${lang.tool.result()}: ${lineMeta}` : "",
      tool.result?.output ? String(tool.result.output) : "",
      tool.error ? `${lang.tool.error()}: ${tool.error}` : "",
    ].filter(Boolean).join("\n\n");

    return (
      <LineToolRenderer
        tool={tool}
        icon={<Eye />}
        title={tool.status === "pending" ? `${title}...` : title}
        meta={lineMeta}
        detail={detail}
      />
    );
  }

  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Eye />} title={`${title}...`} />;
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Eye />}
      title={title}
      content=""
      lineMeta={lineMeta}
      showCode={false}
    />
  );
};
