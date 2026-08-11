import type { ToolCallRecord } from "../../../../../../agent/src";
import type { ToolUIChannel } from "../../../../../../agent/src";

/**
 * UI 层工具调用视图，在持久化快照（ToolCallRecord）基础上叠加流式临时状态。
 *
 * 分层设计：
 *   ToolCallRecord  — agent/持久化层，只含最终快照，可序列化，无流式残留
 *   ToolCallView    — UI 层，由 SSE 事件聚合而来，仅活在 React state 中，不持久化
 *
 * 流式字段的生命周期：
 *   argsContent   由 tool:args 事件累积（覆盖全量），tool:call 后清除
 *   progress      由 tool:progress 事件覆盖写入，工具完成后清除
 */
export interface ToolCallView extends ToolCallRecord {
  /** tool:args 阶段累积的 args 原始字符串全量（args 完整后置为 undefined） */
  argsContent?: string;
  /** tool:progress 最新覆盖快照（工具自定义结构，完成后置为 undefined） */
  progress?: any;
}

export type ToolRecord = ToolCallView;

/**
 * 第二参数是对当前 tool.callId 绑定好的通用 UI 回传能力。
 * renderer 无需引用 ToolUIChannel，也无需自行处理工具调用 ID。
 */
export interface ToolRendererContext {
  toolCallId: string;
  submit: (value: unknown) => boolean;
  cancel: () => boolean;
}

export type ToolRenderer = (tool: ToolRecord, ctx: ToolRendererContext) => React.ReactElement;

export function createToolRendererContext(toolCallId: string, toolUI?: ToolUIChannel): ToolRendererContext {
  return {
    toolCallId,
    submit: (value) => toolUI?.respond(toolCallId, value) ?? false,
    cancel: () => toolUI?.cancel(toolCallId) ?? false,
  };
}

const registry = new Map<string, ToolRenderer>();

export function registerToolRenderer(toolName: string, renderer: ToolRenderer) {
  registry.set(toolName, renderer);
}

export function getToolRenderer(toolName: string): ToolRenderer | undefined {
  return registry.get(toolName);
}

/**
 * 从 Tool 数组中批量注册自定义渲染函数。
 * 适用于外部向 Agent 注册自定义工具时，同时传入 render 函数的场景。
 * 只注册携带 render 字段的工具，内置工具不受影响（可被覆盖）。
 */
export function registerToolRenderersFromTools(tools: Array<{ name: string; render?: ToolRenderer }>) {
  for (const tool of tools) {
    if (tool.render) {
      registry.set(tool.name, tool.render);
    }
  }
}
