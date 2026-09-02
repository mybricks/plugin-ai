import { CodeAgent, createAgentSandboxFromV1 } from "@agent/index";
import {
  createAgentSandboxOverlay,
  createAgentSandboxRuntime,
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
} from "@agent/agent-sandbox";
import {
  createBashTool,
  createDeleteTool,
  createEditTool,
  createGrepTool,
  createGlobTool,
  createMultiWriteTool,
  createHistoryReadTool,
  createReadTool,
  createWriteTool,
} from "@agent/code-agent/tools";
import type { AgentSandbox, AgentSandboxCommandExecutionOptions } from "@agent/agent-sandbox";
import type { AgentHooks } from "@agent/index";
import type { Tool, ToolExecutionContext, ToolResult, TurnRecord } from "@agent/types";
import type { FsFile } from "./lib/mem-fs";
import { MemFS } from "./lib/mem-fs";

export type ToolContractSandboxKind = "v1" | "agent" | "agent-native" | "agent-host" | "agent-restricted";
export type ContractToolResult = ToolResult & { metadata: Record<string, any> };
export type ToolContractProgress = { type?: string; stream?: string; [key: string]: unknown };

export interface ToolContract {
  id: string;
  label: string;
  tool: string;
  args: Record<string, unknown>;
  assert: (files: FsFile[], result: ContractToolResult) => boolean;
  sandboxKinds?: readonly ToolContractSandboxKind[];
  assertRecord?: (record: ToolContractRecord) => boolean;
  abortBeforeExecute?: boolean;
  /** Invalid requests are contracts too: the tool must reject them predictably. */
  assertError?: (message: string) => boolean;
}

/**
 * A small, deterministic input set shared by the interactive lab and CI.
 * Every contract starts from this state so tools cannot accidentally rely on
 * mutations made by a previous assertion.
 */
export const TOOL_CONTRACT_INITIAL_FILES: FsFile[] = [
  { path: "src/a.ts", content: "export const value = 1;\nexport const second = 2;\nexport const third = 3;\n" },
  { path: "src/b.ts", content: "export const other = 4;\nexport const another = 5;\n" },
  { path: "src/remove.ts", content: "remove me\n" },
];

export const TOOL_CONTRACTS: ToolContract[] = [
  { id: "read", label: "read_file", tool: "read_file", args: { path: "src/a.ts" }, assert: (_files, result) => result.output.includes("export const value = 1") },
  { id: "write", label: "write_file", tool: "write_file", args: { path: "src/new.ts", content: "export const created = true;\n" }, assert: (files) => files.some((file) => file.path === "src/new.ts" && file.content.includes("created")) },
  { id: "edit", label: "edit_file", tool: "edit_file", args: { path: "src/a.ts", old_str: "export const value = 1;\nexport const second = 2;\nexport const third = 3;", new_str: "export const value = 2;\nexport const second = 2;\nexport const third = 3;" }, assert: (files) => files.find((file) => file.path === "src/a.ts")?.content.includes("value = 2") ?? false },
  { id: "multi-write", label: "multi_write", tool: "multi_write", args: { files: [{ path: "src/one.ts", content: "one\n" }, { path: "src/two.ts", content: "two\n" }] }, assert: (files) => files.some((file) => file.path === "src/one.ts") && files.some((file) => file.path === "src/two.ts") },
  { id: "delete", label: "delete_file", tool: "delete_file", args: { paths: ["src/remove.ts"] }, assert: (files) => !files.some((file) => file.path === "src/remove.ts") },
  { id: "grep", label: "grep_search", tool: "grep_search", args: { pattern: "export" }, assert: (_files, result) => result.output.includes("src/a.ts") },
  { id: "grep-content-glob", label: "grep content + glob + case_insensitive", tool: "grep_search", args: { pattern: "EXPORT", glob: "src/*.ts", output_mode: "content", case_insensitive: true }, assert: (_files, result) => result.output.includes("src/a.ts") && result.output.includes("src/b.ts") && result.metadata.totalCount === 2 },
  { id: "grep-count-page", label: "grep count + pagination", tool: "grep_search", args: { pattern: "export", output_mode: "count", head_limit: 1, offset: 1 }, assert: (_files, result) => result.output.includes("src/b.ts:2") && result.metadata.returned === 1 && result.metadata.hasMore === false },
  { id: "grep-no-match", label: "grep no match", tool: "grep_search", args: { pattern: "not-present" }, assert: (_files, result) => result.output === "No matches found" && result.metadata.totalCount === 0 },
  { id: "grep-invalid-regex", label: "grep invalid regexp (expected error)", tool: "grep_search", args: { pattern: "[" }, assert: () => false, assertError: (message) => message.includes("Invalid regex pattern") },
  { id: "grep-empty-pattern", label: "grep empty pattern (expected error)", tool: "grep_search", args: { pattern: "" }, assert: () => false, assertError: (message) => message.includes("pattern is required") },
  { id: "glob", label: "glob_search", tool: "glob_search", args: { pattern: "*.ts" }, assert: (_files, result) => result.output.includes("src/a.ts") },
  { id: "glob-limit", label: "glob max_files", tool: "glob_search", args: { pattern: "*.ts", max_files: 1 }, assert: (_files, result) => result.metadata.returned === 1 && result.metadata.truncated === true },
  { id: "bash-touch", label: "bash touch", tool: "bash", args: { command: "touch src/from-bash.ts" }, assert: (files) => files.some((file) => file.path === "src/from-bash.ts") },
  { id: "bash-mv", label: "bash mv", tool: "bash", args: { command: "mv src/remove.ts src/moved.ts" }, assert: (files) => !files.some((file) => file.path === "src/remove.ts") && files.some((file) => file.path === "src/moved.ts") },
  { id: "bash-cp", label: "bash cp", tool: "bash", args: { command: "cp src/remove.ts src/copied.ts" }, assert: (files) => files.some((file) => file.path === "src/remove.ts") && files.some((file) => file.path === "src/copied.ts") },
  { id: "bash-rm", label: "bash rm", tool: "bash", args: { command: "rm src/remove.ts" }, assert: (files) => !files.some((file) => file.path === "src/remove.ts") },
  { id: "bash-rename", label: "bash rename", tool: "bash", args: { command: "rename remove archived *.ts" }, assert: (files) => !files.some((file) => file.path === "src/remove.ts") && files.some((file) => file.path === "src/archived.ts") },
  { id: "bash-sed", label: "bash sed", tool: "bash", args: { command: "sed -i 's/value/changed/' src/a.ts" }, assert: (files) => files.find((file) => file.path === "src/a.ts")?.content.includes("changed") ?? false },
  { id: "bash-head", label: "bash head", tool: "bash", args: { command: "head -n 2 src/a.ts" }, assert: (_files, result) => result.output.includes("export const value = 1;") && result.output.includes("export const second = 2;") },
  { id: "bash-unsupported-grep", label: "bash rejects grep", tool: "bash", args: { command: "grep export src/a.ts" }, assert: (_files, result) => result.metadata.exitCode === 1 && result.output.includes("command not supported") },
  { id: "bash-invalid-mv", label: "bash mv missing destination", tool: "bash", args: { command: "mv src/a.ts" }, assert: (_files, result) => result.metadata.exitCode === 1 && result.output.includes("missing operand") },
  { id: "bash-host-fallback", label: "bash host fallback", tool: "bash", args: { command: "host-echo hello" }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.output === "hello" && result.metadata.commandMetadata?.transport === "host" },
  { id: "bash-host-rejection", label: "bash host rejection", tool: "bash", args: { command: "host-denied" }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.metadata.exitCode === 1 && result.output.includes("command not allowed") && result.metadata.commandMetadata?.transport === "host" },
  { id: "bash-host-stream", label: "bash stdout/stderr stream", tool: "bash", args: { command: "host-stream" }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.output.includes("first second") && result.output.includes("warn"), assertRecord: (record) => record.progress.some((item) => item.type === "command-output" && item.stream === "stderr") },
  { id: "bash-proxy-before-host", label: "bash proxy before host", tool: "bash", args: { command: "mv src/remove.ts src/proxy-moved.ts" }, sandboxKinds: ["agent-host"], assert: (files, result) => files.some((file) => file.path === "src/proxy-moved.ts") && result.metadata.commandMetadata?.transport === undefined },
  { id: "bash-proxy-next-options", label: "bash proxy next options", tool: "bash", args: { command: "proxy-next host-echo hello", timeout_ms: 123 }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.output === "hello" && result.metadata.commandMetadata?.proxied === true && result.metadata.commandMetadata?.receivedTimeoutMs === 123 && result.metadata.commandMetadata?.receivedSignal === true },
  { id: "bash-host-timeout", label: "bash host timeout", tool: "bash", args: { command: "host-timeout", timeout_ms: 20 }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.metadata.exitCode === 124 && result.metadata.commandMetadata?.receivedTimeoutMs === 20 && result.output.includes("timed out") },
  { id: "bash-host-abort", label: "bash host abort signal", tool: "bash", args: { command: "host-abort" }, sandboxKinds: ["agent-host"], abortBeforeExecute: true, assert: (_files, result) => result.metadata.exitCode === 130 && result.metadata.commandMetadata?.receivedAborted === true && result.output.includes("observed abort") },
  { id: "bash-invalid-timeout", label: "bash invalid timeout (expected error)", tool: "bash", args: { command: "host-echo hello", timeout_ms: 0 }, sandboxKinds: ["agent-host"], assert: () => false, assertError: (message) => message.includes("timeout_ms must be a positive number") },
  { id: "grep-host-structured-proxy", label: "grep custom structured proxy", tool: "grep_search", args: { pattern: "host-only" }, sandboxKinds: ["agent-host"], assert: (_files, result) => result.output === "Found 1 file\nhost/custom.ts" && result.metadata.totalCount === 1 },
  { id: "grep-default-files-proxy", label: "grep default files proxy", tool: "grep_search", args: { pattern: "export" }, sandboxKinds: ["agent-native"], assert: (_files, result) => result.output === "Found 2 files\nsrc/a.ts\nsrc/b.ts" && result.metadata.totalCount === 2 },
  { id: "glob-default-files-proxy", label: "glob default files proxy", tool: "glob_search", args: { pattern: "*.ts" }, sandboxKinds: ["agent-native"], assert: (_files, result) => result.output.includes("src/a.ts") && result.metadata.total === 3 },
  { id: "bash-restricted-proxy-set", label: "bash configured proxy set", tool: "bash", args: { command: "mv src/remove.ts src/blocked.ts" }, sandboxKinds: ["agent-restricted"], assert: (files, result) => files.some((file) => file.path === "src/remove.ts") && !files.some((file) => file.path === "src/blocked.ts") && result.metadata.exitCode === 1 && result.output.includes("command not supported") },
];

function createNativeFiles(fs: MemFS): AgentSandbox["files"] {
  return {
      async list(path = "") {
        const root = path.replace(/^\/+|\/+$/g, "");
        const entries = new Map<string, { path: string; type: "file" | "directory" }>();
        for (const file of fs.snapshot()) {
          const relative = root ? file.path.startsWith(`${root}/`) ? file.path.slice(root.length + 1) : "" : file.path;
          if (!relative) continue;
          const [name, ...rest] = relative.split("/");
          const entryPath = root ? `${root}/${name}` : name;
          entries.set(entryPath, { path: entryPath, type: rest.length ? "directory" : "file" });
        }
        return [...entries.values()];
      },
      async read(path) { return fs.snapshot().find((file) => file.path === path) ?? null; },
      async readFiles(paths) { const wanted = new Set(paths); return fs.snapshot().filter((file) => wanted.has(file.path)); },
      async write(file) { await fs.updateFiles([file]); },
      async writeFiles(files) { await fs.updateFiles(files); },
      async remove(path) { await fs.deleteFiles([path]); },
      async removeFiles(paths) { await fs.deleteFiles(paths); },
  };
}

function createFileSystemFallbackProxies(files: AgentSandbox["files"]) {
  // This is deliberately an explicit, command-by-command fallback list. A
  // host puts native proxies before the relevant item; it never receives an
  // opaque "default command set" that can silently override a real command.
  return [
    createFileSystemFindCommandProxy(files),
    createFileSystemGrepCommandProxy(files),
    createFileSystemGlobCommandProxy(files),
    createMvCommandProxy(files),
    createCpCommandProxy(files),
    createRmCommandProxy(files),
    createRenameCommandProxy(files),
    createTouchCommandProxy(files),
    createSedCommandProxy(files),
    createHeadCommandProxy(files),
  ];
}

function createFilesFallbackTransport(allowedCommands = ["mv", "cp", "rm", "rename", "touch", "sed", "head"]) {
  return {
    async execute(command: string) {
      const [name] = command.trim().split(/\s+/, 1);
      const stdout = name === "mkdir"
        ? "mkdir: command not supported in virtual filesystem\nThe virtual filesystem has no empty directories; create files directly with paths like src/hooks/useThing.ts."
        : `bash: '${name ?? ""}': command not supported in sandbox environment\nThe sandbox only supports virtual filesystem operations. Supported commands: ${allowedCommands.join(", ")}`;
      return { stdout, exitCode: 1 };
    },
  };
}

function createNativeSandbox(fs: MemFS): AgentSandbox {
  const files = createNativeFiles(fs);
  return {
    files,
    // This is a real AgentSandbox that explicitly opts into files fallback.
    // It has no native command handlers, so the same direct-tool contract as
    // V1 is expected and asserted below.
    commands: {
      ...createFilesFallbackTransport(),
      allowedCommands: ["mv", "cp", "rm", "rename", "touch", "sed", "head"],
      proxies: [
        ...createFileSystemFallbackProxies(files),
      ],
    },
  };
}

/**
 * A real sandbox normally declares only a raw command executor. Structured
 * tools still use the default portable files proxies and do not call it.
 */
function createDefaultNativeProxySandbox(fs: MemFS): AgentSandbox {
  return {
    files: createNativeFiles(fs),
    commands: {
      async execute(command: string) {
        return { stdout: `${command}: structured tools must use files`, stderr: "", exitCode: 127 };
      },
    },
  };
}

function createHostSandbox(fs: MemFS): AgentSandbox {
  const native = createNativeSandbox(fs);
  const hostTransport = {
    async execute(command: string, options?: AgentSandboxCommandExecutionOptions) {
      const metadata = {
        transport: "host",
        receivedTimeoutMs: options?.timeoutMs,
        receivedSignal: Boolean(options?.signal),
        receivedAborted: Boolean(options?.signal?.aborted),
      };
      if (command === "host-echo hello") {
        options?.onStdout?.("hello");
        return { stdout: "hello", stderr: "", exitCode: 0, metadata };
      }
      if (command === "host-denied") {
        return { stdout: "host-denied: command not allowed", stderr: "", exitCode: 1, metadata };
      }
      if (command === "host-stream") {
        options?.onStdout?.("first ");
        options?.onStderr?.("warn ");
        options?.onStdout?.("second");
        return { stdout: "first second", stderr: "warn ", exitCode: 0, metadata };
      }
      if (command === "host-timeout") {
        return { stdout: "host-timeout: command timed out", stderr: "", exitCode: 124, metadata };
      }
      if (command === "host-abort") {
        return { stdout: "host-abort: host observed abort signal", stderr: "", exitCode: 130, metadata };
      }
      return { stdout: `${command}: command not allowed`, stderr: "", exitCode: 1, metadata };
    },
  };
  return {
    ...native,
    commands: {
      ...hostTransport,
      allowedCommands: ["mv", "cp", "rm", "rename", "touch", "sed", "head", "host-echo", "host-denied", "host-stream", "host-timeout", "host-abort", "proxy-next"],
      proxies: [{
      // Native command declarations always come before filesystem fallback.
      command: "proxy-next",
      async execute(_request, next, options) {
        const result = await next("host-echo hello", options);
        return { ...result, metadata: { ...result.metadata, proxied: true } };
      },
    }, {
      command: "grep",
      async execute(request) {
        if (typeof request === "string" || (request.input as { pattern?: unknown } | undefined)?.pattern !== "host-only") {
          return {
            stdout: "grep: native proxy only handles host-only in this test host",
            exitCode: 2,
          };
        }
        return {
          stdout: "",
          exitCode: 0,
          structured: {
            type: "grep",
            pattern: "host-only",
            outputMode: "files_with_matches",
            matches: [{ path: "host/custom.ts" }],
            totalCount: 1,
            offset: 0,
            returned: 1,
            hasMore: false,
          },
        };
      },
    },
        ...createFileSystemFallbackProxies(native.files),
      ],
    },
  };
}

function createTools(sandbox: AgentSandbox): Record<string, Tool> {
  return {
    read_file: createReadTool(sandbox),
    write_file: createWriteTool(sandbox),
    edit_file: createEditTool(sandbox),
    multi_write: createMultiWriteTool(sandbox),
    delete_file: createDeleteTool(sandbox),
    grep_search: createGrepTool(sandbox),
    glob_search: createGlobTool(sandbox),
    bash: createBashTool(sandbox.commands),
  };
}

export function createToolContractRuntime(kind: ToolContractSandboxKind, initialFiles = TOOL_CONTRACT_INITIAL_FILES) {
  const fs = new MemFS(initialFiles);
  const baseSandbox = kind === "v1"
    ? createAgentSandboxFromV1(fs)
    : kind === "agent-restricted" ? createAgentSandboxFromV1(fs, { allowedCommands: ["touch"] })
    : kind === "agent-host" ? createHostSandbox(fs)
    : kind === "agent-native" ? createDefaultNativeProxySandbox(fs)
    : createNativeSandbox(fs);
  const { sandbox } = createAgentSandboxOverlay(createAgentSandboxRuntime(baseSandbox), () => []);
  return { fs, tools: createTools(sandbox) };
}

/** Regression probe for remote hosts: discovery and content loading stay batched. */
export async function verifyRecursiveFileBatching(): Promise<{ listCalls: number; readFilesCalls: number; readCalls: number }> {
  const fs = new MemFS(TOOL_CONTRACT_INITIAL_FILES);
  let listCalls = 0;
  let readFilesCalls = 0;
  let readCalls = 0;
  const baseFiles = createNativeFiles(fs);
  const files: AgentSandbox["files"] = {
    ...baseFiles,
    async list(path = "", options) {
      listCalls++;
      if (!options?.recursive) return baseFiles.list(path);
      const entries = new Map<string, { path: string; type: "file" | "directory" }>();
      for (const file of fs.snapshot()) {
        const relative = path ? file.path.startsWith(`${path}/`) ? file.path.slice(path.length + 1) : "" : file.path;
        if (!relative) continue;
        const segments = relative.split("/");
        for (let index = 1; index < segments.length; index++) {
          const entryPath = [path, ...segments.slice(0, index)].filter(Boolean).join("/");
          entries.set(entryPath, { path: entryPath, type: "directory" });
        }
        entries.set(file.path, { path: file.path, type: "file" });
      }
      return [...entries.values()];
    },
    async read(path) {
      readCalls++;
      return baseFiles.read(path);
    },
    async readFiles(paths) {
      readFilesCalls++;
      return baseFiles.readFiles(paths);
    },
  };
  const { sandbox } = createAgentSandboxOverlay(createAgentSandboxRuntime({
    files,
    commands: { async execute(command: string) { return { stdout: `${command}: unexpected`, exitCode: 127 }; } },
  }), () => []);
  await createGrepTool(sandbox).execute({ pattern: "export" });
  return { listCalls, readFilesCalls, readCalls };
}

const HISTORY_TEST_START = Date.parse("2026-08-28T08:00:00.000Z");

function createHistoryTestTurns(): TurnRecord[] {
  return [{
    id: "turn-one",
    startTime: HISTORY_TEST_START,
    endTime: HISTORY_TEST_START + 4_000,
    userText: "请检查文件系统性能",
    userAttachments: [],
    iterations: [{
      iterId: "iter-one",
      content: "我检查了命令执行情况。",
      thinkingContent: "先从宿主输出中寻找问题。",
      toolCalls: [{
        callId: "call-one",
        name: "bash",
        args: { command: "inspect-host" },
        result: {
          output: "Host output mentions AgentSandbox batching.",
          metadata: { transport: "host" },
        },
        status: "success",
        execStartTime: HISTORY_TEST_START + 1_000,
        execEndTime: HISTORY_TEST_START + 2_000,
      }],
      startTime: HISTORY_TEST_START + 500,
      responseTime: HISTORY_TEST_START + 700,
      endTime: HISTORY_TEST_START + 3_000,
      aiRole: "default",
      mode: "build",
      usage: { promptTokens: 10, completionTokens: 20 },
    }],
    status: "success",
  }, {
    id: "turn-two",
    startTime: HISTORY_TEST_START + 10_000,
    endTime: HISTORY_TEST_START + 15_000,
    userText: "AgentSandbox 的接口调用是否合理？",
    userAttachments: [],
    sender: { userId: "history-user", name: "History User" },
    iterations: [{
      iterId: "iter-two-a",
      content: "我会检查批量读取。",
      toolCalls: [],
      startTime: HISTORY_TEST_START + 11_000,
      endTime: HISTORY_TEST_START + 12_000,
    }, {
      iterId: "iter-two-b",
      content: "检查完成。",
      toolCalls: [],
      startTime: HISTORY_TEST_START + 13_000,
      endTime: HISTORY_TEST_START + 14_000,
    }],
    status: "success",
  }, {
    id: "turn-deleted",
    startTime: HISTORY_TEST_START + 20_000,
    endTime: HISTORY_TEST_START + 21_000,
    userText: "AgentSandbox deleted record",
    userAttachments: [],
    iterations: [],
    status: "success",
    deleted: true,
  }, {
    id: "active-turn",
    startTime: HISTORY_TEST_START + 30_000,
    userText: "当前正在调用 history_read 检索 AgentSandbox",
    userAttachments: [],
    iterations: [],
    status: "success",
  }];
}

async function executeHistoryRead(args: Record<string, unknown>) {
  const tool = createHistoryReadTool();
  const turns = createHistoryTestTurns();
  const fakeAgent = {
    async ensureHistoryReady() {},
    getTurns: () => turns,
  };
  const context = {
    turnId: "active-turn",
    getAgent: () => fakeAgent,
  } as unknown as ToolExecutionContext;
  tool.validate?.(args, context);
  return tool.execute(args, context);
}

/** Direct history_read contracts. No Agent or LLM execution is involved. */
export async function verifyHistoryReadContracts() {
  const searchFirst = await executeHistoryRead({
    limit: 1,
    filter: { keyword: "agentsandbox" },
    output_level: "minimal",
  });
  const nextIndex = (JSON.parse(searchFirst.output.split("\n")[0]) as { _page: { next_index: number } })._page.next_index;
  const searchNext = await executeHistoryRead({
    index: nextIndex,
    limit: 1,
    filter: { keyword: "agentsandbox" },
    output_level: "minimal",
  });
  const standard = await executeHistoryRead({ index: 1, limit: 1 });
  const full = await executeHistoryRead({ index: 1, limit: 1, output_level: "full" });
  const turn = await executeHistoryRead({ index: 2, limit: 3, output_level: "full" });
  const usersInRange = await executeHistoryRead({
    filter: {
      roles: ["user"],
      from: new Date(HISTORY_TEST_START + 5_000).toISOString(),
      to: new Date(HISTORY_TEST_START + 15_000).toISOString(),
    },
  });
  return { searchFirst, searchNext, standard, full, turn, usersInRange };
}

function createRecordedHooks(label: string, calls: string[]): AgentHooks {
  return {
    beforeTurn() {
      calls.push(`${label}:beforeTurn`);
    },
    beforeRequest() {
      calls.push(`${label}:beforeRequest`);
      return { additionalMessages: [{ role: "user", content: `${label}:context` }] };
    },
    afterTurn() {
      calls.push(`${label}:afterTurn`);
    },
    afterTurnSettled() {
      calls.push(`${label}:afterTurnSettled`);
    },
  };
}

/** CodeAgent plugin hooks share AgentHooks semantics and follow live plugin enablement. */
export async function verifyPluginHooksContracts() {
  const fs = new MemFS([]);
  const calls: string[] = [];
  const requestContexts: string[][] = [];
  const requestToolNames: string[][] = [];
  const pluginTool = (name: string): Tool => ({
    name,
    description: `${name} contract tool`,
    async execute() { return { output: name }; },
  });
  const sandbox = {
    async getFiles() { return fs.snapshot(); },
    async updateFiles(files: FsFile[]) { await fs.updateFiles(files); },
    async deleteFiles(paths: string[]) { await fs.deleteFiles(paths); },
  };
  const agent = new CodeAgent({
    sandbox,
    builtinTools: false,
    summary: { enabled: false },
    hooks: createRecordedHooks("base", calls),
    plugins: [
      { name: "one", tools: [pluginTool("one_tool")], hooks: createRecordedHooks("one", calls) },
      { name: "two", enabled: false, tools: [pluginTool("two_tool")], hooks: createRecordedHooks("two", calls) },
    ],
    async request(params) {
      calls.push("request");
      requestToolNames.push((params.tools ?? []).map((tool) => tool.name));
      requestContexts.push(
        (params.messages as Array<{ content?: unknown }>)
          .map((message) => message.content)
          .filter((content): content is string => typeof content === "string" && content.endsWith(":context")),
      );
      params.emits.onFinishReason?.("stop");
      params.emits.complete("");
    },
  });

  const runTurn = async (message: string) => {
    const settled = new Promise<void>((resolve) => {
      const unsubscribe = agent.events.on("turn:settled", () => {
        unsubscribe();
        resolve();
      });
    });
    await agent.requestAI({ message });
    await settled;
  };

  await runTurn("first");
  const first = calls.splice(0);
  agent.enablePlugin("two");
  await runTurn("second");
  const second = calls.splice(0);
  agent.disablePlugin("one");
  await runTurn("third");
  const third = calls.splice(0);

  const isolatedCalls: string[] = [];
  const throwingHook = (name: string) => () => {
    isolatedCalls.push(`broken:${name}`);
    throw new Error(`${name} failed`);
  };
  const isolatedAgent = new CodeAgent({
    sandbox,
    builtinTools: false,
    summary: { enabled: false },
    plugins: [
      {
        name: "broken",
        hooks: {
          beforeTurn: throwingHook("beforeTurn"),
          beforeRequest: throwingHook("beforeRequest"),
          afterTurn: throwingHook("afterTurn"),
          afterTurnSettled: throwingHook("afterTurnSettled"),
        },
      },
      { name: "survivor", hooks: createRecordedHooks("survivor", isolatedCalls) },
    ],
    async request(params) {
      isolatedCalls.push("request");
      params.emits.onFinishReason?.("stop");
      params.emits.complete("");
    },
  });
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
  try {
    const settled = new Promise<void>((resolve) => {
      const unsubscribe = isolatedAgent.events.on("turn:settled", () => {
        unsubscribe();
        resolve();
      });
    });
    await isolatedAgent.requestAI({ message: "isolate errors" });
    await settled;
  } finally {
    console.warn = originalWarn;
  }

  return {
    first,
    second,
    third,
    requestContexts,
    requestToolNames,
    errorIsolation: { calls: isolatedCalls, warnings },
  };
}

export interface ToolContractRecord {
  contract: ToolContract;
  args: unknown;
  before: FsFile[];
  after: FsFile[];
  result?: ToolResult;
  error?: string;
  progress: ToolContractProgress[];
  pass: boolean;
}

/** Execute one tool directly—no CodeAgent/LLM loop is involved. */
export async function runToolContract(
  kind: ToolContractSandboxKind,
  contract: ToolContract,
  initialFiles = TOOL_CONTRACT_INITIAL_FILES,
  args: unknown = contract.args,
): Promise<ToolContractRecord> {
  const runtime = createToolContractRuntime(kind, initialFiles);
  const before = runtime.fs.snapshot();
  const progress: ToolContractProgress[] = [];
  try {
    const tool = runtime.tools[contract.tool];
    if (!tool) throw new Error(`Unknown tool: ${contract.tool}`);
    tool.validate?.(args);
    const controller = new AbortController();
    if (contract.abortBeforeExecute) controller.abort();
    const context = {
      signal: controller.signal,
      emitProgress: (item: ToolContractProgress) => progress.push(item),
    } as unknown as ToolExecutionContext;
    const result = await tool.execute(args, contract.tool === "bash" ? context : undefined);
    const after = runtime.fs.snapshot();
    const record: ToolContractRecord = {
      contract, args, before, after, result, progress,
      pass: Boolean(result.metadata) && contract.assert(after, result as ContractToolResult),
    };
    record.pass = record.pass && (contract.assertRecord?.(record) ?? true);
    return record;
  } catch (error) {
    return {
      contract,
      args,
      before,
      after: runtime.fs.snapshot(),
      error: error instanceof Error ? error.message : String(error),
      progress,
      pass: contract.assertError?.(error instanceof Error ? error.message : String(error)) ?? false,
    };
  }
}
