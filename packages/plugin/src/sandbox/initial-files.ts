import type { Sandbox, UnifiedFile } from "../../../agent/src";

export type InitialFile = Pick<UnifiedFile, "path" | "content">;

/** 空数组不表示清空工程；只有非空列表才是可合并的初始化快照。 */
export function hasInitialFiles(
  initialFiles?: InitialFile[],
): initialFiles is InitialFile[] {
  return !!initialFiles?.length;
}

/**
 * 将 plugin-ai 提供的初始化文件快照同步到宿主 sandbox。
 * 只更新新增/内容变化的文件，并删除本地可删除但不在快照中的文件。
 * 只读虚拟文件由权限字段保护，不会被删除。
 */
export async function syncInitialFiles(
  sandbox: Sandbox,
  initialFiles: InitialFile[],
): Promise<void> {
  const normalizePath = (path: string) => path.replace(/\\/g, "/").replace(/^\/+/, "");
  const currentFiles = await sandbox.getFiles();
  const desiredByPath = new Map<string, InitialFile>();

  for (const file of initialFiles) {
    desiredByPath.set(normalizePath(file.path), file);
  }

  const currentByPath = new Map(
    currentFiles.map((file) => [normalizePath(file.path), file]),
  );
  const filesToUpdate = Array.from(desiredByPath.values()).filter((file) => {
    return currentByPath.get(normalizePath(file.path))?.content !== file.content;
  });
  const pathsToDelete = currentFiles
    .filter((file) => {
      return !desiredByPath.has(normalizePath(file.path)) && file.permissions?.delete !== false;
    })
    .map((file) => file.path);

  if (filesToUpdate.length) await sandbox.updateFiles(filesToUpdate);
  if (pathsToDelete.length) await sandbox.deleteFiles(pathsToDelete);
}

export interface AttachFilesOptions {
  sandbox: Sandbox;
  initialFiles?: InitialFile[];
  /** remoteAgent 传入 workspace 快照同步；成功时优先使用其结果。 */
  syncWorkspace?: () => Promise<void>;
}

/**
 * 统一挂载文件初始化，并将其作为请求和 workspaceReady 的共同前置条件。
 * - 本地 CodeAgent：仅配置 initialFiles 时 patch；否则直接就绪。
 * - remoteAgent：优先同步 workspace；失败后有 initialFiles 才回退 patch，否则保持失败。
 */
export function attachFiles<T extends { requestAI: (params: any) => Promise<void> }>(
  agent: T,
  { sandbox, initialFiles, syncWorkspace }: AttachFilesOptions,
): Promise<void> {
  const patchInitialFiles = () => {
    if (!hasInitialFiles(initialFiles)) return Promise.resolve();
    return syncInitialFiles(sandbox, initialFiles);
  };
  const ready = syncWorkspace
    ? syncWorkspace().catch(async (error) => {
      if (!hasInitialFiles(initialFiles)) throw error;
      await syncInitialFiles(sandbox, initialFiles);
    })
    : patchInitialFiles();
  // 首个请求或宿主读取 workspaceReady 前失败时，避免触发未处理 rejection；原 Promise 仍保持 reject 状态。
  void ready.catch(() => undefined);
  const requestAI = agent.requestAI.bind(agent);
  agent.requestAI = (async (params: any) => {
    await ready;
    return requestAI(params);
  }) as T["requestAI"];
  return ready;
}
