import React from "react";
import { Pencil } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  PendingCodeCard, StreamingCodeCard, CodeCard,
  basename,
} from "../shared";

export const EditFileRenderer = ({ tool }: { tool: ToolRecord }) => {
  const path: string = tool.args?.path ?? "";
  const name = path ? basename(path) : "";
  const title = name ? `修改文件 ${name}` : (path || "修改文件");

  if (tool.status === "pending") {
    const streamContent: string = tool.args?.new_str ?? tool.args?.old_str ?? "";
    if (streamContent) {
      return <StreamingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} content={streamContent} />;
    }
    return <PendingCodeCard tool={tool} icon={<Pencil />} title={`${title}...`} />;
  }

  const newStr: string = tool.args?.new_str ?? "";
  const oldStr: string = tool.args?.old_str ?? "";
  const isDelete = newStr === "" && oldStr !== "";
  if (isDelete) {
    return (
      <CodeCard
        tool={tool}
        icon={<Pencil />}
        title={title}
        content={oldStr}
        isDelete
      />
    );
  }

  return (
    <CodeCard
      tool={tool}
      icon={<Pencil />}
      title={title}
      content={newStr}
      diffMode={{ oldStr, newStr }}
    />
  );
};
