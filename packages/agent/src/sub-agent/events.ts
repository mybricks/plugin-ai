import type { SubAgentEvent } from "../events";
import type { SubAgentTurnRecord, TurnRecord } from "../types";

/**
 * 将 SSE 事件回放到独立的子 turn 视图，不修改或持久化父 turn。
 */
export function applySubAgentEvent(children: SubAgentTurnRecord[], event: SubAgentEvent): boolean {
  const index = children.findIndex(turn => turn.id === event.turnId);
  const record: SubAgentTurnRecord = event.turn
    ? { ...structuredClone(event.turn), parentTurnId: event.parentTurnId }
    : {
        ...(index < 0
          ? {
              id: event.turnId, agentKey: event.agentKey, parentAgentKey: event.parentAgentKey, parentTurnId: event.parentTurnId,
              callId: event.callId, subAgentType: event.subAgentType, title: event.title,
              async: event.async, startTime: event.createdAt, userText: "", userAttachments: [],
              iterations: [], status: "success" as const,
            }
          : children[index]),
      };
  if (!event.turn) {
    record.iterations = record.iterations.map(iter =>
      "type" in iter ? { ...iter } : { ...iter, toolCalls: iter.toolCalls.map(tool => ({ ...tool })) },
    );
    switch (event.event) {
      case "turn:start":
        record.userText = event.data.message;
        record.userAttachments = event.data.attachments ?? [];
        break;
      case "turn:complete":
      case "turn:abort":
      case "turn:error":
        record.status = event.event === "turn:complete" ? "success" : event.event === "turn:abort" ? "abort" : "error";
        record.endTime = event.createdAt;
        if (event.event === "turn:error") {
          record.error = String(event.data.error?.message ?? event.data.error);
          record.errorCode = event.data.errorCode;
        }
        break;
      case "llm:retry":
        break;
      default: {
        let iter = record.iterations.find(iter => !("type" in iter) && iter.iterId === event.data.iterId);
        if (!iter) {
          iter = { iterId: event.data.iterId, startTime: event.createdAt, content: "", toolCalls: [] };
          record.iterations.push(iter);
        }
        if ("type" in iter) break;
        if (event.event === "llm:start") {
          iter.startTime = event.data.startTime;
        } else if (event.event === "llm:content") {
          iter.content = event.data.content;
          iter.thinkingContent = event.data.thinkingContent;
        } else if (event.event === "llm:complete") {
          iter.endTime = event.data.endTime;
          iter.usage = event.data.usage;
          Object.assign(iter, { finishReason: event.data.finishReason });
        } else {
          let tool = iter.toolCalls.find(tool => tool.callId === event.data.callId);
          if (!tool) {
            tool = {
              callId: event.data.callId, name: event.data.name, args: {}, status: "pending",
              execStartTime: event.createdAt, execEndTime: 0,
            };
            iter.toolCalls.push(tool);
          }
          if (event.event === "tool:call") {
            tool.args = event.data.args;
            tool.title = event.data.title;
            tool.execStartTime = event.data.startTime;
          } else if (event.event === "tool:result") {
            tool.status = "success";
            tool.result = event.data.result;
            tool.execEndTime = event.data.endTime;
          } else if (event.event === "tool:error") {
            tool.status = "error";
            tool.error = event.data.error;
            tool.errorType = event.data.errorType;
            tool.result = event.data.result;
            tool.execEndTime = event.data.endTime;
          } else if (event.event === "tool:args") {
            Object.assign(tool, { argsContent: event.data.content });
          } else if (event.event === "tool:progress") {
            Object.assign(tool, { progress: event.data.data });
          }
        }
      }
    }
  }
  if (index < 0) children.push(record);
  else children[index] = record;
  return true;
}
