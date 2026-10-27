/**
 * 工具调用整组折叠壳。
 *
 * 由消息层（messages/index.tsx）使用：工具调用折叠为一行摘要，点击展开查看全部，
 * 具体工具块由调用方通过 renderTool 提供，保持 ToolBubble 私有于消息层，避免循环依赖。
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, ErrorIcon, Loading, Success } from "../../../components/icons";
import { TextShimmer } from "../../../components/text-shimmer";
import { useChatPanel } from "../../chat-panel/context";
import type { ToolCallRecord } from "../../../../../../agent/src";
import css from "./render.less";

interface ToolCallsGroupProps {
  /** 是否已完成 */
  isFinish?: boolean;
  toolCalls: ToolCallRecord[];
  /** 渲染单个工具块（通常是消息层的 ToolBubble） */
  renderTool: (tool: ToolCallRecord) => React.ReactNode;
}

export const ToolCallsGroup = React.memo(function ToolCallsGroup({
  isFinish = false,
  toolCalls,
  renderTool,
}: ToolCallsGroupProps) {
  const { messagesRenderVariant } = useChatPanel();

  // 聚合状态（status 防御性归一，同消息层 ToolBubble）
  const anyPending = toolCalls.some((t) => (t.status ?? "pending") === "pending");
  // 用户是否手动展开过
  const userToggled = useRef(false);

  const [expanded, setExpanded] = useState(true);
  const handleToggle = () => {
    userToggled.current = true;
    setExpanded((prev) => !prev);
  };
  useEffect(() => {
    if (userToggled.current) {
      return;
    }
    if (isFinish) {
      // 全部执行结束 → 回默认摘要态
      setExpanded(false)
    }
  }, [isFinish]);

  const title = !isFinish ? <TextShimmer>执行任务</TextShimmer> : `已执行 ${toolCalls.length} 个任务`;
  const chevron = (
    <span
      className={css["tool-calls-group-toggle"]}
      style={{
        transform: expanded ? "rotate(-90deg)" : "rotate(90deg)",
      }}
    >
      <ChevronRight />
    </span>
  );

  const list = toolCalls.map((tool) => (
    <React.Fragment key={tool.callId}>{renderTool(tool)}</React.Fragment>
  ));

  if (messagesRenderVariant === "line") {
    // line：复用 .tool-line* 系列类拼组头，视觉与现有工具行一致
    return (
      <div className={`${css["tool-calls-group"]} ${css["tool-line-group"]}`}>
        <div
          className={`${css["tool-line-header"]} ${css["tool-line-header-expandable"]}`}
          onClick={handleToggle}
        >
          <span className={css["tool-line-title"]}>{title}</span>
          <span className={css["tool-line-toggle"]}>{chevron}</span>
        </div>
        {expanded && <div className={css["tool-line-group-body"]}>{list}</div>}
      </div>
    );
  }

  // card：组头一条 bar，展开时下方平铺原生工具卡片（不套大卡，避免"卡中卡"）
  return (
    <div className={`${css["tool-calls-group"]} ${css["tool-calls-card-group"]}`}>
      <div className={css["tool-calls-card-group-header"]} onClick={handleToggle}>
        <span className={css["tool-calls-card-group-title"]}>{title}</span>
        <span className={css["tool-calls-card-group-toggle"]}>{chevron}</span>
      </div>
      {expanded && <div className={css["tool-calls-card-group-body"]}>{list}</div>}
    </div>
  );
});
