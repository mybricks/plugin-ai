import type { AgentEventMap, TurnRecord } from "../../../agent/src";

/** Agent 自己定义阶段 key，UI 通过注入的 resolver 决定展示文案。 */
export interface AgentRuntimeStage {
  key: string;
}

/** CodeAgent 在首个 iteration 出现前只有一个模型响应阶段。 */
export const CODE_AGENT_SESSION_STAGE = {
  AWAITING_MODEL: "code:awaiting-model",
} as const;

export interface AgentRuntimeState {
  running: boolean;
  turnId?: string;
  error?: unknown;
  stage?: AgentRuntimeStage;
}

interface AgentEventsLike {
  on<K extends keyof AgentEventMap>(
    event: K,
    handler: (data: AgentEventMap[K]) => void,
  ): () => void;
}

export interface RuntimeAgent {
  key?: string;
  events: AgentEventsLike;
  getTurns(): TurnRecord[];
  abort(): Promise<void> | void;
}

interface RemoteRuntimeAgent extends RuntimeAgent {
  getSessionState(): AgentRuntimeState;
  subscribeSessionState(
    listener: (state: AgentRuntimeState) => void,
  ): () => void;
}

export interface AgentRuntime {
  getState(): AgentRuntimeState;
  subscribe(listener: (state: AgentRuntimeState) => void): () => void;
  abort(): Promise<void> | void;
}

export function createAgentRuntime(agent: RuntimeAgent): AgentRuntime {
  return isRemoteRuntimeAgent(agent)
    ? createRemoteRuntime(agent)
    : createLocalRuntime(agent);
}

function createLocalRuntime(agent: RuntimeAgent): AgentRuntime {
  let state = inferLocalState(agent);

  return {
    getState: () => state,
    subscribe(listener) {
      listener(state);
      const notify = (next: AgentRuntimeState) => {
        state = next;
        listener(state);
      };
      const unsubscribers = [
        agent.events.on("turn:start", ({ turnId }) => {
          notify({
            running: true,
            turnId,
            stage: { key: CODE_AGENT_SESSION_STAGE.AWAITING_MODEL },
          });
        }),
        agent.events.on("turn:resume", ({ turnId }) => {
          notify({
            running: true,
            turnId,
            stage: { key: CODE_AGENT_SESSION_STAGE.AWAITING_MODEL },
          });
        }),
        agent.events.on("turn:complete", () => {
          notify({ running: false });
        }),
        agent.events.on("turn:abort", () => {
          notify({ running: false });
        }),
        agent.events.on("turn:error", ({ error }) => {
          notify({ running: false, error });
        }),
      ];
      return () => {
        for (const unsubscribe of unsubscribers) unsubscribe();
      };
    },
    abort: () => agent.abort(),
  };
}

function createRemoteRuntime(agent: RemoteRuntimeAgent): AgentRuntime {
  return {
    getState: () => agent.getSessionState(),
    subscribe: (listener) => agent.subscribeSessionState(listener),
    abort: () => agent.abort(),
  };
}

function inferLocalState(agent: RuntimeAgent): AgentRuntimeState {
  const turns = agent.getTurns();
  const lastTurn = turns[turns.length - 1];
  return isPendingTurn(lastTurn)
    ? {
        running: true,
        turnId: lastTurn.id,
        stage: { key: CODE_AGENT_SESSION_STAGE.AWAITING_MODEL },
      }
    : { running: false };
}

function isPendingTurn(turn: TurnRecord | undefined): turn is TurnRecord {
  return !!turn && !turn.endTime && turn.status === "success";
}

function isRemoteRuntimeAgent(
  agent: RuntimeAgent,
): agent is RemoteRuntimeAgent {
  return (
    typeof (agent as Partial<RemoteRuntimeAgent>).getSessionState ===
      "function" &&
    typeof (agent as Partial<RemoteRuntimeAgent>).subscribeSessionState ===
      "function"
  );
}
