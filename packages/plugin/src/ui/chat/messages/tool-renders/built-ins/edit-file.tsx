import React from "react";
import { Pencil } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, StreamingCodeCard, CodeCard,
} from "../shared";
import { PlanToolCard } from "../../action-cards/plan-card";
import { isPlanFilePath, renderPlanMarkdownHtml } from "../../../../components/plan";

export const EditFileRenderer = ({ tool, configDirName }: { tool: ToolRecord; configDirName?: string }) => {
  const path: string = tool.args?.path ?? "";
  const newStr: string = tool.args?.new_str ?? "";
  const oldStr: string = tool.args?.old_str ?? "";

  // 单文件编辑方案时，与 write_file 使用同一方案卡片；回合完成后，
  // MessageBubble 会从 active plan 中读取并展示编辑后的完整内容。
  if (isPlanFilePath(path, configDirName)) {
    return (
      <PlanToolCard
        path={path}
        content={newStr || oldStr || undefined}
        pending={tool.status === "pending"}
        verb="方案更新"
        renderContent={(body) => (
          <div
            dangerouslySetInnerHTML={{ __html: renderPlanMarkdownHtml(body) }}
          />
        )}
      />
    );
  }

  const title = path ? `修改文件 ${path}` : "修改文件";

  if (tool.status === "pending") {
    const streamContent = newStr || oldStr;
    if (streamContent) {
      return <StreamingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} content={streamContent} />;
    }
    return <PendingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} />;
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Pencil />}
      title={title}
      content={newStr || oldStr}
      diffMode={oldStr ? { oldStr, newStr } : undefined}
    />
  );
};
