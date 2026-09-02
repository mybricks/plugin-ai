import type { AgentSandboxFiles } from "../files";
import { createFileSystemFindCommandProxy, createNativeFindCommandProxy } from "./find";
import { createFileSystemGrepCommandProxy, createNativeGrepCommandProxy } from "./grep";
import { createFileSystemGlobCommandProxy, createNativeGlobCommandProxy } from "./glob";
import { createCpCommandProxy } from "./cp";
import { createHeadCommandProxy } from "./head";
import { createMvCommandProxy } from "./mv";
import { createRenameCommandProxy } from "./rename";
import { createRmCommandProxy } from "./rm";
import { createSedCommandProxy } from "./sed";
import { createTouchCommandProxy } from "./touch";
import { getProxyCommand, type CommandRequest } from "./helpers/request";
export { getProxyCommand, isStructuredCommandRequest, parseSimpleCommand } from "./helpers/request";
export type { CommandRequest as AgentSandboxCommandRequest, StructuredCommandRequest } from "./helpers/request";

export interface AgentSandboxCommandExecutionOptions {
  cwd?: string;
  env?: Record<string, string>;
  inheritEnv?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface AgentSandboxCommandResult<TStructured = unknown> {
  stdout: string;
  stderr?: string;
  exitCode: number;
  structured?: TStructured;
  metadata?: Record<string, unknown>;
}

export type AgentSandboxCommandErrorCode =
  | "aborted"
  | "timeout"
  | "spawn_error"
  | "callback_error"
  | "unsupported_structured_command"
  | "unknown";

export class AgentSandboxCommandError extends Error {
  readonly code: AgentSandboxCommandErrorCode;
  readonly result?: AgentSandboxCommandResult;

  constructor(
    code: AgentSandboxCommandErrorCode,
    message: string,
    result?: AgentSandboxCommandResult,
  ) {
    super(message);
    this.name = "AgentSandboxCommandError";
    this.code = code;
    this.result = result;
  }
}

export interface AgentSandboxCommandTransport {
  execute(
    command: string,
    options?: AgentSandboxCommandExecutionOptions
  ): Promise<AgentSandboxCommandResult>;
}

export type AgentSandboxCommandNext = (
  command: string,
  options?: AgentSandboxCommandExecutionOptions
) => Promise<AgentSandboxCommandResult>;

/** A handler explicitly bound to one structured or raw command name. */
export interface AgentSandboxCommandProxy {
  command: string;
  execute: (
    request: CommandRequest,
    next: AgentSandboxCommandNext,
    options?: AgentSandboxCommandExecutionOptions
  ) => Promise<AgentSandboxCommandResult>;
}

export interface AgentSandboxCommands {
  /** Host raw command executor. Proxies call this through `next()`. */
  execute(
    command: CommandRequest,
    options?: AgentSandboxCommandExecutionOptions
  ): Promise<AgentSandboxCommandResult>;
  /**
   * The command set advertised to CodeAgent. It also selects V1's files
   * fallback proxies. The raw executor remains the final authority for
   * allowing or rejecting a command.
   */
  allowedCommands?: readonly string[];
  /** Explicit command handlers, in priority order. */
  proxies?: readonly AgentSandboxCommandProxy[];
}

export interface AgentSandboxGrepInput {
  pattern: string;
  glob?: string;
  outputMode: "files_with_matches" | "content" | "count";
  caseInsensitive: boolean;
  headLimit: number;
  offset: number;
}

export interface AgentSandboxGrepMatch {
  path: string;
  lines?: Array<{ lineNumber: number; content: string }>;
  count?: number;
}

export interface AgentSandboxGrepResult {
  type: "grep";
  pattern: string;
  outputMode: AgentSandboxGrepInput["outputMode"];
  matches: AgentSandboxGrepMatch[];
  totalCount: number;
  offset: number;
  returned: number;
  hasMore: boolean;
}

export interface AgentSandboxFindInput {
  path?: string;
  glob?: string;
}

export interface AgentSandboxFindResult<TEntry = unknown> {
  type: "find";
  entries: TEntry[];
}

export interface AgentSandboxGlobResult {
  type: "glob";
  paths: string[];
}

function createDefaultFileSystemCommandProxies(files: AgentSandboxFiles): AgentSandboxCommandProxy[] {
  // TODO: 当宿主能显式声明并稳定保证 find/rg 等命令能力后，再评估将
  // AgentSandbox 默认策略改为 native；当前必须默认 files，避免用户端
  // PATH 缺失命令导致 grep/glob/find 无响应或不可用。
  // Structured tools default to the portable files implementation. A host may
  // explicitly put a same-name native proxy in `proxies` to override it.
  return [
    createFileSystemFindCommandProxy(files),
    createFileSystemGrepCommandProxy(files),
    createFileSystemGlobCommandProxy(files),
  ];
}

/** Compiles the three public command declarations into CodeAgent's executor. */
export function createAgentSandboxCommandExecutor(
  source: AgentSandboxCommands,
  files: AgentSandboxFiles,
): {
  execute(request: CommandRequest, options?: AgentSandboxCommandExecutionOptions): Promise<AgentSandboxCommandResult>;
} {
  // Explicit declarations always win. This keeps the default portable while a
  // host can selectively use a native command for a known-capable runtime.
  const explicitProxies = source.proxies ?? [];
  const explicitCommands = new Set(explicitProxies.map((proxy) => proxy.command));
  const proxies = [
    ...explicitProxies,
    ...createDefaultFileSystemCommandProxies(files).filter((proxy) => !explicitCommands.has(proxy.command)),
  ];
  return {
    async execute(request, options) {
      const command = getProxyCommand(request)?.name;
      const proxy = command ? proxies.find((candidate) => candidate.command === command) : undefined;
      if (proxy) {
        return proxy.execute(
          request,
          (nextCommand, nextOptions = options) => source.execute(nextCommand, nextOptions),
          options,
        );
      }
      if (typeof request !== "string") {
        throw new AgentSandboxCommandError(
          "unsupported_structured_command",
          `No AgentSandbox command proxy registered for structured command: ${request.name}`,
        );
      }
      return source.execute(request, options);
    },
  };
}

/**
 * Filesystem command proxies are intentionally exported one by one. The
 * find/grep/glob use files proxies by default. V1 adapter additionally
 * declares its raw bash mutation proxies to preserve V1 behavior.
 */
export {
  createFileSystemFindCommandProxy,
  createNativeFindCommandProxy,
  createFileSystemGrepCommandProxy,
  createNativeGrepCommandProxy,
  createFileSystemGlobCommandProxy,
  createNativeGlobCommandProxy,
  createMvCommandProxy,
  createCpCommandProxy,
  createRmCommandProxy,
  createRenameCommandProxy,
  createTouchCommandProxy,
  createSedCommandProxy,
  createHeadCommandProxy,
};
