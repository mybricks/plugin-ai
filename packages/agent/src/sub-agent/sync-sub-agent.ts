import type { Agent } from "../agent";
import { runChildAgent } from "./execution";
import type { ToolExecutionContext, ToolResult } from "../types";
import type { ChildAgentRequest } from "./types";

/**
 * 同步执行子 Agent：阻塞父 Agent 直到子 Agent 结束，返回最后一次 LLM 迭代的输出。
 *
 * 取消语义集中在这里：ctx.signal 在同步路径上绑定到子 Agent，
 * 父 turn 被取消时中止子 Agent。后台子 Agent 不继承该信号（见 async-sub-agent）。
 */
export async function runSyncSubAgent(
  parent: Agent,
  request: ChildAgentRequest,
  ctx: ToolExecutionContext,
): Promise<ToolResult> {
  // 父 turn 取消时中止子 Agent；后台子 Agent 不绑定该信号。
  const { lastTurn, error, wasCancelled, metadata, summarizeToolCalls } = await runChildAgent({
    createAgent: session => parent.createSubAgent({ system: request.system, tools: request.tools, aiRole: request.aiRole }, session),
    parentAgent: parent,
    ctx,
    subAgentType: request.type,
    title: request.title,
    userText: request.prompt,
    message: request.prompt,
    signal: ctx.signal,
    subscription: { contentThrottleMs: 250 },
  });

  let output = lastTurn?.iterations.slice().reverse().find((iter) => !("type" in iter))?.content ?? "";
  if (error) output = `SubAgent 执行失败: ${error}`;
  if (!output) {
    output = "(SubAgent 未产生输出)";
    if (wasCancelled) output = "(SubAgent 已取消)";
  }
  return {
    output: summarizeToolCalls(output),
    metadata,
  };
}
