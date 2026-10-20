/**
 * 连续工具调用的聚合展示：
 *   - groupToolCalls=false：直接退化成逐个 <ToolBubble/>，与现状完全一致
 *   - groupToolCalls=true：对 group-parts 合并出的一串连续工具调用，按"是否支持摘要展示"
 *     再切一次：调用每个工具已注册的 summaryRender（与 render 是两个独立函数，详见
 *     tool-renders/index.ts），返回摘要文案的算作支持聚合，相邻的会合并成一个可折叠行
 *     （状态图标 + 最新工具摘要 + 聚合耗时）；没注册 summaryRender（或返回 null）的工具
 *     不支持聚合，会单独成一段展示，同时打断前后相邻工具的聚合。
 */
import React, { useMemo, useState } from "react";
import type { ToolCallRecord } from "../../../../../agent/src/types";
import type { ToolUIChannel } from "../../../../../agent/src";
import type { MessageRecord } from "../use-session";
import type { ChatAgent } from "../chat-panel/use-agent";
import { createToolRendererContext, getToolSummaryRenderer } from "./tool-renders/index";
import type { ToolRenderer, ToolSummaryRenderer } from "./tool-renders/index";
import { useChatPanel } from "../chat-panel/context";
import { ToolBubble } from "./tool-bubble";
import { Loading } from "../../components/icons";
import { TextShimmer } from "../../components/text-shimmer";
import { ElapsedTime } from "../../components/elapsed-time";
import type { AwaitingNextState } from "./group-parts";
import { lang } from "../../../i18n";
import css from "./tool-call-group.less";

export interface ToolCallGroupProps {
  tools: ToolCallRecord[];
  turn: Pick<MessageRecord, "status">;
  toolRendererMap: Map<string, ToolRenderer>;
  toolSummaryRendererMap: Map<string, ToolSummaryRenderer>;
  agent?: ChatAgent;
  toolUI?: ToolUIChannel;
  /**
   * 组内工具都已执行完，但模型还没决定下一步（见 group-parts.ts 的同名字段注释）。
   * 只对"组内最后一段"生效。它是模型开始下一轮响应的临时状态：显示后不会
   * 打断工具聚合，下一轮若只有工具调用则会自动消失。
   */
  awaitingNext?: AwaitingNextState;
}

interface ResolvedTool {
  tool: ToolCallRecord;
  /** summaryRender(tool, ctx) 的结果；非 string 时视为不支持聚合 */
  summary: string | null;
}

function resolveToolSummary(
  tool: ToolCallRecord,
  turn: Pick<MessageRecord, "status">,
  toolSummaryRendererMap: Map<string, ToolSummaryRenderer>,
  agent?: ChatAgent,
  toolUI?: ToolUIChannel,
): string | null {
  const summaryRenderer = toolSummaryRendererMap.get(tool.name) ?? getToolSummaryRenderer(tool.name);
  if (!summaryRenderer) return null;
  try {
    const ctx = createToolRendererContext(tool.callId, toolUI ?? agent?.getToolUI(), agent, turn);
    const result = summaryRenderer(tool as any, ctx);
    return typeof result === "string" && result ? result : null;
  } catch {
    return null;
  }
}

/** 把一串工具调用按"是否支持摘要展示"切成若干连续片段：支持的合并在一起，不支持的各自单独一段。 */
function splitBySummarySupport(resolved: ResolvedTool[]): ResolvedTool[][] {
  const runs: ResolvedTool[][] = [];
  for (const item of resolved) {
    const last = runs[runs.length - 1];
    if (item.summary !== null && last && last[0].summary !== null) {
      last.push(item);
    } else {
      runs.push([item]);
    }
  }
  return runs;
}

const ToolCallGroup = ({ tools, turn, toolRendererMap, toolSummaryRendererMap, agent, toolUI, awaitingNext }: ToolCallGroupProps) => {
  const { groupToolCalls } = useChatPanel();

  const resolved = useMemo<ResolvedTool[]>(() => {
    if (!groupToolCalls) return tools.map((tool) => ({ tool, summary: null }));
    return tools.map((tool) => ({ tool, summary: resolveToolSummary(tool, turn, toolSummaryRendererMap, agent, toolUI) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, turn, toolSummaryRendererMap, agent, toolUI, groupToolCalls]);

  if (!groupToolCalls) {
    return (
      <>
        {tools.map((tool) => (
          <ToolBubble key={tool.callId} tool={tool} turn={turn} toolRendererMap={toolRendererMap} agent={agent} toolUI={toolUI} />
        ))}
      </>
    );
  }

  const runs = splitBySummarySupport(resolved);
  const hasCollapsedTail = runs[runs.length - 1]?.[0].summary !== null;

  return (
    <>
      {runs.map((run, index) =>
        run[0].summary !== null ? (
          <CollapsedToolCallGroup
            key={`tg-${run[0].tool.callId}`}
            items={run}
            turn={turn}
            toolRendererMap={toolRendererMap}
            agent={agent}
            toolUI={toolUI}
            awaitingNext={index === runs.length - 1 ? awaitingNext : undefined}
          />
        ) : (
          <ToolBubble
            key={run[0].tool.callId}
            tool={run[0].tool}
            turn={turn}
            toolRendererMap={toolRendererMap}
            agent={agent}
            toolUI={toolUI}
          />
        )
      )}
      {awaitingNext && !hasCollapsedTail && <ModelResponsePending awaitingNext={awaitingNext} />}
    </>
  );
};

const CollapsedToolCallGroup = ({
  items,
  turn,
  toolRendererMap,
  agent,
  toolUI,
  awaitingNext,
}: {
  items: ResolvedTool[];
  turn: Pick<MessageRecord, "status">;
  toolRendererMap: Map<string, ToolRenderer>;
  agent?: ChatAgent;
  toolUI?: ToolUIChannel;
  awaitingNext?: AwaitingNextState;
}) => {
  const [expanded, setExpanded] = useState(false);
  const tools = items.map((item) => item.tool);

  const hasPendingTool = tools.some((tool) => tool.status !== "success" && tool.status !== "error");
  const latestSummary = items[items.length - 1].summary as string;

  const startTimes = tools.map((tool) => tool.execStartTime).filter((t): t is number => !!t);
  const startTime = startTimes.length > 0 ? Math.min(...startTimes) : undefined;
  const endTime = hasPendingTool
    ? undefined
    : Math.max(...tools.map((tool) => tool.execEndTime || 0));

  return (
    <div className={css["tool-group"]}>
      <div
        className={css["tool-group-header"]}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {hasPendingTool && (
          <span className={css["tool-group-icon"]}>
            <Loading />
          </span>
        )}
        {hasPendingTool
          ? <span className={css["tool-group-title"]}><TextShimmer>{latestSummary}</TextShimmer></span>
          : <span className={css["tool-group-title"]}>{latestSummary}</span>}
        {startTime !== undefined && (
          <ElapsedTime
            startTime={startTime}
            endTime={endTime}
            className={css["tool-group-duration"]}
            showImmediately
          />
        )}
        <span className={css["tool-group-toggle"]}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} width="1em" height="1em"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </div>
      {awaitingNext && !hasPendingTool && <ModelResponsePending awaitingNext={awaitingNext} />}
      {expanded && (
        <div className={css["tool-group-body"]}>
          {tools.map((tool) => (
            <ToolBubble key={tool.callId} tool={tool} turn={turn} toolRendererMap={toolRendererMap} agent={agent} toolUI={toolUI} />
          ))}
        </div>
      )}
    </div>
  );
};

const ModelResponsePending = ({ awaitingNext }: { awaitingNext: AwaitingNextState }) => (
  <div className={css["tool-group-awaiting-next"]}>
    <TextShimmer className={css["tool-group-awaiting-next-title"]}>{lang.chat.waitingForModel()}</TextShimmer>
    <ElapsedTime
      startTime={awaitingNext.startTime}
      endTime={awaitingNext.endTime}
      className={css["tool-group-awaiting-next-duration"]}
      showImmediately
    />
  </div>
);

export { ToolCallGroup };
