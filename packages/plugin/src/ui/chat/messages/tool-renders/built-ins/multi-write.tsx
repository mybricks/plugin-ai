import React from "react";
import { FileWrite } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  StatusIcon, Duration, Label, BatchItem, BatchGroup,
} from "../shared";
import css from "../render.less";
import { lang } from "../../../../../i18n";

export const MultiWriteRenderer = ({ tool }: { tool: ToolRecord }) => {
  const files: Array<{ path: string; content?: string }> = Array.isArray(tool.args?.files) ? tool.args.files : [];
  const isPending = tool.status === "pending";

  if (files.length === 0) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<FileWrite />} />
        <Label tool={tool} text={lang.tool.batchWriteFiles()} />
        <Duration tool={tool} />
      </div>
    );
  }

  const paths = files.map((f) => f.path);
  const items = files.map((file, idx) => {
    const name = file.path;
    const content = file.content ?? "";
    const isLastAndPending = isPending && idx === files.length - 1;
    return (
      <BatchItem
        key={file.path || idx}
        tool={tool}
        path={file.path}
        name={name}
        content={content}
        streaming={isLastAndPending && !content ? false : isLastAndPending}
      />
    );
  });

  return (
    <BatchGroup
      tool={tool}
      icon={<FileWrite />}
      verb={lang.tool.batchWriteFiles()}
      count={files.length}
      items={items}
    />
  );
};
