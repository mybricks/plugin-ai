import type { ToolCallRecord } from "../../../../../../agent/src";
import type { ToolUIChannel } from "../../../../../../agent/src";
import { getConfigDirNameFromAgent } from "../../../../../../agent/src";
import type { MessageRecord } from "../../use-session";

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
  turn?: MessageRecord;
  /** 提交结果；返回的 Promise 在提交被真正消费（如远端任务已下发）时才 resolve。 */
  submit: (value: unknown) => Promise<boolean>;
  cancel: () => Promise<boolean>;
  configDirName: string;
  getSkillDisplayName?: (name: string) => string | undefined;
}

/** 正常展示用：独立工具卡片 / 分组展开后的逐条详情，始终返回一个 React 元素。 */
export type ToolRenderer = (tool: ToolRecord, ctx: ToolRendererContext) => React.ReactElement;

/**
 * 与 ToolRenderer 是完全独立的函数——传了就必须返回一段纯文本（string）或 null
 * （表示本次不展示摘要，等同不支持聚合）。不传时的行为取决于本地是否认识该工具：
 * 本地注册过 render 的富卡片工具保持独立展示；本地完全不认识的平台侧远端工具
 * （如 file_read_text）用 getToolDefaultSummary 的兜底摘要参与聚合。
 * 传了就必须返回一段纯文本（string）或 null（表示本次不展示摘要，等同不支持聚合）。
 */
export type ToolSummaryRenderer = (tool: ToolRecord, ctx: ToolRendererContext) => string | null;

/**
 * 本地未注册任何渲染器的工具（平台侧远端工具，如 file_read_text / team_task）的兜底摘要：
 * 工具名（有 title 优先）+ 第一个关键参数（path/pattern/command 等），让这类工具也能参与聚合折叠。
 */
export function getToolDefaultSummary(tool: ToolCallRecord): string {
  const label = tool.title || tool.name || "";
  if (!label) return "";
  const args: Record<string, any> = tool.args && typeof tool.args === "object" ? tool.args : {};
  const detail = ["path", "file", "pattern", "command", "url", "skill"]
    .map((key) => args[key])
    .find((value) => typeof value === "string" && value.trim());
  return detail ? `${label} ${String(detail).trim()}` : label;
}

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
    getSkillDisplayName: typeof (agent as any)?.getSkillDisplayName === "function"
      ? (name) => (agent as any).getSkillDisplayName(name) : undefined,
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
