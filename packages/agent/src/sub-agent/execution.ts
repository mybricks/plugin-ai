import type { Agent } from "../agent";
import type { History } from "../types";
import { createAgentKey, randomUUID } from "../uuid";
import { createChildAgentBridge, createChildAgentRecord } from "./bridge";
import type { ChildAgentBridge, ChildAgentRequestResult, CreateChildAgentBridgeOptions } from "./bridge";

/** 两种执行模式使用相同的创建、事件订阅、请求和收尾步骤。 */
export interface ChildAgentExecutionOptions extends Omit<CreateChildAgentBridgeOptions, "subAgent"> {
  createAgent: (session: { key: string; history?: History }) => Agent;
  message: string;
  signal?: AbortSignal;
  subscription?: Parameters<ChildAgentBridge["subscribe"]>[0];
}

export type ChildAgentExecutionResult = ChildAgentRequestResult & {
  metadata: ReturnType<ChildAgentBridge["metadata"]>;
  summarizeToolCalls: (output: string) => string;
};

/**
 * 启动子 Agent 并返回完成 Promise。同步和后台均会在执行开始前发出 `subagent:created`，
 * 订阅方据此按 turnId 订阅该子任务的原生事件流。
 */
export async function startChildAgent(options: ChildAgentExecutionOptions): Promise<{
  completion: Promise<ChildAgentExecutionResult>;
}> {
  const record = options.record ?? createChildAgentRecord({
    agentKey: createAgentKey(), turnId: randomUUID(),
    parentAgentKey: options.parentAgent.key,
    parentTurnId: options.ctx.turnId ?? options.parentAgent.getTurns().slice(-1)[0]?.id ?? "",
    callId: options.ctx.callId ?? "", subAgentType: options.subAgentType,
    title: options.title, userText: options.userText,
  });
  const session = await options.parentAgent.createChildSession(record);
  const subAgent = options.createAgent(session);
  const bridge = createChildAgentBridge({ ...options, record, subAgent });
  if ("error" in bridge) throw new Error(bridge.error);

  // 先登记实例再发通知，保证订阅方收到 subagent:created 时一定能取到 agent.events。
  options.parentAgent.registerChildAgent(record.id, subAgent);
  options.parentAgent.events.emit("subagent:created", {
    turnId: record.id,
    parentTurnId: record.parentTurnId,
    parentAgentKey: options.parentAgent.key ?? "",
    agentKey: record.agentKey,
    callId: record.callId,
    subAgentType: options.subAgentType,
    title: options.title,
    async: record.async === true,
    status: "running",
    createdAt: record.startTime,
  });

  const dispose = bridge.subscribe(options.subscription);
  const unbind = bindAbortSignal(options.signal, () => subAgent.abort());
  const completion = (async () => {
    try {
      const result = await bridge.runRequest(options.message);
      bridge.applyTurn(result.lastTurn, result.status, result.error);
      bridge.finish(result.lastTurn, result.status, result.error);
      return {
        ...result,
        metadata: bridge.metadata(),
        summarizeToolCalls: bridge.summarizeToolCalls,
      };
    } finally {
      unbind();
      dispose();
      // 事件写入依赖订阅方的 finally 收口，实例引用要等到这里才释放。
      options.parentAgent.releaseChildAgent(record.id);
    }
  })();
  return { completion };
}

/** 启动后等待结果；取消信号可由调用方传入，事件仍可实时订阅。 */
export async function runChildAgent(options: ChildAgentExecutionOptions): Promise<ChildAgentExecutionResult> {
  const { completion } = await startChildAgent(options);
  return completion;
}

/**
 * 把一个 AbortSignal 桥接到 fork 出来的子 Agent 上。
 *
 * 取消是调用方的策略，不是 bridge 的固有行为：
 *   - 同步子 Agent 阻塞父 turn，父 turn 取消时应当中止子 Agent，由调用方绑定；
 *   - 后台子 Agent 独立于父 turn 生命周期，不绑定任何信号。
 *
 * 已取消的信号会在绑定时立即触发一次。
 *
 * @returns 解绑函数，必须在子 Agent 结束时调用，避免监听器泄漏
 */
function bindAbortSignal(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) return () => {};
  if (signal.aborted) {
    onAbort();
    return () => {};
  }
  signal.addEventListener("abort", onAbort, { once: true });
  return () => signal.removeEventListener("abort", onAbort);
}
