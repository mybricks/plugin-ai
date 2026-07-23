import type { RequestAsStreamFn, RequestAsStreamParams } from "../../request/src";
import type { AgentEvents } from "./events";
import { AbortError, isAbortError } from "./errors";

/**
 * 重试配置项
 */
export interface RetryOptions {
  /** 最大重试次数（不含首次），默认 2（即首次+2次重试=共3次尝试） */
  maxRetries?: number;
  /** 初始退避延迟（ms），默认 1000 */
  baseDelayMs?: number;
  /** 最大退避延迟（ms），默认 30000 (30秒) */
  maxDelayMs?: number;
}

/**
 * 包装 request 函数，添加重试逻辑
 *
 * @param baseFn 原始的 request 函数
 * @param retryOpts 重试配置
 * @param events Agent 的事件发射器（用于触发 llm:retry 事件）
 * @returns 包装后的 request 函数
 */
export function wrapRequestWithRetry(
  baseFn: RequestAsStreamFn,
  retryOpts: RetryOptions,
  events: AgentEvents
): RequestAsStreamFn {
  return async (params: RequestAsStreamParams) => {
    const { maxRetries = 2, baseDelayMs = 1000, maxDelayMs = 30000 } = retryOpts;

    // 从 params 中提取 step（callLLM 时会通过 rest 传入）
    const step = (params as any)._step ?? 0;

    // 保存原始 error handler
    const originalError = params.emits.error;

    // 创建内部的 AbortController 用于取消重试
    const retryAbortController = new AbortController();

    // 通过 emits.cancel 注册取消回调
    params.emits.cancel(() => {
      retryAbortController.abort();
    });

    let currentAttempt = 0;

    // 重试循环
    while (currentAttempt <= maxRetries) {
      // 检查是否已取消
      if (retryAbortController.signal.aborted) {
        throw new AbortError();
      }

      try {
        // 包装 error handler，捕获本次尝试的错误
        await new Promise<void>((resolve, reject) => {
          const abortHandler = () => reject(new AbortError());
          retryAbortController.signal.addEventListener('abort', abortHandler);

          const cleanup = () => {
            retryAbortController.signal.removeEventListener('abort', abortHandler);
          };

          // 临时包装 error handler
          params.emits.error = (err: any) => {
            cleanup();
            reject(err);
          };

          // 执行请求
          baseFn(params)
            .then(() => {
              cleanup();
              resolve();
            })
            .catch((err) => {
              cleanup();
              reject(err);
            });
        });

        // 成功，退出循环
        return;
      } catch (err: any) {
        // 检查是否是取消导致的错误
        if (isAbortError(err) || retryAbortController.signal.aborted) {
          // 恢复原始 error handler 并调用
          params.emits.error = originalError;
          originalError(err);
          throw err;
        }

        const isLastAttempt = currentAttempt >= maxRetries;

        // 最后一次尝试失败，抛出错误
        if (isLastAttempt) {
          // 恢复原始 error handler 并调用
          params.emits.error = originalError;
          originalError(err);
          throw err;
        }

        // 还有重试机会，触发重试事件
        events.emit('llm:retry', {
          step,
          attempt: currentAttempt + 1,
          maxRetries,
        });

        // 计算延迟（指数退避 + 抖动）
        const exponentialDelay = baseDelayMs * Math.pow(2, currentAttempt);
        const jitter = 0.5 + Math.random() * 0.5;
        const delay = Math.min(maxDelayMs, exponentialDelay * jitter);

        // 等待后重试
        try {
          await sleep(delay, retryAbortController.signal);
        } catch (sleepErr) {
          // sleep 被取消
          params.emits.error = originalError;
          originalError(sleepErr);
          throw sleepErr;
        }

        currentAttempt++;
      }
    }
  };
}

/**
 * 睡眠指定毫秒数，支持 AbortSignal 取消
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const timeout = setTimeout(resolve, ms);

    if (signal) {
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new AbortError());
      };
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  });
}
