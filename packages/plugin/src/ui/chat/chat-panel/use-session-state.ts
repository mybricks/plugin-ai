import { useEffect, useState } from "react";
import { context } from "../../../context";
import type { RuntimeAgent, AgentRuntimeStage } from "../../../context/agent-runtime";
import type { AgentQueueState, QueueItem } from "../../../context/queue";
import {
  getDefaultSessionStageText,
  type SessionStageTextResolver,
} from "./session-status";

export interface SessionState {
  loading: boolean;
  turnId?: string;
  stage?: AgentRuntimeStage;
  statusText: string;
  pendingQueue: QueueItem[];
  error?: unknown;
}

export interface UseSessionStateOptions {
  /** 覆盖特定 Agent 阶段的默认展示文案。 */
  resolveStageText?: SessionStageTextResolver;
}

/**
 * 仅订阅请求队列与 Agent 运行阶段；消息、iteration 和流式内容仍由 useSession 维护。
 */
export function useSessionState(
  agent: RuntimeAgent | undefined,
  options: UseSessionStateOptions = {},
): SessionState {
  const [queueState, setQueueState] = useState<AgentQueueState>(() =>
    agent
      ? context.aiQueue.getState(agent)
      : { running: false, queue: [] },
  );

  useEffect(() => {
    if (!agent) {
      setQueueState({ running: false, queue: [] });
      return;
    }
    return context.aiQueue.subscribe(agent, setQueueState);
  }, [agent]);

  const stage = queueState.stage;
  return {
    loading: queueState.running,
    ...(queueState.turnId ? { turnId: queueState.turnId } : {}),
    ...(stage ? { stage } : {}),
    statusText:
      options.resolveStageText?.(stage) ??
      getDefaultSessionStageText(stage),
    pendingQueue: queueState.queue,
    ...(queueState.error !== undefined ? { error: queueState.error } : {}),
  };
}
