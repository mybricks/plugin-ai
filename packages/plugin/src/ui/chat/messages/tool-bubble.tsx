/**
 * 单个工具调用的渲染入口：负责在自定义渲染器 / 全局 registry / 默认渲染器之间做选择，
 * 并提供渲染出错时的错误边界兜底。
 *
 * 从 messages/index.tsx 中拆出，供 ToolCallGroup（group-parts 的聚合展示）复用，
 * 避免 index.tsx 与分组组件之间产生循环依赖。
 */
import React from "react";
import type { ToolCallRecord } from "../../../../../agent/src/types";
import type { ToolUIChannel } from "../../../../../agent/src";
import type { MessageRecord } from "../use-session";
import type { ChatAgent } from "../chat-panel/use-agent";
import { createToolRendererContext, getToolRenderer } from "./tool-renders/index";
import type { ToolRenderer } from "./tool-renders/index";
import { DefaultToolRenderer } from "./tool-renders/renders";

type UIToolRecord = Omit<ToolCallRecord, "status"> & { status: "pending" | "success" | "error" };

/**
 * ToolCallRecord 的 status 在 agent 层允许缺省；渲染层统一收敛为三种展示状态。
 * memo 让同一 iter 内未改变的工具卡片跳过本次流式更新。
 */
const ToolBubble = React.memo(function ToolBubble({
  tool,
  turn,
  toolRendererMap,
  agent,
  toolUI,
}: {
  tool: ToolCallRecord;
  turn: Pick<MessageRecord, "status">;
  toolRendererMap: Map<string, ToolRenderer>;
  agent?: ChatAgent;
  toolUI?: ToolUIChannel;
}) {
  const uiTool: UIToolRecord = {
    ...tool,
    status: tool.status === "success" || tool.status === "error" ? tool.status : "pending",
  };
  // 优先从 agent 的工具列表中查找自定义渲染函数（已缓存）
  const customRenderer = toolRendererMap.get(uiTool.name);
  if (customRenderer) {
    return renderToolWithErrorBoundary(
      customRenderer,
      uiTool,
      turn,
      "custom",
      agent,
      toolUI,
    );
  }

  // 降级到全局 registry（用于内置工具）
  const globalRenderer = getToolRenderer(uiTool.name);
  if (globalRenderer) {
    return renderToolWithErrorBoundary(
      globalRenderer,
      uiTool,
      turn,
      "registry",
      agent,
      toolUI,
    );
  }

  // 最终降级到默认渲染器
  return <DefaultToolRenderer tool={uiTool as any} />;
});

function renderToolWithErrorBoundary(
  renderer: ToolRenderer,
  tool: UIToolRecord,
  turn: Pick<MessageRecord, "status">,
  source: "custom" | "registry",
  agent?: ChatAgent,
  toolUI?: ToolUIChannel,
) {
  return React.createElement(
    ToolRendererErrorBoundary as any,
    { tool, source, resetKey: getToolRendererResetKey(tool) },
    <ToolRendererInvoker
      renderer={renderer}
      tool={tool as any}
      turn={turn}
      agent={agent}
      toolUI={toolUI}
    />
  );
}

const ToolRendererInvoker = ({
  renderer,
  tool,
  turn,
  agent,
  toolUI,
}: {
  renderer: ToolRenderer;
  tool: ToolCallRecord;
  turn: Pick<MessageRecord, "status">;
  agent?: ChatAgent;
  toolUI?: ToolUIChannel;
}) => {
  return renderer(
    tool as any,
    createToolRendererContext(
      tool.callId,
      toolUI ?? agent?.getToolUI(),
      agent,
      turn,
    ),
  );
};

class ToolRendererErrorBoundary extends React.Component<
  { tool: ToolCallRecord; source: "custom" | "registry"; resetKey: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[ToolRenderer] render failed, fallback to default renderer", {
      toolName: this.props.tool.name,
      callId: this.props.tool.callId,
      source: this.props.source,
      error,
    });
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <DefaultToolRenderer tool={this.props.tool as any} />;
    }
    return this.props.children;
  }
}

function getToolRendererResetKey(tool: UIToolRecord): string {
  return `${tool.callId}:${tool.status}:${tool.execEndTime}`;
}

export { ToolBubble };
