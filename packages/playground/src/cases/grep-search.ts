import type { TestCase } from "./types";
import { GREP_TOOL_NAME } from "@agent/index";
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

export const grepDefaultFilesCase: TestCase = {
  id: "grep-default-files",
  name: "grep_search 默认文件列表",
  group: "Grep搜索",
  description: "搜索 export，覆盖默认 output_mode=files_with_matches。",
  expectedBehavior:
    "工具卡片绿色，输出以 Found N files 开头，并列出包含 export 的文件路径。",
  initialTurns: [],
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
