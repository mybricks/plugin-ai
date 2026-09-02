import type { AgentSandbox } from "../types";
import type { AgentSandboxFile, AgentSandboxFiles } from "./index";

export interface AgentSandboxOverlay {
  sandbox: AgentSandbox;
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "");
}

/**
 * Adds virtual files and file permissions only. Compile command proxies with
 * createAgentSandboxRuntime before applying this overlay.
 */
export function createAgentSandboxOverlay(
  base: AgentSandbox,
  getVirtualFiles: () => AgentSandboxFile[],
): AgentSandboxOverlay {
  const read = async (path: string): Promise<AgentSandboxFile | null> => {
    const virtualFile = getVirtualFiles().find((file) => normalizePath(file.path) === normalizePath(path));
    return virtualFile ?? base.files.read(path);
  };

  const readFiles = async (paths: string[]): Promise<AgentSandboxFile[]> => {
    const virtualFileMap = new Map(getVirtualFiles().map((file) => [normalizePath(file.path), file]));
    const realPaths = paths.filter((path) => !virtualFileMap.has(normalizePath(path)));
    const realFiles = await base.files.readFiles(realPaths);
    const realFileMap = new Map(realFiles.map((file) => [normalizePath(file.path), file]));
    return paths.flatMap((path) => {
      const normalizedPath = normalizePath(path);
      const virtualFile = virtualFileMap.get(normalizedPath);
      if (virtualFile) return [virtualFile];
      const realFile = realFileMap.get(normalizedPath);
      return realFile ? [realFile] : [];
    });
  };

  const assertWritable = async (path: string) => {
    const file = await read(path);
    if (file?.permissions && !file.permissions.write) throw new Error(`${path} is read-only`);
  };

  const assertDeletable = async (path: string) => {
    const file = await read(path);
    if (file?.permissions && !file.permissions.delete) throw new Error(`${path} cannot be deleted`);
  };

  const assertWritableFiles = async (paths: string[]) => {
    const filesByPath = new Map((await readFiles(paths)).map((file) => [normalizePath(file.path), file]));
    paths.forEach((path) => {
      const file = filesByPath.get(normalizePath(path));
      if (file?.permissions && !file.permissions.write) throw new Error(`${path} is read-only`);
    });
  };

  const assertDeletableFiles = async (paths: string[]) => {
    const filesByPath = new Map((await readFiles(paths)).map((file) => [normalizePath(file.path), file]));
    paths.forEach((path) => {
      const file = filesByPath.get(normalizePath(path));
      if (file?.permissions && !file.permissions.delete) throw new Error(`${path} cannot be deleted`);
    });
  };

  const files: AgentSandboxFiles = {
    list: base.files.list.bind(base.files),
    read,
    readFiles,
    write: async (file) => {
      await assertWritable(file.path);
      await base.files.write(file);
    },
    writeFiles: async (wfiles) => {
      await assertWritableFiles(wfiles.map((file) => file.path));
      await base.files.writeFiles(wfiles);
    },
    remove: async (path) => {
      await assertDeletable(path);
      await base.files.remove(path);
    },
    removeFiles: async (paths) => {
      await assertDeletableFiles(paths);
      await base.files.removeFiles(paths);
    },
  };

  return {
    sandbox: {
      files,
      commands: base.commands,
      ...(base.getContext ? { getContext: base.getContext.bind(base) } : {}),
    },
  };
}
