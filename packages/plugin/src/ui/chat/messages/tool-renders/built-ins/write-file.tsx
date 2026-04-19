import React from "react";
import { FileWrite } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, StreamingCodeCard, CodeCard,
  basename,
} from "../shared";

export const WriteFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";
  const title = name ? `写文件 ${name}` : (path || "写文件");

  const content: string = tool.args?.content ?? "";

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
