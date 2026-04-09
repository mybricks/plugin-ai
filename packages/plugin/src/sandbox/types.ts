/**
 * Designer 接口：由组件库通过 window._registSandBox_ 注入。
 * 同时提供文件系统操作和设计器实时状态能力。
 */
export interface Designer {
  // ── 文件系统 ────────────────────────────────────────────────────────────────
  getFiles(): Promise<Array<{ path: string; content: string }>>;
  /**
   * 写入文件，失败时 reject（抛出错误）。
   */
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  /**
   * 删除文件，失败时 reject（抛出错误）。
   */
  deleteFiles(paths: string[]): Promise<void>;
  // ── 设计器状态 ───────────────────────────────────────────────────────────────
  /**
   * 获取设计器实时渲染状态并格式化为 Markdown。
   */
  exportDesignerToMessage(): Promise<string>;
  /**
   * 获取运行日志并格式化为 Markdown。
   */
  exportLogsToMessage(): string;
  /**
   * 实时获取当前 runtimeMode（`${comId}_edit` / `${comId}_runtime_mock` 等）。
   */
  getRuntimeMode(): string | undefined;
  /**
   * 导出当前项目上下文为字符串，用于每轮请求时注入到 getContextMessages。
   * 例如：当前项目代码、组件结构等。
   */
  exportToMessage(): string;
}

/**
 * 沙箱 hooks，供组件库在关键时机执行初始化。
 */
export interface Hooks {
  /**
   * 大模型发送请求前（用户回车后）的钩子，在 buildMessages 之前调用。
   * 组件库可在此时机初始化快照（锁定 runtimeMode、收集日志等），
   * 确保 exportDesignerToMessage / exportLogsToMessage 读到正确的状态。
   */
  beforeRequest?: (params: { message: string; attachments: any[] }) => Promise<void> | void;
}

/**
 * window._registSandBox_ 的第二个参数。
 */
export interface RegistSandBoxConfig {
  designer: Designer;
  hooks?: Hooks;
}
