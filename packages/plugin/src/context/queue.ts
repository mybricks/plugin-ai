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

/** 防并发 AI 请求队列 */
export class AIRequestQueue {
  private loadingKeys = new Set<string>();
  private queues = new Map<string, QueueItem[]>();
  private abortMap = new Map<string, () => void>();
  private idCounter = 0;

  readonly events = new Events<EventMap>();

  isLoading(key: string): boolean {
    return this.loadingKeys.has(key);
  }

  getQueue(key: string): QueueItem[] {
    return this.queues.get(key) ?? [];
  }

  /** 发送请求；如果同 key 正在 loading，自动排队 */
  send(key: string, runFn: () => Promise<void>, params: AIRequestParams) {
    if (this.loadingKeys.has(key)) {
      const queue = this.queues.get(key) ?? [];
      const item: QueueItem = {
        id: `q-${++this.idCounter}`,
        message: params.message ?? "",
        attachments: params.attachments,
        params,
        runFn,
      };
      queue.push(item);
      this.queues.set(key, queue);
      this.events.emit("queue", { key, queue: [...queue] });
      return;
    }
    this.run(key, runFn, params);
  }

  /** 注册当前请求的 abort 函数（由 runFn 内部调用，通常是 agent.abort） */
  registerAbort(key: string, abortFn: () => void) {
    this.abortMap.set(key, abortFn);
  }

  /** 中止当前正在执行的请求 */
  stop(key: string) {
    this.abortMap.get(key)?.();
  }
  removeFromQueue(key: string, id: string) {
    const queue = this.queues.get(key);
    if (!queue) return;
    const next = queue.filter(item => item.id !== id);
    this.queues.set(key, next);
    this.events.emit("queue", { key, queue: [...next] });
  }

  /** 清空指定 key 的排队消息（不影响当前正在执行的请求） */
  clearQueue(key: string) {
    this.queues.set(key, []);
    this.events.emit("queue", { key, queue: [] });
  }

  private run(key: string, runFn: () => Promise<void>, _params: AIRequestParams) {
    this.loadingKeys.add(key);
    this.events.emit("loading", { key, loading: true });

    Promise.resolve(runFn())
      .catch((error: any) => console.error(error))
      .finally(() => {
        this.loadingKeys.delete(key);
        this.abortMap.delete(key);
        this.events.emit("loading", { key, loading: false });

        const queue = this.queues.get(key);
        if (queue?.length) {
          const next = queue.shift()!;
          this.queues.set(key, queue);
          this.events.emit("queue", { key, queue: [...queue] });
          // 执行队列中的下一个请求
          this.run(key, next.runFn, next.params);
        } else {
          this.events.emit("queue", { key, queue: [] });
        }
      });
  }
}
