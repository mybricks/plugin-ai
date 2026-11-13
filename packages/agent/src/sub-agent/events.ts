import { type SubAgentCreatedInfo } from "../events";
import type { AgentEventMap } from "../events";
import type { SubAgentTurnRecord, TurnRecord } from "../types";

/**
 * 将子 Agent 的原生事件回放到独立的子 turn 视图，不修改或持久化父 turn。
 *
 * 与旧的 subagent:event 模型不同，原生事件不再携带父子关联字段，
 * 身份信息由 `subagent:created` 一次性提供。
 *
 * @param children 子 turn 集合，原地更新
 * @param info     子 Agent 身份信息
 * @param event    原生事件名
 * @param data     原生事件载荷
 * @returns 是否产生变更
 */
export function applyChildAgentEvent<K extends keyof AgentEventMap>(
  children: SubAgentTurnRecord[],
  info: SubAgentCreatedInfo,
  event: K,
  data: AgentEventMap[K],
): boolean {
  const index = children.findIndex(turn => turn.id === info.turnId);
  const record: SubAgentTurnRecord = index < 0
    ? {
        id: info.turnId, agentKey: info.agentKey, parentAgentKey: info.parentAgentKey,
        parentTurnId: info.parentTurnId, callId: info.callId, subAgentType: info.subAgentType,
        title: info.title, async: info.async, startTime: info.createdAt, userText: "",
        userAttachments: [], iterations: [], status: "success" as const,
      }
    : children[index];

  record.iterations = record.iterations.map(iter =>
    "type" in iter ? { ...iter } : { ...iter, toolCalls: iter.toolCalls.map(tool => ({ ...tool })) },
  );

  switch (event) {
    case "subagent:created":
      // 身份信息已用于建记录，无需额外字段；保持 pending 状态等子 Agent 自身事件推进。
      break;
    case "turn:start": {
      const payload = data as AgentEventMap["turn:start"];
      record.userText = payload.message;
      record.userAttachments = payload.attachments ?? [];
      break;
    }
    case "turn:complete":
    case "turn:abort":
    case "turn:error": {
      record.status = event === "turn:complete" ? "success" : event === "turn:abort" ? "abort" : "error";
      record.endTime = Date.now();
      if (event === "turn:error") {
        const payload = data as AgentEventMap["turn:error"];
        record.error = String(payload.error?.message ?? payload.error);
        record.errorCode = payload.errorCode;
      }
      break;
    }
    case "llm:retry":
      break;
    default: {
      const payload = data as { iterId?: string };
      const iterId = payload.iterId;
      if (!iterId) break;
      let iter = record.iterations.find(iter => !("type" in iter) && iter.iterId === iterId);
      if (!iter) {
        iter = { iterId, startTime: Date.now(), content: "", toolCalls: [] };
        record.iterations.push(iter);
      }
      if ("type" in iter) break;
      if (event === "llm:start") {
        iter.startTime = (data as AgentEventMap["llm:start"]).startTime;
      } else if (event === "llm:content") {
        const payload = data as AgentEventMap["llm:content"];
        iter.content = payload.content;
        iter.thinkingContent = payload.thinkingContent;
      } else if (event === "llm:complete") {
        const payload = data as AgentEventMap["llm:complete"];
        iter.endTime = payload.endTime;
        iter.usage = payload.usage;
        Object.assign(iter, { finishReason: payload.finishReason });
      } else if (event === "tool:call") {
        const payload = data as AgentEventMap["tool:call"];
        insertToolCall(iter, payload.callId, {
          callId: payload.callId, name: payload.name, args: payload.args, status: "pending",
          execStartTime: payload.startTime, execEndTime: 0, title: payload.title,
        });
      } else if (event === "tool:result") {
        const payload = data as AgentEventMap["tool:result"];
        const tool = findToolCall(record, payload.callId);
        if (tool) {
          tool.status = "success";
          tool.result = payload.result;
          tool.execEndTime = payload.endTime;
          if (payload.title) tool.title = payload.title;
        }
      } else if (event === "tool:error") {
        const payload = data as AgentEventMap["tool:error"];
        const tool = findToolCall(record, payload.callId);
        if (tool) {
          tool.status = "error";
          tool.error = payload.error;
          tool.errorType = payload.errorType;
          tool.result = payload.result;
          tool.execEndTime = payload.endTime;
          if (payload.title) tool.title = payload.title;
        }
      } else if (event === "tool:args") {
        const payload = data as AgentEventMap["tool:args"];
        const tool = findToolCall(record, payload.callId);
        if (tool) Object.assign(tool, { argsContent: payload.content });
      } else if (event === "tool:progress") {
        const payload = data as AgentEventMap["tool:progress"];
        const tool = findToolCall(record, payload.callId);
        if (tool) Object.assign(tool, { progress: payload.data });
      }
    }
  }

  if (index < 0) children.push(record);
  else children[index] = record;
  return true;
}

/** 在 iter 内插入一次工具调用，同一 callId 只保留一条。 */
function insertToolCall(
  iter: Exclude<TurnRecord["iterations"][number], { type: string }>,
  callId: string,
  tool: NonNullable<ReturnType<typeof findToolCall>>,
): void {
  const existing = iter.toolCalls.find(call => call.callId === callId);
  if (existing) {
    existing.name = tool.name;
    existing.args = tool.args;
    existing.title = tool.title;
    existing.execStartTime = tool.execStartTime;
    existing.status = "pending";
    return;
  }
  iter.toolCalls.push(tool);
}

/** 在所有 iter 中查找某次工具调用。 */
function findToolCall(record: SubAgentTurnRecord, callId: string) {
  for (const iter of record.iterations) {
    if ("type" in iter) continue;
    const tool = iter.toolCalls.find(call => call.callId === callId);
    if (tool) return tool;
  }
  return undefined;
}
