import React from "react";
import { Delete } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  StatusIcon, Duration, PendingCodeCard, CodeCard,
  basename,
} from "../shared";
import css from "../render.less";

export const DeleteFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const paths: string[] = Array.isArray(tool.args?.paths) ? tool.args.paths : [];
  const metadata = tool.result?.metadata;
  const deletedPaths: string[] = Array.isArray(metadata?.deletedPaths) ? metadata.deletedPaths : paths;
  const title = deletedPaths.length === 1 ? `删除文件 ${basename(deletedPaths[0])}` : `删除文件 ${deletedPaths.length} 项`;
  const content = deletedPaths.join("\n");

  if (tool.status === "pending") {
    return <PendingCodeCard tool={tool} icon={<Delete />} title={`${title}...`} />;
  }

  if (!content) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Delete />} />
        <span className={css["tool-label"]}>{title}</span>
        <Duration tool={tool} />
      </div>
    );
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Delete />}
      title={title}
      content={content}
      isDelete
    />
  );
};
