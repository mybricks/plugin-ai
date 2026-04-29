import React from "react";
import { Eye } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { PendingCodeCard, CodeCard } from "../shared";

export const GrepSearchRenderer = ({ tool }: { tool: ToolRecord }) => {
  const pattern: string = tool.args?.pattern ?? "";
  const title = pattern ? `搜索 ${pattern}` : "搜索文件内容";

  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Eye />} title={`${title}...`} />;
  }

  let lineMeta: string | null = null;
  if (tool.status === "success" && tool.result) {
    const metadata = tool.result.metadata;
    if (metadata != null) {
      const total = metadata.totalCount ?? 0;
      lineMeta = `${total} 个结果`;
    }
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
