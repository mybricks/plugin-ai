import React from "react";
import { Eye } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, CodeCard,
} from "../shared";

export const ReadFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const title = path ? `查看文件 ${path}` : "查看文件";

  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Eye />} title={`${title}...`} />;
  }

  let lineMeta: string | null = null;
  if (tool.status === "success" && tool.result) {
    const content: string = tool.result.output ?? "";
    const metadata = tool.result.metadata;
    if (content) {
      const start = metadata?.startLine ?? 1;
      const end = metadata?.endLine ?? metadata?.totalLines ?? content.split("\n").length;
      lineMeta = `L${start} - L${end}`;
    } else if (Array.isArray(metadata?.files)) {
      lineMeta = `${metadata.files.length} 个文件`;
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
