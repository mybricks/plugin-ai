import type { RequestAsStreamFn, RequestAsStreamParams, RequestAsStreamEmits } from "./types/request";
import type { AgentEvents } from "./events";
import { AbortError, isAbortError } from "./errors";

/** 每次请求尝试的可组合策略。 */
export type RequestAttemptStrategy = (request: RequestAsStreamFn) => RequestAsStreamFn;

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
  /** 流式请求空闲超时（ms），默认 180000；false 禁用。 */
  timeoutMs?: number | false;
}

/** 与空闲计时共用的模型响应回调；只检查是否调用，不检查参数内容。 */
const RESPONSE_EVENTS = ["write", "onUsage", "onThinking", "onToolCalls", "onToolCallStream", "onFinishReason"] as const;

/** 模型正常完成前没有任何响应回调时报告错误，交由重试机制处理。 */
export function createEmptyResponseStrategy(): RequestAttemptStrategy {
  return (request) => (params) => {
    let hasResponse = false;
    const emits: RequestAsStreamEmits = {
      ...params.emits,
      complete: (value) => {
        if (!hasResponse) {
          params.emits.error(new Error("Model completed without response events"));
          return;
        }
        params.emits.complete(value);
      },
    };
    for (const key of RESPONSE_EVENTS) {
      const original = params.emits[key] as ((value: any) => void) | undefined;
      if (original) (emits as any)[key] = (value: any) => { hasResponse = true; original(value); };
    }
    return request({ ...params, emits });
  };
}

/** 流式请求在指定时间内没有任何事件时失败，并尝试取消底层请求。 */
export function createRequestTimeoutStrategy(timeoutMs: number): RequestAttemptStrategy {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("timeoutMs must be a positive finite number");
  return (request) => (params) => new Promise<void>((resolve, reject) => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const cancelHandlers: Array<() => void> = [];
    const cleanup = () => { active = false; clearTimeout(timer); };
    const cancel = () => {
      for (const fn of cancelHandlers) { try { fn(); } catch { /* best effort */ } }
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        cleanup();
        cancel();
        const error = new Error(`Model request timed out after ${timeoutMs}ms of inactivity`);
        error.name = "TimeoutError";
        reject(error);
      }, timeoutMs);
    };
    const emits: RequestAsStreamEmits = {
      ...params.emits,
      cancel: (fn) => { if (active) cancelHandlers.push(fn); else { try { fn(); } catch { /* best effort */ } } },
      error: (error) => { if (!active) return; cleanup(); reject(error); },
      complete: (value) => { if (!active) return; cleanup(); params.emits.complete(value); resolve(); },
    };
    for (const key of RESPONSE_EVENTS) {
      const original = params.emits[key] as ((value: any) => void) | undefined;
      if (original) (emits as any)[key] = (value: any) => { if (active) { reset(); original(value); } };
    }
    params.emits.cancel(() => { if (active) { cleanup(); cancel(); reject(new AbortError()); } });
    reset();
    try { Promise.resolve(request({ ...params, emits })).catch((error) => { if (active) { cleanup(); reject(error); } }); }
    catch (error) { if (active) { cleanup(); reject(error); } }
  });
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
  const { timeoutMs = 180000 } = retryOpts;
  const strategies: RequestAttemptStrategy[] = [createEmptyResponseStrategy()];
  if (timeoutMs !== false) strategies.push(createRequestTimeoutStrategy(timeoutMs));
  const request = strategies.reduce((next, strategy) => strategy(next), baseFn);
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
          request(params)
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
