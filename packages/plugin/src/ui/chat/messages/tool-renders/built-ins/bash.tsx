import React, { useState } from "react";
import { Code } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Duration, LineToolRenderer } from "../shared";
import { useChatPanel } from "../../../chat-panel/context";
import css from "../render.less";

export const BashRenderer = ({ tool }: { tool: ToolRecord }) => {
  const { messagesRenderVariant } = useChatPanel();
  const [collapsed, setCollapsed] = useState(true);

  const command: string = tool.args?.command ?? "";
  const description: string = tool.args?.description ?? "";

  // 提取命令的第一个词（verb）
  const verb = command.trimStart().split(/\s+/)[0] ?? "bash";
  const title = description || command || "执行命令";

  const isPending = tool.status === "pending";
  const output: string = tool.result?.output ?? "";
  const hasOutput = tool.status === "success" && !!output;
  const canToggle = hasOutput;

  if (messagesRenderVariant === "line") {
    return (
      <LineToolRenderer
        tool={tool}
        icon={<Code />}
        title={isPending ? `${title}...` : title}
        meta={verb !== "bash" ? verb : undefined}
      />
    );
  }

  return (
    <div className={css["code-card"]}>
      <div
        className={`${css["code-card-header"]}${hasOutput ? ` ${css["code-card-header-with-body"]}` : ""}`}
        onClick={() => canToggle && setCollapsed((c) => !c)}
        style={canToggle ? undefined : { cursor: "default" }}
      >
        <span className={css["code-card-icon"]}>
          <StatusIcon tool={tool} icon={<Code />} />
        </span>
        <span className={css["code-card-filename"]}>
          {isPending ? (
            <span style={{ opacity: 0.7 }}>{title}</span>
          ) : (
            title
          )}
        </span>
        {command && (
          <span className={css["code-card-lines"]} style={{ fontFamily: "monospace", opacity: 0.6, flexShrink: 0 }}>
            {verb}
          </span>
        )}
        <Duration tool={tool} />
        {canToggle && (
          <span className={css["code-card-toggle"]}>{collapsed ? "▶" : "▼"}</span>
        )}
      </div>
      {hasOutput && !collapsed && (
        <pre className={css["code-card-body"]}>
          <code>{output}</code>
        </pre>
      )}
    </div>
  );
};
