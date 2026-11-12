import React, { useRef, useEffect, useState } from "react";
import type { ToolRecord } from "../index";
import type { MessageRecord } from "../../../use-session";
import { readLegacySubAgentData } from "../../../../../../../agent/src";
import { TextShimmer } from "../../../../components/text-shimmer";
import { ChevronRight } from "../../../../components/icons";
import { ElapsedTime } from "../../../../components/elapsed-time";
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
  startTime?: number;
  endTime?: number;
};

type SubAgentIteration = {
  iterId: string;
  content: string;
  thinkingContent?: string;
  toolCalls: SubAgentToolCall[];
};

function getIterations(tool: ToolRecord, turn?: MessageRecord): SubAgentIteration[] {
  const legacy = readLegacySubAgentData(turn, tool);
  const child = turn?.childTurns?.find(item => item.callId === tool.callId)
    ?? legacy.records.find(item => item.callId === tool.callId);
  if (!child) {
    return legacy.iterations.filter((item): item is SubAgentIteration => !!item && typeof (item as SubAgentIteration).iterId === "string");
  }
  return child.iterations.flatMap(iteration => {
    if ("type" in iteration || !iteration.iterId) return [];
    return [{
      iterId: iteration.iterId,
      content: iteration.content ?? "",
      thinkingContent: iteration.thinkingContent,
      toolCalls: iteration.toolCalls.map(call => ({
        callId: call.callId,
        name: call.name,
        title: call.title,
        args: call.args,
        output: call.result?.output,
        error: call.error,
        status: call.status === "success" || call.status === "error" ? call.status : "running",
        startTime: call.execStartTime,
        endTime: call.execEndTime,
      })),
    }];
  });
}

function basename(p: string): string {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function getToolLabel(name: string, args: any, title?: string): string {
  if (title) return title;
  const a = args ?? {};
  switch (name) {
    case "read_file":    return lang.tool.subAgentReadFile(basename(a.path ?? a.file ?? lang.tool.file()));
    case "write_file":   return lang.tool.subAgentWriteFile(basename(a.path ?? a.file ?? lang.tool.file()));
    case "edit_file":    return lang.tool.subAgentEditFile(basename(a.path ?? a.file ?? lang.tool.file()));
    case "delete_file":  return lang.tool.subAgentDeleteFile(basename(a.path ?? a.file ?? lang.tool.file()));
    case "multi_write":  return lang.tool.subAgentBatchWrite();
    case "multi_edit":   return lang.tool.subAgentBatchEdit();
    case "bash":         return lang.tool.subAgentRun(a.command ? String(a.command).slice(0, 40) : undefined);
    case "grep_search":  return lang.tool.subAgentSearch(a.pattern ? String(a.pattern).slice(0, 30) : undefined);
    case "glob_search":  return lang.tool.subAgentFindFiles(a.pattern ? String(a.pattern).slice(0, 30) : undefined);
    case "web_fetch":    return lang.tool.subAgentFetch(a.url ? String(a.url).slice(0, 40) : undefined);
    case "use_skill":    return lang.tool.subAgentUseSkill(a.name ? String(a.name) : undefined);
    case "project-runner": return lang.tool.subAgentProjectRunner(a.command ? String(a.command) : undefined);
    default: {
      const pathLike = a.path ?? a.file ?? a.filePath;
      if (pathLike) return `${name} ${basename(pathLike)}`;
      return name;
    }
  }
}

function hasIterationPeek(iteration: SubAgentIteration): boolean {
  return Boolean(iteration.content?.trim()) || iteration.toolCalls.length > 0;
}

export const SubAgentRenderer = ({ tool, turn }: { tool: ToolRecord; turn?: MessageRecord }) => {
  const agentType: string = tool.args?.type ?? "";
  if (agentType === "init-project") {
    return <InitProjectRenderer tool={tool} />;
  }
  const child = turn?.childTurns?.find(item => item.callId === tool.callId);
  let displayTool = tool;
  if (tool.status === "pending" && child?.endTime) {
    let status: "success" | "error" = "success";
    if (child.status === "error" || child.status === "abort") status = "error";
    displayTool = { ...tool, status, execEndTime: child.endTime };
  } else if (tool.status === "pending" && turn?.status !== "pending" && !child) {
    // 父 turn 已中断，且没有可恢复的子任务时，旧工具快照不能继续显示 loading。
    displayTool = { ...tool, status: "error" };
  }
  // 工具结果可能尚未写入历史，以子记录中的 async 补充识别后台任务。
  if (tool.result?.metadata?.async === true || child?.async === true) {
    return <BackgroundSubAgentRenderer tool={displayTool} child={child} interrupted={turn?.errorCode === "TURN_INCOMPLETE"} />;
  }
  return <DefaultSubAgentRenderer tool={displayTool} turn={turn} />;
};

/**
 * 异步子 Agent 的卡片展示任务标题、状态和耗时；执行过程由子会话界面展示。
 */
const BackgroundSubAgentRenderer = ({ tool, child, interrupted }: { tool: ToolRecord; child?: NonNullable<MessageRecord["childTurns"]>[number]; interrupted?: boolean }) => {
  const metadata = tool.result?.metadata ?? {};
  const title: string = tool.args?.name || child?.title || metadata.title || tool.args?.type || "";
  let status: "pending" | "success" | "error" = "pending";
  if (child?.endTime) {
    status = "success";
    if (child.status === "error" || child.status === "abort") status = "error";
  } else if (!child && tool.status !== "pending") {
    status = tool.status === "error" ? "error" : "success";
  }
  // 父 turn 中断且子任务没有终态时，无法判断子任务是否仍在运行。
  const statusUnknown = Boolean(interrupted && child && !child.endTime);
  const backgroundTool: ToolRecord = {
    ...tool,
    status,
    execStartTime: child?.startTime ?? tool.execStartTime,
    execEndTime: child?.endTime ?? tool.execEndTime,
  };

  return (
    <div className={css["sub-agent-card"]}>
      <div className={css["sub-agent-header"]}>
        <span className={css["sub-agent-header-icon"]}>
          {statusUnknown ? "?" : <StatusIcon tool={backgroundTool} />}
        </span>
        <span className={css["sub-agent-header-title"]}>
          {status === "pending" && !statusUnknown ? <TextShimmer>{title}</TextShimmer> : title}
        </span>
        {!statusUnknown && <Duration tool={backgroundTool} />}
      </div>
    </div>
  );
};

const DefaultSubAgentRenderer = ({ tool, turn }: { tool: ToolRecord; turn?: MessageRecord }) => {
  const [expanded, setExpanded] = useState(false);

  const agentType: string = tool.args?.type ?? "";
  const taskName = tool.args?.name ?? "";
  const isPending = tool.status === "pending";

  const iterations = getIterations(tool, turn);
  const visibleIterations = isPending
    ? iterations
    : iterations.filter(hasIterationPeek);
  const allToolCalls = iterations.flatMap((it) => it.toolCalls);
  const toolCallCount = allToolCalls.length;
  const hasRunningTool = allToolCalls.some((toolCall) => toolCall.status === "running");
  const canExpand = visibleIterations.length > 1 || visibleIterations.some((it) => it.content.trim().length > 80);

  const child = turn?.childTurns?.find(item => item.callId === tool.callId);
  const displayName = taskName || child?.title || tool.result?.metadata?.title || agentType;
  const headerTitle = isPending
    ? hasRunningTool ? lang.tool.executingTools() : displayName ? `${displayName}…` : lang.tool.processing()
    : displayName || lang.tool.completed();

  const finalOutput = tool.result?.output ?? "";
  const lastContent = visibleIterations[visibleIterations.length - 1]?.content?.trim() ?? "";
  const showResult = !isPending && !!finalOutput && (!lastContent || !finalOutput.startsWith(lastContent));

  return (
    <div className={css["sub-agent-card"]}>
      <div className={css["sub-agent-header"]}>
        <span className={css["sub-agent-header-icon"]}>
          <StatusIcon tool={tool} />
        </span>
        <span className={css["sub-agent-header-title"]}>
          {isPending ? <TextShimmer>{headerTitle}</TextShimmer> : headerTitle}
        </span>
        {toolCallCount > 0 && (
          <span className={css["sub-agent-header-meta"]}>{lang.tool.toolCalls(toolCallCount)}</span>
        )}
        <Duration tool={tool} />
      </div>

      {visibleIterations.length > 0 && (
        <div className={css["sub-agent-steps"]}>
          <IterationTimeline
            iterations={visibleIterations}
            live={isPending}
            hasRunningTool={hasRunningTool}
            expanded={expanded}
          />
          {!isPending && canExpand && (
            <button
              type="button"
              className={css["sub-agent-expand-btn"]}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? lang.tool.subAgentCollapseRounds() : lang.tool.subAgentExpandRounds()}
            </button>
          )}
        </div>
      )}

      {showResult && (
        <div className={css["sub-agent-result"]}>
          <pre className={css["sub-agent-result-content"]}>
            <code>{finalOutput}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

const IterationTimeline = ({
  iterations,
  live,
  hasRunningTool,
  expanded,
}: {
  iterations: SubAgentIteration[];
  live: boolean;
  hasRunningTool: boolean;
  expanded: boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!live || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  return (
    <div
      className={live || !expanded ? css["sub-agent-live"] : undefined}
      ref={scrollRef}
    >
      {iterations.map((iteration, index) => (
        <IterationSection
          key={iteration.iterId}
          iteration={iteration}
          index={index}
          isLive={live && index === iterations.length - 1}
          hasRunningTool={hasRunningTool}
          expanded={expanded}
        />
      ))}
    </div>
  );
};

const IterationSection = ({
  iteration,
  index,
  isLive,
  hasRunningTool,
  expanded,
}: {
  iteration: SubAgentIteration;
  index: number;
  isLive: boolean;
  hasRunningTool: boolean;
  expanded: boolean;
}) => {
  const content = iteration.content?.trim() ?? "";
  const awaiting = isLive && !content && iteration.toolCalls.length === 0 && !hasRunningTool;

  return (
    <div className={css["sa-iter"]}>
      {expanded && (
        <div className={css["sa-iter-round"]}>{lang.tool.subAgentRound(index + 1)}</div>
      )}
      {(content || awaiting) && (
        <IterationContent content={content} isLive={isLive} expanded={expanded} awaiting={awaiting} />
      )}
      {iteration.toolCalls.map((tc) => (
        <ToolCallRow
          key={tc.callId}
          toolCall={tc}
          isLatest={tc.status === "running"}
        />
      ))}
    </div>
  );
};

const IterationContent = ({
  content,
  isLive,
  expanded,
  awaiting,
}: {
  content: string;
  isLive: boolean;
  expanded: boolean;
  awaiting: boolean;
}) => {
  const tailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLive || !tailRef.current) return;
    tailRef.current.scrollTop = tailRef.current.scrollHeight;
  });

  if (awaiting) {
    return (
      <div className={css["sa-iter-content"]}>
        <TextShimmer>{lang.tool.awaitingModelOutput()}</TextShimmer>
      </div>
    );
  }

  const className = [
    css["sa-iter-content"],
    isLive ? css["sa-iter-content-live"] : "",
    expanded && !isLive ? css["sa-iter-content-full"] : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} ref={isLive ? tailRef : undefined}>
      {content}
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
  const label = getToolLabel(toolCall.name, toolCall.args, toolCall.title);
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
        {toolCall.startTime && (
          <ElapsedTime
            startTime={toolCall.startTime}
            endTime={toolCall.status === "running" ? undefined : toolCall.endTime}
            className={css["tool-duration"]}
            showImmediately={toolCall.status === "running"}
          />
        )}
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
