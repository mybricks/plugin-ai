import type { TestCase } from "./types";
import { GREP_TOOL_NAME } from "@agent/index";
import type {
  AgentSandbox,
  AgentSandboxGrepInput,
  AgentSandboxGrepMatch,
  AgentSandboxGrepResult,
} from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { FsFile } from "../lib/mem-fs";

/**
 * grep_search 的 playground case 只覆盖 agent 实现里的关键分支：
 * - validate / invalid regex
 * - 默认 files_with_matches
 * - content + glob + case_insensitive
 * - count + head_limit + offset
 * - no match
 */

const GREP_TEST_FILES: FsFile[] = [
  {
    path: "src/App.tsx",
    content: `import React from 'react';
import { Button } from './components/Button';

export default function App() {
  return <Button label="Save" />;
}`,
  },
  {
    path: "src/components/Button.tsx",
    content: `import React from 'react';

export interface ButtonProps {
  label: string;
}

export function Button({ label }: ButtonProps) {
  return <button className="btn">{label}</button>;
}`,
  },
  {
    path: "src/hooks/useAuth.ts",
    content: `import { useCallback, useState } from 'react';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const login = useCallback(async () => {
    setLoading(true);
    await fetch('/api/login');
    setLoading(false);
  }, []);

  return { loading, login };
}`,
  },
  {
    path: "src/services/api.ts",
    content: `export async function getUsers() {
  return fetch('/api/users');
}

export async function createUser() {
  return fetch('/api/users', { method: 'POST' });
}`,
  },
  {
    path: "src/styles/button.css",
    content: `.btn {
  padding: 8px 12px;
  color: white;
}`,
  },
  {
    path: "README.md",
    content: `# Demo

React + TypeScript playground fixture.`,
  },
];

const agentSandboxGrepStats = { commandCalls: 0, fileListCalls: 0 };

function matchGrepGlob(glob: string, path: string): boolean {
  const target = glob.includes("/") ? path : path.split("/").pop() ?? path;
  const pattern = glob.includes("/") ? glob : glob;
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regex}$`).test(target);
}

/** Native playground transport: grep reads its indexed files, never files.list(). */
function createNativeGrepSandbox(fs: import("../lib/mem-fs").MemFS): AgentSandbox {
  agentSandboxGrepStats.commandCalls = 0;
  agentSandboxGrepStats.fileListCalls = 0;
  const files = new Map(fs.snapshot().map((file) => [file.path, { ...file }]));

  return {
    files: {
      async list(path = "") {
        agentSandboxGrepStats.fileListCalls++;
        const normalizedPath = path.replace(/^\/+|\/+$/g, "");
        const direct = new Map<string, { path: string; type?: "file" | "directory" }>();
        for (const file of files.values()) {
          const relative = normalizedPath
            ? file.path.startsWith(`${normalizedPath}/`) ? file.path.slice(normalizedPath.length + 1) : ""
            : file.path;
          if (!relative) continue;
          const [name, ...rest] = relative.split("/");
          const entryPath = normalizedPath ? `${normalizedPath}/${name}` : name;
          direct.set(entryPath, { path: entryPath, ...(rest.length ? { type: "directory" } : { type: "file" }) });
        }
        return Array.from(direct.values());
      },
      async read(path) {
        const file = files.get(path);
        return file ? { ...file } : null;
      },
      async readFiles(paths) {
        return paths.flatMap((path) => {
          const file = files.get(path);
          return file ? [{ ...file }] : [];
        });
      },
      async write(file) {
        await fs.updateFiles([file]);
        files.set(file.path, { ...files.get(file.path), ...file });
      },
      async writeFiles(updatedFiles) {
        await fs.updateFiles(updatedFiles);
        for (const file of updatedFiles) {
          files.set(file.path, { ...files.get(file.path), ...file });
        }
      },
      async remove(path) {
        await fs.deleteFiles([path]);
        files.delete(path);
      },
      async removeFiles(paths) {
        await fs.deleteFiles(paths);
        paths.forEach((path) => files.delete(path));
      },
    },
    commands: {
      async execute(command) {
        return { stdout: `Unsupported command: ${command}`, exitCode: 127 };
      },
      proxies: [{
      command: "find",
      async execute(request) {
      agentSandboxGrepStats.commandCalls++;
      if (typeof request === "string") return { stdout: `Unsupported command: ${request}`, exitCode: 127 };
      if (request.name === "find") {
        return {
          stdout: "",
          exitCode: 0,
          structured: {
            type: "find",
            entries: Array.from(files.values()).map(({ content: _content, ...file }) => ({ ...file, type: "file" as const })),
          },
        };
      }
      return { stdout: `Unsupported command: ${request.name}`, exitCode: 127 };
      },
    }, {
      command: "grep",
      async execute(request) {
      agentSandboxGrepStats.commandCalls++;
      if (typeof request === "string") return { stdout: `Unsupported command: ${request}`, exitCode: 127 };

      const input = request.input as AgentSandboxGrepInput;
      let regex: RegExp;
      try {
        regex = new RegExp(input.pattern, input.caseInsensitive ? "i" : "");
      } catch {
        return { stdout: `Invalid regex pattern: ${input.pattern}`, exitCode: 2 };
      }

      const matches: AgentSandboxGrepMatch[] = [];
      for (const file of files.values()) {
        if (input.glob && !matchGrepGlob(input.glob, file.path)) continue;
        const lines = file.content.split("\n");
        const matchedLines = lines.flatMap((content, index) => regex.test(content)
          ? [{ lineNumber: index + 1, content }]
          : []);
        if (!matchedLines.length) continue;
        if (input.outputMode === "files_with_matches") matches.push({ path: file.path });
        else if (input.outputMode === "content") matches.push({ path: file.path, lines: matchedLines });
        else matches.push({ path: file.path, count: matchedLines.length });
      }

      const paged = matches.slice(input.offset, input.offset + input.headLimit);
      const structured: AgentSandboxGrepResult = {
        type: "grep",
        pattern: input.pattern,
        outputMode: input.outputMode,
        matches: paged,
        totalCount: matches.length,
        offset: input.offset,
        returned: paged.length,
        hasMore: input.offset + input.headLimit < matches.length,
      };
      return { stdout: "", exitCode: 0, structured };
      },
      }],
    },
  };
}

export const grepDefaultFilesCase: TestCase = {
  id: "grep-default-files",
  name: "grep_search 默认文件列表",
  group: "Grep搜索",
  description: "搜索 export，覆盖默认 output_mode=files_with_matches。",
  expectedBehavior:
    "工具卡片绿色，输出以 Found N files 开头，并列出包含 export 的文件路径。",
  initialTurns: [],
  sandboxKind: "v1",
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_default_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "export" },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["默认模式只返回匹配文件路径，适合先快速定位搜索范围。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
  assertions: [
    {
      name: "Sandbox V1 grep 保持兼容输出",
      run: ({ agent }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iteration: any) => iteration.toolCalls ?? [])
          ?.find((tool: any) => tool.name === GREP_TOOL_NAME);
        if (!toolCall) return null;
        const output = toolCall.result?.output ?? "";
        const pass = toolCall.status === "success" && output.startsWith("Found 4 files");
        return { pass, message: pass ? "V1 grep 输出未变化" : `当前输出: ${output}` };
      },
    },
  ],
};

export const grepCommandsCase: TestCase = {
  id: "grep-commands",
  name: "grep_search AgentSandbox commands",
  group: "Grep搜索",
  description: "通过 AgentSandbox.commands 的结构化 grep 结果完成搜索，不让工具直接枚举文件。",
  expectedBehavior:
    "工具卡片绿色，输出与 V1 默认 grep 一致；自动断言确认唯一 grep 工具通过 AgentSandbox.commands 执行。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  sandboxKind: "agent",
  agentSandboxFactory: createNativeGrepSandbox,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_agent_sandbox_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "export" },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["AgentSandbox 路径通过 commands 返回结构化 grep 结果。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
  assertions: [
    {
      name: "AgentSandbox grep 使用 commands 路径",
      run: ({ agent }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iteration: any) => iteration.toolCalls ?? [])
          ?.find((tool: any) => tool.name === GREP_TOOL_NAME);
        if (!toolCall) return null;
        const output = toolCall.result?.output ?? "";
        const pass = toolCall.status === "success" && output.startsWith("Found 4 files") &&
          agentSandboxGrepStats.commandCalls === 1 && agentSandboxGrepStats.fileListCalls === 0;
        return {
          pass,
          message: pass
            ? "AgentSandbox grep 通过 commands 执行，未调用 files.list"
            : `当前输出: ${output}; commands=${agentSandboxGrepStats.commandCalls}; list=${agentSandboxGrepStats.fileListCalls}`,
        };
      },
    },
  ],
};

export const grepContentGlobCase: TestCase = {
  id: "grep-content-glob",
  name: "grep_search content + glob",
  group: "Grep搜索",
  description: "搜索 BUTTON，开启大小写不敏感，并用 glob=*.tsx 过滤文件。",
  expectedBehavior:
    "工具卡片绿色，只搜索 TSX 文件；content 模式返回匹配行号和行内容。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_content_glob_001",
        name: GREP_TOOL_NAME,
        args: {
          pattern: "BUTTON",
          output_mode: "content",
          glob: "*.tsx",
          case_insensitive: true,
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["content 模式会按文件分组展示命中的行，glob 和大小写参数同时生效。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
};

export const grepCountPaginationCase: TestCase = {
  id: "grep-count-pagination",
  name: "grep_search count + 翻页",
  group: "Grep搜索",
  description: "搜索 fetch，output_mode=count，head_limit=1 且 offset=1，覆盖计数和分页提示。",
  expectedBehavior:
    "工具卡片绿色，只返回第二个匹配文件的计数，metadata 中 offset=1，必要时显示更多分页提示。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_count_page_001",
        name: GREP_TOOL_NAME,
        args: {
          pattern: "fetch",
          output_mode: "count",
          head_limit: 1,
          offset: 1,
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["count 模式返回各文件命中次数，head_limit 和 offset 用于翻页。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
};

export const grepNoMatchCase: TestCase = {
  id: "grep-no-match",
  name: "grep_search 无匹配",
  group: "Grep搜索",
  description: "搜索不存在的字符串，覆盖 No matches found。",
  expectedBehavior: "工具卡片绿色，输出 No matches found，metadata.totalCount 为 0。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_no_match_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "not_found_token_xyz" },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["没有搜索到匹配内容，工具返回 No matches found。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
};

export const grepValidationCase: TestCase = {
  id: "grep-validation-errors",
  name: "grep_search 参数校验",
  group: "Grep搜索",
  description: "先传空 pattern 触发 validate，再传非法正则触发执行前的 regex 校验。",
  expectedBehavior:
    "第一张工具卡片红色显示 pattern is required；第二张工具卡片红色显示 Invalid regex pattern。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_empty_pattern_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "" },
      }],
      delayMs: 300,
    },
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_invalid_regex_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "[invalid" },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["grep_search 会分别校验空 pattern 和非法正则表达式。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ], { loop: true }),
  agentOptions: {
    maxSteps: 4,
  },
};
