import { AbortError } from "./../../../agent/src/errors";
import {
  createAgentRuntime,
  type AgentRuntime,
  type AgentRuntimeState,
  type RuntimeAgent,
} from "./agent-runtime";

export interface AIRequestParams {
  message?: string;
  attachments?: any[];
  focus?: any;
  [key: string]: any;
}

export interface QueueItem {
  id: string;
  message: string;
  attachments?: any[];
  params: AIRequestParams;
  runFn: () => Promise<void>;
}

export interface AgentQueueState {
  running: boolean;
  queue: QueueItem[];
  error?: unknown;
}

interface QueueEntry {
  key: string;
  agent: RuntimeAgent;
  runtime: AgentRuntime;
  unsubscribeRuntime: () => void;
  requestRunning: boolean;
  agentState: AgentRuntimeState;
  queue: QueueItem[];
}

/** 统一本地与远程 Agent 运行态的前端请求队列。 */
export class AgentQueue {
  private entries = new Map<string, QueueEntry>();
  private agentKeys = new WeakMap<RuntimeAgent, string>();
  private listeners = new Map<
    string,
    Set<(state: AgentQueueState) => void>
  >();
  private idCounter = 0;

  getState(agent: RuntimeAgent): AgentQueueState {
    return this.toState(this.ensureEntry(agent));
  }

  subscribe(
    agent: RuntimeAgent,
    listener: (state: AgentQueueState) => void,
  ): () => void {
    const entry = this.ensureEntry(agent);
    const listeners = this.listeners.get(entry.key) ?? new Set();
    listeners.add(listener);
    this.listeners.set(entry.key, listeners);
    listener(this.toState(entry));
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(entry.key);
    };
  }

  /** 发送请求；Agent 或当前请求正在运行时，进入浏览器内队列。 */
  send(
    agent: RuntimeAgent,
    runFn: () => Promise<void>,
    params: AIRequestParams,
  ) {
    const entry = this.ensureEntry(agent);
    if (this.isRunning(entry)) {
      const item: QueueItem = {
        id: `q-${++this.idCounter}`,
        message: params.message ?? "",
        attachments: params.attachments,
        params,
        runFn,
      };
      entry.queue.push(item);
      this.notify(entry);
      return;
    }
    this.run(entry, runFn);
  }

  /** 中止当前正在执行的请求 */
  stop(agent: RuntimeAgent) {
    const entry = this.ensureEntry(agent);
    if (this.isRunning(entry)) void entry.runtime.abort();
  }

  remove(agent: RuntimeAgent, id: string) {
    const entry = this.ensureEntry(agent);
    entry.queue = entry.queue.filter((item) => item.id !== id);
    this.notify(entry);
  }

  private ensureEntry(agent: RuntimeAgent): QueueEntry {
    const key = this.resolveKey(agent);
    const existing = this.entries.get(key);
    if (existing?.agent === agent) return existing;
    existing?.unsubscribeRuntime();

    const runtime = createAgentRuntime(agent);
    const entry: QueueEntry = {
      key,
      agent,
      runtime,
      unsubscribeRuntime: () => {},
      requestRunning: false,
      agentState: runtime.getState(),
      queue: existing?.queue ?? [],
    };
    entry.unsubscribeRuntime = runtime.subscribe((state) => {
      const wasRunning = this.isRunning(entry);
      entry.agentState = state;
      this.notify(entry);
      if (wasRunning && !this.isRunning(entry)) this.drain(entry);
    });
    this.entries.set(key, entry);
    return entry;
  }

  private run(entry: QueueEntry, runFn: () => Promise<void>) {
    entry.requestRunning = true;
    this.notify(entry);
    Promise.resolve(runFn())
      .catch((error: any) => {
        if (!(error instanceof AbortError)) {
          console.error(error);
        }
      })
      .finally(() => {
        entry.requestRunning = false;
        this.notify(entry);
        this.drain(entry);
      });
  }

  private drain(entry: QueueEntry) {
    if (this.isRunning(entry)) return;
    const next = entry.queue.shift();
    this.notify(entry);
    if (next) this.run(entry, next.runFn);
  }

  private isRunning(entry: QueueEntry): boolean {
    return entry.requestRunning || entry.agentState.running;
  }

  private toState(entry: QueueEntry): AgentQueueState {
    return {
      running: this.isRunning(entry),
      queue: [...entry.queue],
      ...(entry.agentState.error !== undefined
        ? { error: entry.agentState.error }
        : {}),
    };
  }

  private notify(entry: QueueEntry) {
    const state = this.toState(entry);
    for (const listener of this.listeners.get(entry.key) ?? []) {
      listener(state);
    }
  }

  private resolveKey(agent: RuntimeAgent): string {
    if (agent.key) return agent.key;
    const existing = this.agentKeys.get(agent);
    if (existing) return existing;
    const key = `agent:${++this.idCounter}`;
    this.agentKeys.set(agent, key);
    return key;
  }
}
