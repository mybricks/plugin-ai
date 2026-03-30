import { Agents, type BuiltinAgentType } from '../agents';

export interface AIRequestParams {
  message?: string;
  attachments?: any[];
  focus?: any;
  key?: string;
  onProgress?: (...args: any[]) => void;
  onPlan?: (plan: any) => void;
  [key: string]: any;
}

export interface QueueItem {
  id: string;
  message: string;
  attachments?: any[];
  agentType: BuiltinAgentType;
  params: AIRequestParams;
}

type LoadingState = "pending" | "idle";

type EventMap = {
  loading: { key: string; loading: boolean };
  queue: { key: string; queue: QueueItem[] };
};

class Events<T extends Record<string, any>> {
  private listeners: Partial<{ [K in keyof T]: Array<(data: T[K]) => void> }> = {};

  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(handler);
    return () => {
      this.listeners[event] = this.listeners[event]!.filter(h => h !== handler);
    };
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners[event]?.forEach(h => h(data));
  }
}

class AIRequestQueue {
  private loadingKeys = new Set<string>();
  private queues = new Map<string, QueueItem[]>();
  private plans = new Map<string, any>();
  private idCounter = 0;

  readonly events = new Events<EventMap>();

  isLoading(key: string): boolean {
    return this.loadingKeys.has(key);
  }

  getQueue(key: string): QueueItem[] {
    return this.queues.get(key) ?? [];
  }

  /** 发送 AI 请求；如果同 key 正在 loading，自动排队 */
  send(key: string, agentType: BuiltinAgentType, params: AIRequestParams) {
    if (this.loadingKeys.has(key)) {
      const queue = this.queues.get(key) ?? [];
      const item: QueueItem = {
        id: `q-${++this.idCounter}`,
        message: params.message ?? "",
        attachments: params.attachments,
        agentType,
        params,
      };
      queue.push(item);
      this.queues.set(key, queue);
      this.events.emit("queue", { key, queue: [...queue] });
      return;
    }
    this.run(key, agentType, params);
  }

  /** 中止当前正在执行的请求 */
  stop(key: string) {
    this.plans.get(key)?.abort();
  }

  /** 从等待队列中删除某条 */
  removeFromQueue(key: string, id: string) {
    const queue = this.queues.get(key);
    if (!queue) return;
    const next = queue.filter(item => item.id !== id);
    this.queues.set(key, next);
    this.events.emit("queue", { key, queue: [...next] });
  }

  /** 由 agent 内部调用，保存 abort 句柄 */
  setPlan(key: string, plan: any) {
    this.plans.set(key, plan);
  }

  private run(key: string, agentType: BuiltinAgentType, params: AIRequestParams) {
    this.loadingKeys.add(key);
    this.events.emit("loading", { key, loading: true });

    const paramsWithPlan: AIRequestParams = {
      ...params,
      onPlan: (plan: any) => {
        this.plans.set(key, plan);
        params.onPlan?.(plan);
      },
    };

    // @ts-ignore
    Promise.resolve(Agents.requestAgent(agentType, paramsWithPlan))
      .catch((error: any) => {
        console.error(error);
      })
      .finally(() => {
        this.loadingKeys.delete(key);
        this.events.emit("loading", { key, loading: false });

        const queue = this.queues.get(key);
        if (queue?.length) {
          const next = queue.shift()!;
          this.queues.set(key, queue);
          this.events.emit("queue", { key, queue: [...queue] });
          this.run(key, next.agentType, next.params);
        } else {
          this.events.emit("queue", { key, queue: [] });
        }
      });
  }
}

export { AIRequestQueue };
