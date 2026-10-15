import React from "react";
import { FileWrite } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, StreamingCodeCard, CodeCard,
} from "../shared";
import { PlanToolCard } from "../../action-cards/plan-card";
import { isPlanFilePath, renderPlanMarkdownHtml } from "../../../../components/plan";
import { lang } from "../../../../../i18n";

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
        verb={lang.tool.planDrafting()}
        renderContent={(body) => (
          <div
            dangerouslySetInnerHTML={{ __html: renderPlanMarkdownHtml(body) }}
          />
        )}
      />
    );
  }

  const title = lang.tool.writeFile(path || undefined);

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
