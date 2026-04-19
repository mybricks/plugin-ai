import React from "react";
import { Pencil, Loading } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import {
  StatusIcon, Duration, Label, BatchItem, BatchGroup,
  shortPath,
} from "../shared";
import css from "../render.less";

type EditItem = { path: string; old_str?: string; new_str?: string; replace_all?: boolean };

export const MultiEditRenderer = ({ tool }: { tool: ToolRecord }) => {
  const edits: EditItem[] = Array.isArray(tool.args?.edits) ? tool.args.edits : [];
  const isPending = tool.status === "pending";

  if (edits.length === 0) {
    return (
      <div className={css["tool-card"]}>
        <StatusIcon tool={tool} icon={<Pencil />} />
        <Label tool={tool} text="批量修改" />
        <Duration tool={tool} />
      </div>
    );
  }

  const paths = edits.map((e) => e.path);
  const items = edits.map((edit, idx) => {
    const name = shortPath(edit.path, paths);
    const oldStr = edit.old_str ?? "";
    const newStr = edit.new_str ?? "";
    const isDelete = !isPending && newStr === "" && oldStr !== "";
    const streamContent = newStr || oldStr;
    const isLastAndPending = isPending && idx === edits.length - 1;
    return (
      <BatchItem
        key={(edit.path || idx) + "-" + idx}
        tool={tool}
        path={edit.path}
        name={name}
        content={isDelete ? oldStr : (isPending ? streamContent : newStr)}
        diffMode={!isPending && !isDelete && oldStr ? { oldStr, newStr } : undefined}
        isDelete={isDelete}
        streaming={isLastAndPending}
      />
    );
  });

  return (
    <BatchGroup
      tool={tool}
      icon={<Pencil />}
      verb="批量修改"
      count={edits.length}
      items={items}
    />
  );
};
