import {
  createCpCommandProxy,
  createFileSystemFindCommandProxy,
  createFileSystemGlobCommandProxy,
  createFileSystemGrepCommandProxy,
  createHeadCommandProxy,
  createMvCommandProxy,
  createRenameCommandProxy,
  createRmCommandProxy,
  createSedCommandProxy,
  createTouchCommandProxy,
  type AgentSandboxCommandProxy,
  type AgentSandboxCommandTransport,
} from "../commands";
import { DEFAULT_BASH_ALLOWED_COMMANDS } from "../commands/helpers/file-access";
import type { AgentSandboxFile, AgentSandboxFileEntry, AgentSandboxFiles, AgentSandboxListOptions } from "../files";
import type { AgentSandbox } from "../types";

export interface SandboxV1 {
  getFiles(): Promise<AgentSandboxFile[]>;
  updateFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  deleteFiles(paths: string[]): Promise<void>;
  getContext?: () => Promise<string | null>;
}

function normalizeDirectoryPath(path = ""): string {
  return path.replace(/^\/+|\/+$/g, "");
}

function isDescendant(directory: string, path: string): boolean {
  const normalizedDirectory = normalizeDirectoryPath(directory);
  const normalizedPath = path.replace(/^\/+/, "");
  return !normalizedDirectory || normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}/`);
}

function listV1Directory(files: AgentSandboxFile[], directory = ""): AgentSandboxFileEntry[] {
  const normalizedDirectory = normalizeDirectoryPath(directory);
  const entries = new Map<string, AgentSandboxFileEntry>();
  for (const file of files) {
    const normalizedPath = file.path.replace(/^\/+/, "");
    if (!isDescendant(normalizedDirectory, normalizedPath)) continue;
    const relative = normalizedDirectory
      ? normalizedPath.slice(normalizedDirectory.length + 1)
      : normalizedPath;
    if (!relative) continue;
    const [name, ...rest] = relative.split("/");
    const entryPath = normalizedDirectory ? `${normalizedDirectory}/${name}` : name;
    if (rest.length > 0) {
      entries.set(entryPath, { path: entryPath, type: "directory" });
      continue;
    }
    const { content: _content, ...entry } = file;
    entries.set(entryPath, { ...entry, path: entryPath, type: "file" });
  }
  return Array.from(entries.values());
}

function listV1Recursively(files: AgentSandboxFile[], directory = ""): AgentSandboxFileEntry[] {
  const normalizedDirectory = normalizeDirectoryPath(directory);
  const entries = new Map<string, AgentSandboxFileEntry>();
  for (const file of files) {
    const normalizedPath = file.path.replace(/^\/+/, "");
    if (!isDescendant(normalizedDirectory, normalizedPath)) continue;
    const relative = normalizedDirectory
      ? normalizedPath.slice(normalizedDirectory.length + 1)
      : normalizedPath;
    if (!relative) continue;
    const segments = relative.split("/");
    for (let index = 1; index < segments.length; index++) {
      const prefix = segments.slice(0, index).join("/");
      const path = normalizedDirectory ? `${normalizedDirectory}/${prefix}` : prefix;
      entries.set(path, { path, type: "directory" });
    }
    const { content: _content, ...entry } = file;
    entries.set(normalizedPath, { ...entry, path: normalizedPath, type: "file" });
  }
  return Array.from(entries.values());
}

export function createAgentSandboxFilesFromV1(sandbox: SandboxV1): AgentSandboxFiles {
  return {
    list: async (path = "", options: AgentSandboxListOptions = {}) => options.recursive
      ? listV1Recursively(await sandbox.getFiles(), path)
      : listV1Directory(await sandbox.getFiles(), path),
    read: async (path) => (await sandbox.getFiles()).find((file) => file.path === path) ?? null,
    readFiles: async (paths) => {
      const requested = new Set(paths);
      return (await sandbox.getFiles()).filter((file) => requested.has(file.path));
    },
    write: async (file) => sandbox.updateFiles([file]),
    writeFiles: sandbox.updateFiles.bind(sandbox),
    remove: async (path) => sandbox.deleteFiles([path]),
    removeFiles: sandbox.deleteFiles.bind(sandbox),
  };
}

export interface CreateAgentSandboxFromV1Options {
  commandTransport?: AgentSandboxCommandTransport;
  commandProxies?: AgentSandboxCommandProxy[];
  /** Commands the V1 files fallback may emulate for the raw bash Tool. */
  allowedCommands?: readonly string[];
}

export function createAgentSandboxFromV1(
  sandbox: SandboxV1,
  options: CreateAgentSandboxFromV1Options = {}
): AgentSandbox {
  const files = createAgentSandboxFilesFromV1(sandbox);
  const allowedCommandList = options.allowedCommands ?? DEFAULT_BASH_ALLOWED_COMMANDS;
  const allowedCommands = new Set(allowedCommandList);
  // Keep V1's command policy visible at the assembly point. A V1 sandbox has
  // no native command transport, so every supported command is files-backed.
  const fileSystemProxies: AgentSandboxCommandProxy[] = [
    createFileSystemFindCommandProxy(files),
    createFileSystemGrepCommandProxy(files),
    createFileSystemGlobCommandProxy(files),
    ...(allowedCommands.has("mv") ? [createMvCommandProxy(files)] : []),
    ...(allowedCommands.has("cp") ? [createCpCommandProxy(files)] : []),
    ...(allowedCommands.has("rm") ? [createRmCommandProxy(files)] : []),
    ...(allowedCommands.has("rename") ? [createRenameCommandProxy(files)] : []),
    ...(allowedCommands.has("touch") ? [createTouchCommandProxy(files)] : []),
    ...(allowedCommands.has("sed") ? [createSedCommandProxy(files)] : []),
    ...(allowedCommands.has("head") ? [createHeadCommandProxy(files)] : []),
  ];
  const commands = {
      execute: options.commandTransport?.execute ?? (async (command) => {
        const [name] = command.trim().split(/\s+/, 1);
        const stdout = name === "mkdir"
          ? "mkdir: command not supported in virtual filesystem\nThe virtual filesystem has no empty directories; create files directly with paths like src/hooks/useThing.ts."
          : `bash: '${name ?? ""}': command not supported in sandbox environment\nThe sandbox only supports virtual filesystem operations. Supported commands: ${allowedCommandList.join(", ")}`;
        return { stdout, exitCode: 1 };
      }),
      allowedCommands: allowedCommandList,
      proxies: [
        ...(options.commandProxies ?? []),
        ...fileSystemProxies,
      ],
  };
  return {
    files,
    commands,
    ...(sandbox.getContext ? { getContext: sandbox.getContext.bind(sandbox) } : {}),
  };
}
