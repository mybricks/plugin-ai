import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ToolRecord } from "../index";
import type { MessageRecord, UIIteration } from "../../../use-session";
import { readLegacySubAgentData } from "../../../../../../../agent/src";
import { TextShimmer } from "../../../../components/text-shimmer";
import { ChevronRight } from "../../../../components/icons";
import { Duration, StatusIcon } from "../shared";
import { InitProjectRenderer } from "./init-project";
import { MessageList } from "../../index";
import { lang } from "../../../../../i18n";
import css from "../render.less";

export const SubAgentRenderer = ({ tool, turn }: { tool: ToolRecord; turn?: MessageRecord }) => {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const agentType: string = tool.args?.type ?? "";
  const legacy = readLegacySubAgentData(turn, tool);
  const child = turn?.childTurns?.find(item => item.callId === tool.callId)
    ?? legacy.records.find(item => item.callId === tool.callId);

  if (agentType === "init-project") return <InitProjectRenderer tool={tool} />;

  let displayTool = tool;
  if (tool.status === "pending" && child?.endTime) {
    displayTool = { ...tool, status: child.status === "error" || child.status === "abort" ? "error" : "success", execEndTime: child.endTime };
  } else if (tool.status === "pending" && turn?.status !== "pending" && !child) {
    displayTool = { ...tool, status: "error" };
  }
  const background = tool.args?.async === true || tool.result?.metadata?.async === true || child?.async === true;
  const statusUnknown = Boolean(background && turn?.errorCode === "TURN_INCOMPLETE" && child && !child.endTime);
  if (background && child) {
    displayTool = {
      ...displayTool,
      status: child.endTime && (child.status === "error" || child.status === "abort") ? "error" : "success",
      execStartTime: child.startTime ?? tool.execStartTime,
      execEndTime: child.endTime ?? tool.execEndTime,
    };
  }
  if (background && !child && tool.result?.metadata?.async === true && displayTool.status === "pending") {
    displayTool = { ...displayTool, status: "success" };
  }
  const title = tool.args?.name || child?.title || tool.result?.metadata?.title || agentType || lang.tool.processing();
  const iterations = child?.iterations ?? legacy.iterations;
  const iterationCount = iterations.filter(item => item && typeof item === "object" && !("type" in item)).length;
  const hasDetail = Boolean(child || iterations.length || tool.result?.output);
  // 旧版进度只保存简化的 iteration，转换为消息列表可识别的工具记录。
  const legacyIterations = legacy.iterations.map((item: any, index) => ({
    ...item,
    iterId: item.iterId || `legacy-${index}`,
    content: item.content ?? "",
    toolCalls: (item.toolCalls ?? []).map((call: any) => ({
      ...call,
      status: call.status === "running" || !call.status ? "pending" : call.status,
      execStartTime: call.execStartTime ?? call.startTime ?? 0,
      execEndTime: call.execEndTime ?? call.endTime ?? 0,
      result: call.result ?? (call.output ? { output: call.output } : undefined),
    })),
  }));
  const message: MessageRecord = child ? {
    ...child,
    status: !child.endTime && child.status === "success" ? "pending" : child.status,
    iterations: child.iterations.map((item, index) => ({ ...item, iterId: item.iterId || `child-${index}` })) as UIIteration[],
  } : {
    id: tool.callId,
    startTime: tool.execStartTime,
    endTime: tool.execEndTime || undefined,
    userText: tool.args?.task ?? tool.args?.prompt ?? "",
    userAttachments: [],
    status: displayTool.status,
    iterations: (legacyIterations.length ? legacyIterations : tool.result?.output ? [{ iterId: "legacy-output", content: tool.result.output, toolCalls: [] }] : []) as UIIteration[],
  };
  const target = cardRef.current?.closest<HTMLElement>("[data-chat-body]");

  return (
    <div ref={cardRef} className={css["tool-card"]}>
        <span className={css["tool-icon"]}>{statusUnknown ? "?" : <StatusIcon tool={displayTool} />}</span>
        <span className={css["tool-label"]}>
          {displayTool.status === "pending" && !statusUnknown ? <TextShimmer>{title}</TextShimmer> : title}
        </span>
        {iterationCount > 0 && <span className={css["tool-meta"]}>{lang.tool.toolCalls(iterationCount)}</span>}
        {!background && !statusUnknown && <Duration tool={displayTool} />}
        {hasDetail && <button type="button" className={css["sub-agent-open"]} onClick={() => setOpen(true)} aria-label={lang.tool.subAgentOpen()}><ChevronRight /></button>}
      {open && target && createPortal(
        <div className={css["sub-agent-page"]}>
          <div className={css["sub-agent-page-header"]}>
            <button type="button" className={css["sub-agent-back"]} onClick={() => setOpen(false)} aria-label={lang.tool.subAgentBack()}><ChevronRight /></button>
            <span title={title}>{title}</span>
          </div>
          <MessageList messages={[message]} showUserMessage={false} actionBar={[]} canExecutePlan={false} />
        </div>, target,
      )}
    </div>
  );
};
