import React, { useRef, useEffect, useState } from "react";
import type { ToolRecord } from "../index";
import { TextShimmer } from "../../../../components/text-shimmer";
import { ChevronRight } from "../../../../components/icons";
import { Duration, StatusIcon } from "../shared";
import { InitProjectRenderer } from "./init-project";
import { lang } from "../../../../../i18n";
import css from "../render.less";

type SubAgentToolCall = {
  callId: string;
  name: string;
  title?: string;
  args?: any;
  output?: string;
  error?: string;
  status: "running" | "success" | "error";
};

type SubAgentIteration = {
  iterId: string;
  content: string;
  thinkingContent?: string;
  toolCalls: SubAgentToolCall[];
};

function getIterations(tool: ToolRecord): SubAgentIteration[] {
  const raw = tool.progress?.iterations ?? tool.result?.metadata?.iterations;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is SubAgentIteration => !!item && typeof item.iterId === "string");
}

function basename(p: string): string {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function getToolLabel(name: string, args: any): string {
  const a = args ?? {};
  switch (name) {
    case "read_file":    return `读取 ${basename(a.path ?? a.file ?? "文件")}`;
    case "write_file":   return `写入 ${basename(a.path ?? a.file ?? "文件")}`;
    case "edit_file":    return `修改 ${basename(a.path ?? a.file ?? "文件")}`;
    case "delete_file":  return `删除 ${basename(a.path ?? a.file ?? "文件")}`;
    case "multi_write":  return `批量写文件`;
    case "multi_edit":   return `批量修改`;
    case "bash":         return a.command ? `执行 ${String(a.command).slice(0, 40)}` : "执行命令";
    case "grep_search":  return a.pattern ? `搜索 ${String(a.pattern).slice(0, 30)}` : "搜索";
    case "glob_search":  return a.pattern ? `查找 ${String(a.pattern).slice(0, 30)}` : "查找文件";
    case "web_fetch":    return a.url ? `获取 ${String(a.url).slice(0, 40)}` : "网络请求";
    case "use_skill":    return a.name ? `使用技能 ${a.name}` : "使用技能";
    default: {
      // 有自定义 title 直接用
      const pathLike = a.path ?? a.file ?? a.filePath;
      if (pathLike) return `${name} ${basename(pathLike)}`;
      return name;
    }
  }
}

export const SubAgentRenderer = ({ tool }: { tool: ToolRecord }) => {
  const agentType: string = tool.args?.type ?? "";
  if (agentType === "init-project") {
    return <InitProjectRenderer tool={tool} />;
  }
  return <DefaultSubAgentRenderer tool={tool} />;
};

const DefaultSubAgentRenderer = ({ tool }: { tool: ToolRecord }) => {
  const [expanded, setExpanded] = useState(false);

  const agentType: string = tool.args?.type ?? "";
  const taskName = tool.args?.name ?? "";
  const displayTool = tool;
  const isPending = displayTool.status === "pending";

  const iterations = getIterations(tool);
  const allToolCalls = iterations.flatMap((it) => it.toolCalls);
  const toolCallCount = allToolCalls.length;
  const latestIteration = iterations[iterations.length - 1];

  const headerTitle = isPending
    ? taskName ? `${taskName}…` : agentType ? `${agentType}…` : lang.tool.processing()
    : taskName || agentType || lang.tool.completed();

  const finalOutput = tool.result?.output ?? "";

  return (
    <div className={css["sub-agent-card"]}>
      <div className={css["sub-agent-header"]}>
        <span className={css["sub-agent-header-icon"]}>
          <StatusIcon tool={displayTool} />
        </span>
        <span className={css["sub-agent-header-title"]}>
          {isPending ? <TextShimmer>{headerTitle}</TextShimmer> : headerTitle}
        </span>
        {toolCallCount > 0 && (
          <span className={css["sub-agent-header-meta"]}>{lang.tool.toolCalls(toolCallCount)}</span>
        )}
        <Duration tool={displayTool} />
      </div>

      {iterations.length > 0 && (
        <div className={css["sub-agent-steps"]}>
          {isPending && latestIteration ? (
            <IterationLive iteration={latestIteration} />
          ) : (
            <>
              <IterationList
                iterations={expanded ? iterations : []}
                latestIteration={latestIteration}
                isPending={isPending}
                expanded={expanded}
              />
              {toolCallCount > 1 && (
                <button
                  type="button"
                  className={css["sub-agent-expand-btn"]}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? lang.tool.subAgentCollapseRounds() : lang.tool.subAgentExpandRounds()}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!isPending && finalOutput && (
        <div className={css["sub-agent-result"]}>
          <pre className={css["sub-agent-result-content"]}>
            <code>{finalOutput}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const IterationList = ({
  iterations,
  latestIteration,
  isPending,
  expanded,
}: {
  iterations: SubAgentIteration[];
  latestIteration?: SubAgentIteration;
  isPending: boolean;
  expanded: boolean;
}) => {
  if (expanded) {
    return (
      <>
        {iterations.map((iter) => (
          <IterationSection key={iter.iterId} iteration={iter} />
        ))}
      </>
    );
  }
  if (latestIteration) {
    return <IterationSection iteration={latestIteration} />;
  }
  return null;
};

const IterationSection = ({ iteration }: { iteration: SubAgentIteration }) => (
  <>
    {iteration.toolCalls.map((tc) => (
      <ToolCallRow key={tc.callId} toolCall={tc} />
    ))}
  </>
);

const IterationLive = ({ iteration }: { iteration: SubAgentIteration }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const completedCalls = iteration.toolCalls.filter((tc) => tc.status !== "running");
  const runningCall = iteration.toolCalls.find((tc) => tc.status === "running");

  return (
    <div className={css["sub-agent-live"]} ref={scrollRef}>
      {completedCalls.map((tc) => (
        <ToolCallRow key={tc.callId} toolCall={tc} />
      ))}
      {runningCall && <ToolCallRow toolCall={runningCall} isLatest />}
    </div>
  );
};

const ToolCallRow = ({
  toolCall,
  isLatest,
}: {
  toolCall: SubAgentToolCall;
  isLatest?: boolean;
}) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const label = toolCall.title
    ? `${toolCall.title}`
    : getToolLabel(toolCall.name, toolCall.args);
  const hasDetail = toolCall.args !== undefined || !!toolCall.output || !!toolCall.error;

  return (
    <div className={css["sa-row-wrap"]}>
      <div
        className={`${css["sa-row"]}${hasDetail ? ` ${css["sa-row-clickable"]}` : ""}`}
        onClick={() => hasDetail && setDetailOpen((v) => !v)}
      >
        <span className={css["sa-row-dot"]} data-status={toolCall.status} />
        <span className={css["sa-row-label"]}>
          {isLatest ? <TextShimmer>{label}</TextShimmer> : label}
        </span>
        {toolCall.status === "error" && (
          <span className={css["sa-row-error-badge"]}>{lang.tool.failed()}</span>
        )}
        {hasDetail && (
          <span className={css["sa-row-chevron"]} data-open={detailOpen}>
            <ChevronRight />
          </span>
        )}
      </div>
      {detailOpen && (
        <div className={css["sa-row-detail"]}>
          {toolCall.args !== undefined && (
            <pre className={css["sa-detail-pre"]}>
              <code>{JSON.stringify(toolCall.args, null, 2)}</code>
            </pre>
          )}
          {(toolCall.output || toolCall.error) && (
            <pre className={css["sa-detail-pre"]}>
              <code>{toolCall.error || toolCall.output}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
