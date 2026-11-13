import type { Agent } from "../agent";
import { createChildAgentRecord } from "./bridge";
import { startChildAgent } from "./execution";
import type { ToolResult } from "../types";
import { createAgentKey, randomUUID } from "../uuid";
import type { BackgroundSubAgentInfo, BackgroundSubAgentRequest, SubAgentMetadata } from "./types";

/** 后台启动子 Agent，立即返回会话标识；进度通过 `subagent:created` + 子事件总线获取。 */
export async function runBackgroundSubAgent(
  parent: Agent,
  request: BackgroundSubAgentRequest,
): Promise<ToolResult> {
  const info = await parent.spawnBackgroundSubAgent(request);
  const metadata: SubAgentMetadata & { async: true; type: string } = {
    agentKey: info.agentKey,
    turnId: info.turnId,
    parentAgentKey: info.parentAgentKey,
    parentTurnId: info.parentTurnId,
    parentToolCallId: info.parentToolCallId,
    subAgentType: info.type,
    title: info.title,
    startedAt: info.startedAt,
    async: true,
    type: info.type,
  };
  return {
    output: `Background sub-agent started: ${info.agentKey}`,
    metadata,
  };
}

/**
 * 启动一个后台子 Agent：立即返回会话标识，子 Agent 在后台继续执行，
 * 进度通过 `subagent:created` 通知 + 子 Agent 自身事件总线上报，
 * 持久化时机遵循父 History 的 turn / iter 模式。
 *
 * 不继承父 turn 的取消信号：后台子 Agent 有独立的生命周期，
 * 父 turn 结束后仍可继续运行。
 *
 * 校验：传入 request 时必须满足——
 *   - parentTurnId 对应的 turn 存在
 *   - parentToolCallId 对应的 toolCall 存在于该 turn 的某个 iter
 */
export async function startBackgroundSubAgent(
  parent: Agent,
  request: BackgroundSubAgentRequest,
): Promise<BackgroundSubAgentInfo> {
  const parentTurn = parent.getTurns().find((turn) => turn.id === request.parentTurnId);
  const iteration = parentTurn?.iterations.find(
    (iter) => !("type" in iter) && iter.toolCalls.some((call) => call.callId === request.parentToolCallId),
  );
  if (!parentTurn || !iteration) throw new Error("SubAgent parent tool call not found");

  const record = createChildAgentRecord({
    // agentKey 是子 Agent 的唯一标识，短格式便于日志和界面展示。
    agentKey: createAgentKey(),
    turnId: randomUUID(),
    parentAgentKey: request.parentAgentKey,
    parentTurnId: request.parentTurnId,
    callId: request.parentToolCallId,
    subAgentType: request.type,
    title: request.title,
    userText: request.prompt,
    async: true,
  });
  const info: BackgroundSubAgentInfo = {
    agentKey: record.agentKey,
    turnId: record.id,
    parentAgentKey: request.parentAgentKey,
    parentTurnId: request.parentTurnId,
    parentToolCallId: request.parentToolCallId,
    type: request.type,
    title: request.title,
    status: "running",
    startedAt: record.startTime,
  };

  // 后台执行，不阻塞调用方；不绑定取消信号，生命周期独立于父 turn。
  const { completion } = await startChildAgent({
    createAgent: session => parent.createSubAgent(
      { system: request.system, tools: request.tools, aiRole: request.aiRole },
      session,
    ),
    parentAgent: parent,
    record,
    ctx: { turnId: request.parentTurnId, callId: request.parentToolCallId },
    subAgentType: request.type,
    title: request.title,
    userText: request.prompt,
    message: request.prompt,
  });
  void completion.catch((error) => console.error("[SubAgent] finalization failed", error));

  return info;
}
