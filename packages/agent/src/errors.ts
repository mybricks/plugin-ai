/**
 * 表示操作被主动取消的错误
 * 
 * 这不是一个真正的错误，而是用于中断 Promise 链并向上传播取消信号。
 * 调用者应该在 catch 中识别并静默处理此错误。
 */
export class AbortError extends Error {
  constructor() {
    super('Aborted');
    this.name = 'AbortError';
  }
}

/**
 * 检查是否是 AbortError
 */
export function isAbortError(error: unknown): error is AbortError {
  return error instanceof AbortError;
}
