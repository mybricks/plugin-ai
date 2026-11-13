/**
 * 工具卡片与工具 execute 间的短生命周期通信通道。
 *
 * 它只存在于当前页面运行期：工具通过 ToolExecutionContext.waitUIRender()
 * 等待结果，工具 renderer 通过同一个 toolCallId 提交结果。不会持久化。
 */
export interface ToolUIChannel {
  wait<T>(toolCallId: string, options?: { signal?: AbortSignal }): Promise<T | null>;
  /**
   * 提交结果。返回的 Promise 在“提交被真正消费”时才 resolve：
   * 多数场景下 wait() 已经在等待，提交会同步被消费，Promise 几乎立即 resolve；
   * 少数场景（如远端 Browser Tool 尚未下发）下，Promise 会挂起直到 wait() 真正到来。
   */
  respond(toolCallId: string, value: unknown): Promise<boolean>;
  cancel(toolCallId: string): Promise<boolean>;
  dispose(): void;
}

type PendingResponse = {
  resolve: (value: unknown | null) => void;
  cleanup: () => void;
};

/** 创建一个可注入 Agent 与聊天 UI 的工具交互通道。 */
export function createToolUIChannel(): ToolUIChannel {
  const pending = new Map<string, PendingResponse>();

  const settle = (toolCallId: string, value: unknown | null): boolean => {
    const entry = pending.get(toolCallId);
    if (!entry) return false;
    pending.delete(toolCallId);
    entry.cleanup();
    entry.resolve(value);
    return true;
  };

  return {
    wait<T>(toolCallId: string, options: { signal?: AbortSignal } = {}) {
      if (pending.has(toolCallId)) {
        return Promise.reject(new Error(`Tool UI is already waiting for call: ${toolCallId}`));
      }

      if (options.signal?.aborted) return Promise.resolve(null);

      return new Promise<T | null>((resolve) => {
        const onAbort = () => settle(toolCallId, null);
        const cleanup = () => {
          options.signal?.removeEventListener("abort", onAbort);
        };

        pending.set(toolCallId, { resolve: resolve as (value: unknown | null) => void, cleanup });
        options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    },

    respond: (toolCallId, value) => Promise.resolve(settle(toolCallId, value)),
    cancel: (toolCallId) => Promise.resolve(settle(toolCallId, null)),
    dispose: () => {
      for (const toolCallId of [...pending.keys()]) settle(toolCallId, null);
    },
  };
}
