/**
 * 工具卡片与工具 execute 间的短生命周期通信通道。
 *
 * 它只存在于当前页面运行期：工具通过 ToolExecutionContext.waitUIRender()
 * 等待结果，工具 renderer 通过同一个 toolCallId 提交结果。不会持久化。
 */
export interface ToolUIChannel {
  wait<T>(toolCallId: string, options?: { signal?: AbortSignal }): Promise<T | null>;
  respond(toolCallId: string, value: unknown): boolean;
  cancel(toolCallId: string): boolean;
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

    respond: (toolCallId, value) => settle(toolCallId, value),
    cancel: (toolCallId) => settle(toolCallId, null),
    dispose: () => {
      for (const toolCallId of [...pending.keys()]) settle(toolCallId, null);
    },
  };
}
