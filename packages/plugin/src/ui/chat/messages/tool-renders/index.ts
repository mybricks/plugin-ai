import type { ToolCallRecord } from "../../../../../../agent/src";
import type { ToolUIChannel } from "../../../../../../agent/src";
import { getConfigDirNameFromAgent } from "../../../../../../agent/src";

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
  /** 所属消息 turn 的只读展示上下文。 */
  turn?: { status: "pending" | "success" | "error" | "abort" };
  /** 提交结果；返回的 Promise 在提交被真正消费（如远端任务已下发）时才 resolve。 */
  submit: (value: unknown) => Promise<boolean>;
  cancel: () => Promise<boolean>;
  configDirName: string;
}

/** 正常展示用：独立工具卡片 / 分组展开后的逐条详情，始终返回一个 React 元素。 */
export type ToolRenderer = (tool: ToolRecord, ctx: ToolRendererContext) => React.ReactElement;

/**
 * 摘要展示用：连续工具调用聚合折叠行里的一行摘要文案。
 * 与 ToolRenderer 是完全独立的函数——不传表示该工具不支持被聚合（因为没有函数可调用，
 * 根本不会触发任何渲染逻辑，自然不存在误触发 hooks 之类的风险）；
 * 传了就必须返回一段纯文本（string）或 null（表示本次不展示摘要，等同不支持聚合）。
 */
export type ToolSummaryRenderer = (tool: ToolRecord, ctx: ToolRendererContext) => string | null;

export function createToolRendererContext(
  toolCallId: string,
  toolUI?: ToolUIChannel,
  agent?: object | null,
  turn?: ToolRendererContext["turn"],
): ToolRendererContext {
  return {
    toolCallId,
    turn,
    submit: (value) => toolUI?.respond(toolCallId, value) ?? Promise.resolve(false),
    cancel: () => toolUI?.cancel(toolCallId) ?? Promise.resolve(false),
    configDirName: getConfigDirNameFromAgent(agent),
  };
}

const registry = new Map<string, ToolRenderer>();
const summaryRegistry = new Map<string, ToolSummaryRenderer>();

export function registerToolRenderer(
  toolName: string,
  renderer: ToolRenderer,
  summaryRenderer?: ToolSummaryRenderer,
) {
  registry.set(toolName, renderer);
  if (summaryRenderer) {
    summaryRegistry.set(toolName, summaryRenderer);
  }
}

export function getToolRenderer(toolName: string): ToolRenderer | undefined {
  return registry.get(toolName);
}

export function getToolSummaryRenderer(toolName: string): ToolSummaryRenderer | undefined {
  return summaryRegistry.get(toolName);
}

/**
 * 从 Tool 数组中批量注册自定义渲染函数。
 * 适用于外部向 Agent 注册自定义工具时，同时传入 render / summaryRender 函数的场景。
 * 只注册携带对应字段的工具，内置工具不受影响（可被覆盖）。
 */
export function registerToolRenderersFromTools(
  tools: Array<{ name: string; render?: ToolRenderer; summaryRender?: ToolSummaryRenderer }>,
) {
  for (const tool of tools) {
    if (tool.render) {
      registry.set(tool.name, tool.render);
    }
    if (tool.summaryRender) {
      summaryRegistry.set(tool.name, tool.summaryRender);
    }
  }
}
