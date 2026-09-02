import React, { useState } from "react";
import { Code } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Duration } from "../shared";
import css from "../render.less";

export const BashRenderer = ({ tool }: { tool: ToolRecord }) => {
  const [collapsed, setCollapsed] = useState(true);

  const command: string = tool.args?.command ?? "";
  const description: string = tool.args?.description ?? "";
  const isPending = tool.status === "pending";
  const exitCode = tool.result?.metadata?.exitCode;
  const isCommandError = tool.status === "error" || (typeof exitCode === "number" && exitCode !== 0);
  const statusText = isPending ? "执行中" : isCommandError ? "执行失败" : "已完成";
  const title = description || "执行命令";
  const output: string = tool.status === "error"
    ? tool.error ?? tool.result?.output ?? ""
    : tool.result?.output ?? "";
  const hasOutput = !!output;
  const canToggle = hasOutput;
  const headerHasDivider = !!command || hasOutput;

  return (
    <div className={`${css["code-card"]} ${css["bash-card"]}`}>
      <div
        className={`${css["code-card-header"]}${headerHasDivider ? ` ${css["code-card-header-with-body"]}` : ""}`}
        onClick={() => canToggle && setCollapsed((c) => !c)}
        style={canToggle ? undefined : { cursor: "default" }}
      >
        <span className={css["code-card-icon"]}>
          <StatusIcon tool={tool} icon={<Code />} />
        </span>
        <span className={css["code-card-filename"]}>
          {isPending ? <span style={{ opacity: 0.7 }}>{title}</span> : title}
        </span>
        <span className={`${css["bash-card-status"]}${isPending ? ` ${css["bash-card-status-pending"]}` : isCommandError ? ` ${css["bash-card-status-error"]}` : ""}`}>
          {statusText}
        </span>
        <Duration tool={tool} />
        {canToggle && (
          <span className={css["code-card-toggle"]}>{collapsed ? "▶" : "▼"}</span>
        )}
      </div>
      {command && (
        <div className={`${css["bash-card-command"]}${hasOutput && !collapsed ? ` ${css["bash-card-command-with-output"]}` : ""}`}>
          <code>{command}</code>
        </div>
      )}
      {hasOutput && !collapsed && (
        <pre className={css["code-card-body"]}>
          <code>{output}</code>
        </pre>
      )}
    </div>
  );
};
