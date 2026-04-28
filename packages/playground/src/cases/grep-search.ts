import type { TestCase } from "./types";
import { GREP_TOOL_NAME } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { FsFile } from "../lib/mem-fs";

/**
 * grep_search 测试用例
 *
 * 特点：
 * - grep_search 是 CodeAgent 内置沙盒工具，通过 MemFS.getFiles() 提供文件数据
 * - 测试各种参数组合：pattern、glob、output_mode、case_insensitive、head_limit、offset
 * - 使用预设文件系统（比 DEFAULT_FILES 更丰富），便于验证各种搜索参数效果
 */

// ─── 预设文件系统（含丰富内容以测试 grep 各参数）───────────────────────────────

const GREP_TEST_FILES: FsFile[] = [
  {
    path: "src/App.tsx",
    content: `import React from 'react';
import { Button } from './components/Button';
import { Header } from './components/Header';

export default function App() {
  return (
    <div className="app">
      <Header title="My App" />
      <Button label="Click me" onClick={() => alert('clicked')} />
    </div>
  );
}`,
  },
  {
    path: "src/components/Button.tsx",
    content: `import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button className={\`btn btn-\${variant}\`} onClick={onClick}>
      {label}
    </button>
  );
}`,
  },
  {
    path: "src/components/Header.tsx",
    content: `import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="header">
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </header>
  );
}`,
  },
  {
    path: "src/components/Footer.tsx",
    content: `import React from 'react';

export function Footer() {
  return (
    <footer className="footer">
      <p>© 2024 My App</p>
    </footer>
  );
}`,
  },
  {
    path: "src/hooks/useTheme.ts",
    content: `import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const toggle = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return [theme, toggle];
}`,
  },
  {
    path: "src/hooks/useAuth.ts",
    content: `import { useState, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return { user, isLoading, login, logout };
}`,
  },
  {
    path: "src/utils/format.ts",
    content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}`,
  },
  {
    path: "src/utils/validate.ts",
    content: `export function isEmail(value: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
}

export function isPhone(value: string): boolean {
  return /^1[3-9]\\d{9}$/.test(value);
}

export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== '';
}`,
  },
  {
    path: "src/styles/global.css",
    content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #d0d5dd;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.btn-secondary {
  background: #f5f5ff;
  border-color: #6366f1;
  color: #6366f1;
}`,
  },
  {
    path: "src/styles/components.css",
    content: `.header {
  padding: 16px 0;
  border-bottom: 1px solid #e5e7eb;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}

.footer {
  padding: 24px 0;
  text-align: center;
  color: #9ca3af;
}`,
  },
  {
    path: "src/services/api.ts",
    content: `const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(\`\${BASE_URL}\${path}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`HTTP error: \${response.status}\`);
  }

  return response.json();
}

export function getUsers() {
  return request<User[]>('/users');
}

export function createUser(data: CreateUserDTO) {
  return request<User>('/users', { method: 'POST', body: JSON.stringify(data) });
}`,
  },
  {
    path: "src/types/index.ts",
    content: `export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}`,
  },
  {
    path: "package.json",
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.4.0",
    "@types/react": "^18.3.0"
  }
}`,
  },
  {
    path: "README.md",
    content: `# My App

A React application built with TypeScript and Vite.

## Getting Started

1. Install dependencies: \`npm install\`
2. Start dev server: \`npm run dev\`
3. Build for production: \`npm run build\`

## Features

- User authentication
- Theme switching (light/dark)
- Responsive layout
- API integration`,
  },
];

// ─── 测试用例 ──────────────────────────────────────────────────────────────────

/**
 * 默认 output_mode=files_with_matches：搜索 "export" 关键字
 * 只返回包含匹配的文件路径列表，最省 token
 */
export const grepFilesWithMatchesCase: TestCase = {
  id: "grep-files-with-matches",
  name: "grep_search 默认模式（files_with_matches）",
  group: "Grep搜索",
  description: "搜索 \"export\" 关键字，默认 output_mode=files_with_matches，仅返回匹配的文件路径列表。",
  expectedBehavior:
    "工具卡片绿色，返回包含 export 的文件路径列表（如 src/App.tsx、src/components/Button.tsx 等），末尾显示总数。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_fwm_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "export" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"export\" 关键字，找到多个文件包含导出声明。",
        "主要的导出分布在组件文件和工具函数文件中。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * output_mode=content：搜索 "interface" 关键字
 * 返回每个文件中匹配行的内容和行号
 */
export const grepContentModeCase: TestCase = {
  id: "grep-content-mode",
  name: "grep_search content 模式（返回匹配行）",
  group: "Grep搜索",
  description: "搜索 \"interface\" 关键字，output_mode=content，返回每个文件中匹配行的行号和内容。",
  expectedBehavior:
    "工具卡片绿色，返回匹配行的行号和内容（如 Button.tsx 3行 interface ButtonProps），格式为 \"文件路径 → 行号: 内容\"。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_cnt_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "interface", output_mode: "content" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"interface\" 关键字（content 模式），返回各文件中匹配行的行号和内容。",
        "可以精确看到 interface 定义在哪些行的位置。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * output_mode=count：搜索 "useState" 关键字
 * 返回各文件的匹配计数
 */
export const grepCountModeCase: TestCase = {
  id: "grep-count-mode",
  name: "grep_search count 模式（匹配计数）",
  group: "Grep搜索",
  description: "搜索 \"useState\" 关键字，output_mode=count，返回各文件匹配行数统计。",
  expectedBehavior:
    "工具卡片绿色，返回各文件匹配计数（如 src/hooks/useTheme.ts: 1、src/hooks/useAuth.ts: 1），末尾显示总数。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_cnt2_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "useState", output_mode: "count" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"useState\" 关键字（count 模式），返回各文件匹配行数。",
        "useState 主要出现在 hooks 文件中。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * glob 参数过滤：搜索 "className" 关键字，只搜索 *.tsx 文件
 * glob="*.tsx" 只匹配文件名（不含路径分隔符时只匹配文件名部分）
 */
export const grepGlobFilterCase: TestCase = {
  id: "grep-glob-filter",
  name: "grep_search glob 文件过滤",
  group: "Grep搜索",
  description: "搜索 \"className\" 关键字，glob=\"*.tsx\"，只搜索 TSX 文件。",
  expectedBehavior:
    "工具卡片绿色，返回结果只包含 .tsx 文件（如 Button.tsx、Header.tsx），CSS 和 TS 文件被排除。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_glob_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "className", glob: "*.tsx", output_mode: "files_with_matches" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"className\"（glob=*.tsx），结果只包含 TSX 文件。",
        "CSS 文件虽然也有 className 定义，但被 glob 过滤排除。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * glob 路径段匹配：搜索 "export" 关键字，glob="src/components/*.tsx"
 * 含路径分隔符时匹配完整路径
 */
export const grepGlobPathFilterCase: TestCase = {
  id: "grep-glob-path-filter",
  name: "grep_search glob 路径段过滤",
  group: "Grep搜索",
  description: "搜索 \"export\" 关键字，glob=\"src/components/*.tsx\"，只搜索 src/components 目录下的 TSX 文件。",
  expectedBehavior:
    "工具卡片绿色，返回结果只包含 src/components/ 目录下的 TSX 文件（Button.tsx、Header.tsx、Footer.tsx），hooks、utils 等被排除。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_glob2_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "export", glob: "src/components/*.tsx", output_mode: "files_with_matches" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"export\"（glob=src/components/*.tsx），结果只包含 src/components 目录下的组件文件。",
        "路径段 glob 模式精确过滤了搜索范围。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * case_insensitive=true：搜索 "REACT" 关键字（大小写不敏感）
 * 默认大小写敏感时搜 "REACT" 不会匹配 "react"，启用后可匹配
 */
export const grepCaseInsensitiveCase: TestCase = {
  id: "grep-case-insensitive",
  name: "grep_search 大小写不敏感搜索",
  group: "Grep搜索",
  description: "搜索 \"REACT\" 关键字，case_insensitive=true，匹配 react/React/REACT 等各种大小写形式。",
  expectedBehavior:
    "工具卡片绿色，返回包含 react/React 等各种大小写形式的文件（默认大小写敏感时搜 \"REACT\" 不会有结果）。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_ci_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "REACT", case_insensitive: true, output_mode: "content" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "大小写不敏感搜索 \"REACT\"，匹配到 import React、'react' 等各种大小写形式。",
        "如果用默认大小写敏感模式搜 \"REACT\"，则不会有匹配结果。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * head_limit 参数：搜索 "import" 关键字，head_limit=3，限制只返回 3 条结果
 */
export const grepHeadLimitCase: TestCase = {
  id: "grep-head-limit",
  name: "grep_search head_limit 限制结果数",
  group: "Grep搜索",
  description: "搜索 \"import\" 关键字，head_limit=3，只返回前 3 条匹配文件，末尾提示使用 offset 查看更多。",
  expectedBehavior:
    "工具卡片绿色，只返回 3 条文件路径，末尾显示分页提示（如\"显示第 1-3 条，共 N 条。使用 offset=3 查看更多\"）。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_hl_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "import", head_limit: 3 },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"import\"（head_limit=3），只返回前 3 条结果。",
        "末尾提示有更多结果，可通过 offset 参数翻页查看。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * offset 翻页：搜索 "import" 关键字，head_limit=3, offset=3
 * 从第 4 条开始返回结果
 */
export const grepOffsetCase: TestCase = {
  id: "grep-offset",
  name: "grep_search offset 翻页",
  group: "Grep搜索",
  description: "搜索 \"import\" 关键字，head_limit=3, offset=3，跳过前 3 条返回第 4-6 条。",
  expectedBehavior:
    "工具卡片绿色，跳过前 3 条结果，返回第 4-6 条文件路径，metadata 中 offset=3。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_of_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "import", head_limit: 3, offset: 3 },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"import\"（offset=3, head_limit=3），返回第 4-6 条结果。",
        "翻页功能可以逐页浏览大量搜索结果。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * 正则表达式搜索：搜索 "export (function|interface)" 正则
 * 验证完整正则语法支持
 */
export const grepRegexPatternCase: TestCase = {
  id: "grep-regex-pattern",
  name: "grep_search 正则表达式搜索",
  group: "Grep搜索",
  description: "搜索 \"export (function|interface)\" 正则模式，验证完整正则语法支持。",
  expectedBehavior:
    "工具卡片绿色，返回包含 \"export function\" 或 \"export interface\" 的文件和行内容。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_rx_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "export (function|interface)", output_mode: "content" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "正则搜索 \"export (function|interface)\"，匹配到所有导出函数和接口定义。",
        "grep_search 支持完整的正则表达式语法。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * 无匹配结果：搜索 "nonexistent_pattern_xyz" 关键字
 * 返回 "No matches found"
 */
export const grepNoMatchCase: TestCase = {
  id: "grep-no-match",
  name: "grep_search 无匹配结果",
  group: "Grep搜索",
  description: "搜索 \"nonexistent_pattern_xyz\" 关键字，没有匹配结果时返回 \"No matches found\"。",
  expectedBehavior:
    "工具卡片绿色，返回 \"No matches found\"，totalCount=0。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_nm_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "nonexistent_pattern_xyz" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"nonexistent_pattern_xyz\" 没有匹配结果。",
        "当搜索模式不匹配任何文件内容时，返回 \"No matches found\"。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * 无效正则表达式：搜索 "[invalid" 正则（缺少闭合括号）
 * 验证 ToolValidationError 抛出
 */
export const grepInvalidRegexCase: TestCase = {
  id: "grep-invalid-regex",
  name: "grep_search 无效正则表达式",
  group: "Grep搜索",
  description: "搜索 \"[invalid\" 正则（缺少闭合括号），验证 ToolValidationError。",
  expectedBehavior:
    "工具卡片红色，显示 \"Invalid regex pattern: [invalid\" 错误信息，LLM 继续回复。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_ir_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "[invalid" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "正则表达式 \"[invalid\" 无效（缺少闭合括号），工具返回错误。",
        "请使用有效的正则表达式重新搜索。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * 空 pattern 参数：验证 validate 检查
 * pattern 为空字符串时抛出 ToolValidationError
 */
export const grepEmptyPatternCase: TestCase = {
  id: "grep-empty-pattern",
  name: "grep_search 空 pattern 参数",
  group: "Grep搜索",
  description: "pattern 为空字符串，验证 ToolValidationError（\"pattern is required and must be a non-empty string\"）。",
  expectedBehavior:
    "工具卡片红色，显示 \"pattern is required and must be a non-empty string\" 错误。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_ep_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "pattern 参数为空字符串，工具验证失败。",
        "grep_search 要求 pattern 必须是非空字符串。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * 多参数组合：glob + case_insensitive + output_mode=content + head_limit
 * 搜索 "BUTTON" (大小写不敏感)，只搜 *.tsx 文件，content 模式，限制 5 条
 */
export const grepMultiParamCase: TestCase = {
  id: "grep-multi-param",
  name: "grep_search 多参数组合",
  group: "Grep搜索",
  description: "搜索 \"BUTTON\"（case_insensitive=true, glob=\"*.tsx\", output_mode=content, head_limit=5），验证多个参数同时生效。",
  expectedBehavior:
    "工具卡片绿色，大小写不敏感匹配 Button/button，只包含 TSX 文件，显示行号和内容，最多 5 条结果。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_mp_001",
        name: GREP_TOOL_NAME,
        args: {
          pattern: "BUTTON",
          case_insensitive: true,
          glob: "*.tsx",
          output_mode: "content",
          head_limit: 5,
        },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "组合搜索：大小写不敏感搜 \"BUTTON\"，glob 限制 TSX 文件，content 模式显示行号。",
        "多个参数同时生效，精确控制搜索范围和输出格式。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

/**
 * glob 过滤导致无匹配：搜索 "fetch" 只搜 *.css 文件
 * CSS 文件中没有 fetch 关键字
 */
export const grepGlobNoMatchCase: TestCase = {
  id: "grep-glob-no-match",
  name: "grep_search glob 过滤无匹配",
  group: "Grep搜索",
  description: "搜索 \"fetch\" 关键字，glob=\"*.css\"，CSS 文件中不包含 fetch，返回 \"No matches found\"。",
  expectedBehavior:
    "工具卡片绿色，返回 \"No matches found\"。虽然 TS 文件中有 fetch，但 glob 过滤后只剩 CSS 文件。",
  initialTurns: [],
  initialFiles: GREP_TEST_FILES,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "call_grep_gnm_001",
        name: GREP_TOOL_NAME,
        args: { pattern: "fetch", glob: "*.css" },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "搜索 \"fetch\"（glob=*.css），CSS 文件中没有 fetch 关键字，返回 \"No matches found\"。",
        "glob 过滤缩小搜索范围后可能无匹配。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};