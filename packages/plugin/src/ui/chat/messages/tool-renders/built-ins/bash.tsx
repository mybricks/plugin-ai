import React, { useLayoutEffect, useRef, useState } from "react";
import { Code } from "../../../../components/icons";
import type { ToolRecord } from "../index";
import { StatusIcon, Duration } from "../shared";
import { lang } from "../../../../../i18n";
import css from "../render.less";

export const BashRenderer = ({ tool }: { tool: ToolRecord }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [commandExpanded, setCommandExpanded] = useState(false);
  const [commandOverflows, setCommandOverflows] = useState(false);
  const commandRef = useRef<HTMLElement>(null);

  const command: string = tool.args?.command ?? "";
  const description: string = tool.args?.description ?? "";
  const isPending = tool.status === "pending";
  const exitCode = tool.result?.metadata?.exitCode;
  const isCommandError = tool.status === "error" || (typeof exitCode === "number" && exitCode !== 0);
  const statusText = isPending ? lang.tool.running() : isCommandError ? lang.tool.failed() : lang.tool.completed();
  const title = description || lang.tool.command();
  const output: string = tool.status === "error"
    ? tool.error ?? tool.result?.output ?? ""
    : tool.result?.output ?? "";
  const hasOutput = !!output;
  const canToggle = hasOutput;
  const headerHasDivider = !!command || hasOutput;

  useLayoutEffect(() => {
    const element = commandRef.current;
    if (!element) {
      setCommandOverflows(false);
      return;
    }
    const measure = () => {
      const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
      setCommandOverflows(Number.isFinite(lineHeight) && element.scrollHeight > lineHeight * 3 + 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [command]);

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
          <code ref={commandRef} className={commandExpanded ? css["bash-card-command-expanded"] : css["bash-card-command-collapsed"]}>{command}</code>
          {commandOverflows && (
            <button
              type="button"
              className={css["bash-card-command-toggle"]}
              aria-expanded={commandExpanded}
              onClick={() => setCommandExpanded((expanded) => !expanded)}
            >
              {commandExpanded ? lang.tool.collapseCommand() : lang.tool.expandCommand()}
            </button>
          )}
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
