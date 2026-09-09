import React from "react";
import { FileWrite } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, StreamingCodeCard, CodeCard,
} from "../shared";
import { PlanToolCard } from "../../action-cards/plan-card";
import { isPlanFilePath, renderPlanMarkdownHtml } from "../../../../components/plan";

export const WriteFileRenderer = ({ tool, configDirName }: { tool: ToolRecord; configDirName?: string }) => {
  const path: string = tool.args?.path ?? "";
  const content: string = tool.args?.content ?? "";

  if (isPlanFilePath(path, configDirName)) {
    const isPending = tool.status === "pending";
    return (
      <PlanToolCard
        path={path}
        content={content || undefined}
        pending={isPending}
        verb="方案制定"
        renderContent={(body) => (
          <div
            dangerouslySetInnerHTML={{ __html: renderPlanMarkdownHtml(body) }}
          />
        )}
      />
    );
  }

  const title = path ? `写文件 ${path}` : "写文件";

  if (tool.status === "pending") {
    if (content) {
      return <StreamingCodeCard tool={tool} icon={<FileWrite />} title={`${title}...`} content={content} />;
    }
    return <PendingCodeCard tool={tool} icon={<FileWrite />} title={`${title}...`} />;
  }

  return (
    <CodeCard
      tool={tool}
      icon={<FileWrite />}
      title={title}
      content={content}
    />
  );
};
