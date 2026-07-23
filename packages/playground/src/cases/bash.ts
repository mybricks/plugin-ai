import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import type { FsFile } from "../lib/mem-fs";
import { BASH_TOOL_NAME } from "@agent/code-agent/tools";

// ─── 富文件系统预设（供重构类 case 使用） ───────────────────────────────────────

/**
 * 一个用于测试重构操作的预设文件系统：
 * - src/components/*.tsx — 多个组件
 * - src/utils/*.ts      — 工具函数
 * - src/pages/*.tsx     — 页面
 * - src/styles/*.css    — 样式
 */
const REFACTOR_FILES: FsFile[] = [
  {
    path: "src/components/Button.tsx",
    content: `import React from 'react';
import { OldTheme } from '../theme/OldTheme';

interface ButtonProps { label: string; onClick?: () => void; }

export function Button({ label, onClick }: ButtonProps) {
  return <button className="btn" onClick={onClick}>{label}</button>;
}`,
  },
  {
    path: "src/components/Card.tsx",
    content: `import React from 'react';
import { OldTheme } from '../theme/OldTheme';

interface CardProps { title: string; children: React.ReactNode; }

export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}`,
  },
  {
    path: "src/components/Modal.tsx",
    content: `import React from 'react';
import { OldTheme } from '../theme/OldTheme';

interface ModalProps { open: boolean; onClose: () => void; children: React.ReactNode; }

export function Modal({ open, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal">{children}</div>
    </div>
  );
}`,
  },
  {
    path: "src/utils/format.ts",
    content: `export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
}`,
  },
  {
    path: "src/utils/validate.ts",
    content: `export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isPhone(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value);
}`,
  },
  {
    path: "src/pages/Home.tsx",
    content: `import React from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { OldTheme } from '../theme/OldTheme';

export default function Home() {
  return (
    <div>
      <Card title="Welcome">
        <Button label="Get Started" />
      </Card>
    </div>
  );
}`,
  },
  {
    path: "src/pages/Settings.tsx",
    content: `import React from 'react';
import { Modal } from '../components/Modal';
import { OldTheme } from '../theme/OldTheme';

export default function Settings() {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open Settings</button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <p>Settings content</p>
      </Modal>
    </div>
  );
}`,
  },
  {
    path: "src/theme/OldTheme.ts",
    content: `export const OldTheme = {
  primary: '#6366f1',
  secondary: '#a855f7',
  danger: '#ef4444',
};`,
  },
  {
    path: "src/styles/components.css",
    content: `.btn { padding: 8px 16px; border-radius: 6px; }
.card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); }
.modal { background: #fff; border-radius: 8px; padding: 24px; }`,
  },
  {
    path: "src/App.tsx",
    content: `import React from 'react';
import Home from './pages/Home';
import Settings from './pages/Settings';

export default function App() {
  const [page, setPage] = React.useState<'home' | 'settings'>('home');
  return (
    <div>
      {page === 'home' ? <Home /> : <Settings />}
    </div>
  );
}`,
  },
];

const REFACTOR_FILES_WITH_UI_DIR: FsFile[] = [
  ...REFACTOR_FILES,
  {
    path: "src/ui/placeholder.ts",
    content: "export const placeholder = true;",
  },
];

// ─── 测试 Case ────────────────────────────────────────────────────────────────

/** mv 单文件重命名 */
export const bashMvRenameCase: TestCase = {
  id: "bash-mv-rename",
  name: "bash: mv 重命名单文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具执行 mv 命令，将 src/theme/OldTheme.ts 重命名为 src/theme/theme.ts。",
  expectedBehavior:
    "工具卡片绿色，输出以 'moved' 开头；FS Viewer 中 OldTheme.ts 消失，theme.ts 出现，内容一致。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mv_rename",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/theme/OldTheme.ts src/theme/theme.ts",
              description: "将 OldTheme.ts 重命名为 theme.ts",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 OldTheme.ts 重命名为 theme.ts。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** mv 移动文件到目录 */
export const bashMvToDirectoryCase: TestCase = {
  id: "bash-mv-to-dir",
  name: "bash: mv 将多个组件移入子目录",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具，将 src/components/ 下所有 .tsx 文件移动到 src/ui/。",
  expectedBehavior:
    "工具卡片绿色，输出以 'moved' 开头并显示数量摘要；FS Viewer 中 src/components/*.tsx 消失，src/ui/*.tsx 出现。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mv_dir",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/components/*.tsx src/ui/",
              description: "将 components 目录下的组件移至 src/ui/",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将所有组件从 components 移至 ui 目录。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** mv 递归移动目录前缀 */
export const bashMvRecursiveCase: TestCase = {
  id: "bash-mv-recursive-dir",
  name: "bash: mv 移动目录前缀",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/components 目录前缀移动到 src/ui/components。",
  expectedBehavior:
    "工具调用成功，src/components 下文件消失，src/ui/components 下出现对应文件。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mv_recursive",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/components src/ui/components",
              description: "移动 components 目录前缀",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 src/components 移动到 src/ui/components。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "mv 目录前缀移动所有文件",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const expected = [
          "src/ui/components/Button.tsx",
          "src/ui/components/Card.tsx",
          "src/ui/components/Modal.tsx",
        ];
        const removed = [
          "src/components/Button.tsx",
          "src/components/Card.tsx",
          "src/components/Modal.tsx",
        ];
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          expected.every((path) => files.has(path)) &&
          removed.every((path) => !files.has(path));
        return {
          pass,
          message: pass ? "目录前缀移动结果符合预期" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
  ],
};

/** mv 重命名文件夹本身 */
export const bashMvRenameDirectoryCase: TestCase = {
  id: "bash-mv-rename-directory",
  name: "bash: mv 重命名文件夹",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/pages 文件夹本身重命名为 src/views。",
  expectedBehavior:
    "工具调用成功，src/pages 下文件消失，src/views 下出现 Home.tsx 和 Settings.tsx。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mv_rename_directory",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/pages src/views",
              description: "将 pages 文件夹重命名为 views",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 src/pages 重命名为 src/views。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "mv 重命名文件夹本身",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          files.has("src/views/Home.tsx") &&
          files.has("src/views/Settings.tsx") &&
          !files.has("src/pages/Home.tsx") &&
          !files.has("src/pages/Settings.tsx");
        return {
          pass,
          message: pass ? "文件夹名称重命名结果符合预期" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
  ],
};

/** cp 复制文件 */
export const bashCpCase: TestCase = {
  id: "bash-cp",
  name: "bash: cp 复制文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/utils/format.ts 复制到 src/utils/format.backup.ts。",
  expectedBehavior:
    "工具卡片绿色，输出以 'copied' 开头；FS Viewer 中出现 format.backup.ts，内容与 format.ts 相同，原文件保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_cp",
            name: BASH_TOOL_NAME,
            args: {
              command: "cp src/utils/format.ts src/utils/format.backup.ts",
              description: "备份 format.ts",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 format.ts 复制为 format.backup.ts。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** cp 批量复制到目录 */
export const bashCpGlobCase: TestCase = {
  id: "bash-cp-glob",
  name: "bash: cp glob 批量复制文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/pages/*.tsx 复制到 src/pages-backup/。",
  expectedBehavior:
    "工具卡片绿色，输出以 'copied' 开头并显示数量摘要；FS Viewer 中出现 src/pages-backup/Home.tsx 和 Settings.tsx，原 pages/ 文件保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_cp_glob",
            name: BASH_TOOL_NAME,
            args: {
              command: "cp src/pages/*.tsx src/pages-backup/",
              description: "备份所有页面组件",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将所有页面组件备份至 src/pages-backup/。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** cp -r 按路径前缀递归复制（目标不存在） */
export const bashCpRecursiveCase: TestCase = {
  id: "bash-cp-recursive",
  name: "bash: cp -r 目标不存在",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/components 递归复制到尚不存在的 src/ui。",
  expectedBehavior:
    "工具调用成功，输出以 'copied' 开头；FS Viewer 中出现 src/ui/Button.tsx、Card.tsx、Modal.tsx，原文件保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_cp_recursive",
            name: BASH_TOOL_NAME,
            args: {
              command: "cp -r src/components src/ui",
              description: "复制 components 目录前缀",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 src/components 复制到 src/ui。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "目标不存在时复制为目标路径本身",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const expected = [
          "src/ui/Button.tsx",
          "src/ui/Card.tsx",
          "src/ui/Modal.tsx",
        ];
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          expected.every((path) => files.has(path)) &&
          files.has("src/components/Button.tsx");
        return {
          pass,
          message: pass ? "递归复制结果符合预期" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
  ],
};

/** cp -r 按路径前缀递归复制（目标已存在） */
export const bashCpRecursiveExistingDirCase: TestCase = {
  id: "bash-cp-recursive-existing-dir",
  name: "bash: cp -r 目标已存在",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/components 递归复制到已存在的 src/ui 目录。",
  expectedBehavior:
    "工具调用成功，输出以 'copied' 开头；FS Viewer 中出现 src/ui/components/Button.tsx、Card.tsx、Modal.tsx，src/ui/placeholder.ts 保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES_WITH_UI_DIR,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_cp_recursive_existing_dir",
            name: BASH_TOOL_NAME,
            args: {
              command: "cp -r src/components src/ui",
              description: "复制 components 到已存在的 ui 目录",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 src/components 复制到 src/ui/components。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "目标已存在时保留源目录名",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const expected = [
          "src/ui/components/Button.tsx",
          "src/ui/components/Card.tsx",
          "src/ui/components/Modal.tsx",
          "src/ui/placeholder.ts",
        ];
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          expected.every((path) => files.has(path)) &&
          files.has("src/components/Button.tsx");
        return {
          pass,
          message: pass ? "递归复制结果符合目标已存在语义" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
  ],
};

/** cp -r 多源目录复制 */
export const bashCpRecursiveMultiSourceCase: TestCase = {
  id: "bash-cp-recursive-multi-source",
  name: "bash: cp -r 多源目录",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具将 src/components 和 src/pages 两个目录前缀复制到 backup/。",
  expectedBehavior:
    "工具调用成功，backup/components 和 backup/pages 下分别出现对应文件，原文件保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_cp_recursive_multi_source",
            name: BASH_TOOL_NAME,
            args: {
              command: "cp -r src/components src/pages backup/",
              description: "递归备份 components 和 pages",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 components 和 pages 复制到 backup。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "cp -r 多源目录保留各自目录名",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const files = new Set(memFS.snapshot().map((file) => file.path));
        const expected = [
          "backup/components/Button.tsx",
          "backup/components/Card.tsx",
          "backup/components/Modal.tsx",
          "backup/pages/Home.tsx",
          "backup/pages/Settings.tsx",
        ];
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          expected.every((path) => files.has(path)) &&
          files.has("src/components/Button.tsx") &&
          files.has("src/pages/Home.tsx");
        return {
          pass,
          message: pass ? "多源递归复制结果符合预期" : `当前文件: ${Array.from(files).join(", ")}`,
        };
      },
    },
  ],
};

/** rm 删除单文件 */
export const bashRmSingleCase: TestCase = {
  id: "bash-rm-single",
  name: "bash: rm 删除单文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具删除 src/theme/OldTheme.ts（废弃文件清理场景）。",
  expectedBehavior:
    "工具卡片绿色，输出以 'removed' 开头；FS Viewer 中 src/theme/OldTheme.ts 消失。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_rm_single",
            name: BASH_TOOL_NAME,
            args: {
              command: "rm src/theme/OldTheme.ts",
              description: "删除废弃的 OldTheme.ts",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已删除废弃的 OldTheme.ts。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** rm -r 递归删除目录 */
export const bashRmRecursiveCase: TestCase = {
  id: "bash-rm-recursive",
  name: "bash: rm -r 递归删除目录",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具使用 rm -r 删除整个 src/theme/ 目录。",
  expectedBehavior:
    "工具卡片绿色，输出以 'removed' 开头；FS Viewer 中 src/theme/ 下的所有文件消失。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_rm_r",
            name: BASH_TOOL_NAME,
            args: {
              command: "rm -r src/theme",
              description: "删除整个 theme 目录",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已删除 src/theme 目录及其所有文件。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** rm glob 批量删除 */
export const bashRmGlobCase: TestCase = {
  id: "bash-rm-glob",
  name: "bash: rm glob 批量删除文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具使用 glob 删除 src 下所有 .css 文件。",
  expectedBehavior:
    "工具卡片绿色，输出以 'removed' 开头并显示数量摘要；FS Viewer 中所有 .css 文件消失，其余文件保留。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_rm_glob",
            name: BASH_TOOL_NAME,
            args: {
              command: "rm src/**/*.css",
              description: "删除所有 CSS 文件（迁移到 CSS-in-JS）",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已删除所有 CSS 文件。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** rename 批量重命名路径 */
export const bashRenameCase: TestCase = {
  id: "bash-rename",
  name: "bash: rename 批量重命名路径片段",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具，将所有 src/pages/ 下文件路径中的 pages 替换为 views（目录重命名场景）。",
  expectedBehavior:
    "工具卡片绿色，输出以 'renamed' 开头；FS Viewer 中出现 src/views/Home.tsx 和 Settings.tsx，src/pages/ 下对应文件消失。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_rename",
            name: BASH_TOOL_NAME,
            args: {
              command: "rename 's/pages/views/' src/pages/**/*.tsx",
              description: "将 pages 目录重命名为 views",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将 pages 目录下所有文件路径中的 pages 替换为 views。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** rename 组件重命名（文件名 + 路径） */
export const bashRenameComponentCase: TestCase = {
  id: "bash-rename-component",
  name: "bash: rename 重命名组件文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具，将所有路径中的 OldTheme 替换为 theme（组件重命名场景）。",
  expectedBehavior:
    "工具卡片绿色，输出以 'renamed' 开头；src/theme/OldTheme.ts 变为 src/theme/theme.ts。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_rename_component",
            name: BASH_TOOL_NAME,
            args: {
              command: "rename OldTheme theme src/**/*",
              description: "重命名 OldTheme 相关文件",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将路径中的 OldTheme 替换为 theme。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** mkdir 不支持：虚拟 FS 没有空目录概念 */
export const bashMkdirCase: TestCase = {
  id: "bash-mkdir",
  name: "bash: mkdir 不支持（无空目录）",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具创建空目录，工具应提示虚拟文件系统没有空目录概念。",
  expectedBehavior:
    "工具调用成功返回非 0 exitCode，输出包含 'mkdir: command not supported' 和 'no empty directories'；FS Viewer 不出现 .gitkeep。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mkdir",
            name: BASH_TOOL_NAME,
            args: {
              command: "mkdir src/hooks",
              description: "创建 hooks 目录",
            },
          },
        ],
        delayMs: 300,
      },
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mkdir2",
            name: BASH_TOOL_NAME,
            args: {
              command: "mkdir src/contexts",
              description: "创建 contexts 目录",
            },
          },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: ["虚拟文件系统没有空目录概念，不需要先 mkdir；后续可直接创建 src/hooks/useXxx.ts 这类文件。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "mkdir 返回非 0 exitCode 且不是 invalid_args",
      run: ({ agent }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success") return null;
        const toolCalls = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.filter((tool: any) => tool.name === BASH_TOOL_NAME) ?? [];
        if (toolCalls.length < 2) return null;
        const pass = toolCalls.every((tool: any) =>
          tool.status === "success" &&
          tool.errorType !== "invalid_args" &&
          tool.result?.metadata?.exitCode === 1 &&
          String(tool.result?.output ?? "").includes("mkdir: command not supported") &&
          String(tool.result?.output ?? "").includes("no empty directories")
        );
        return {
          pass,
          message: pass ? "mkdir 明确提示无空目录概念" : `工具结果: ${JSON.stringify(toolCalls.map((tool: any) => tool.result?.metadata))}`,
        };
      },
    },
    {
      name: "mkdir 不创建 .gitkeep",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCalls = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.filter((tool: any) => tool.name === BASH_TOOL_NAME) ?? [];
        if (toolCalls.length < 2) return null;
        const gitkeepFiles = memFS.snapshot().filter((file) => file.path.endsWith("/.gitkeep"));
        return {
          pass: gitkeepFiles.length === 0,
          message: gitkeepFiles.length === 0 ? "未创建占位文件" : `发现占位文件: ${gitkeepFiles.map((file) => file.path).join(", ")}`,
        };
      },
    },
  ],
};

/** touch 创建空文件 */
export const bashTouchCase: TestCase = {
  id: "bash-touch",
  name: "bash: touch 创建空文件",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具创建 src/types/index.ts 和 src/constants/index.ts 两个空文件。",
  expectedBehavior:
    "工具卡片绿色，输出以 'touched' 开头；FS Viewer 中出现两个空文件。对已存在文件执行 touch 时不修改内容。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_touch",
            name: BASH_TOOL_NAME,
            args: {
              command: "touch src/types/index.ts",
              description: "创建 types 模块入口文件",
            },
          },
        ],
        delayMs: 300,
      },
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_touch2",
            name: BASH_TOOL_NAME,
            args: {
              command: "touch src/constants/index.ts",
              description: "创建 constants 模块入口文件",
            },
          },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: ["已创建 src/types/index.ts 和 src/constants/index.ts。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** sed 批量替换 import 路径 */
export const bashSedImportCase: TestCase = {
  id: "bash-sed-import",
  name: "bash: sed 批量替换 import 路径",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具，将所有文件中的 '../theme/OldTheme' import 路径替换为 '../theme/theme'。",
  expectedBehavior:
    "工具卡片绿色，输出以 'sed modified' 开头并包含 modified/unchanged 摘要；读取 Button/Card/Modal/Home/Settings 文件后可见 import 路径已更新。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_sed_import",
            name: BASH_TOOL_NAME,
            args: {
              command: "sed -i 's/OldTheme/theme/g' src/**/*.tsx",
              description: "将所有 tsx 文件中的 OldTheme 引用替换为 theme",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将所有 tsx 文件中的 OldTheme 引用替换为 theme。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** sed 多个 -e 表达式 */
export const bashSedMultiExpressionCase: TestCase = {
  id: "bash-sed-multi-expression",
  name: "bash: sed 多个表达式",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具一次执行多个 sed -e 替换表达式。",
  expectedBehavior:
    "工具调用成功，Button.tsx 中 OldTheme 变为 theme，btn 变为 button。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_sed_multi_expression",
            name: BASH_TOOL_NAME,
            args: {
              command: "sed -i -e 's/OldTheme/theme/g' -e 's/className=\"btn\"/className=\"button\"/g' src/components/Button.tsx",
              description: "同时替换主题名和 class 名",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已同时替换 Button.tsx 中的主题名和 class 名。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
  assertions: [
    {
      name: "多个 sed 表达式顺序生效",
      run: ({ agent, memFS }) => {
        const lastTurn = (agent as any)?.turns?.at?.(-1);
        if (!lastTurn || lastTurn.status !== "success" || !memFS) return null;
        const toolCall = lastTurn.iterations
          ?.flatMap((iter: any) => iter.toolCalls ?? [])
          ?.find((tool: any) => tool.name === BASH_TOOL_NAME);
        if (!toolCall || toolCall.status !== "success") return null;
        const content = memFS.readFile("src/components/Button.tsx") ?? "";
        const pass = toolCall.result?.metadata?.exitCode === 0 &&
          content.includes("../theme/theme") &&
          content.includes('className="button"') &&
          !content.includes("OldTheme") &&
          !content.includes('className="btn"');
        return {
          pass,
          message: pass ? "多个表达式替换结果符合预期" : content,
        };
      },
    },
  ],
};

/** sed 批量替换 ts 和 tsx 文件 */
export const bashSedMultiGlobCase: TestCase = {
  id: "bash-sed-multi-glob",
  name: "bash: sed 替换 class 名（多 glob）",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具，将所有文件中的 className='btn' 替换为 className='button'（CSS class 重命名）。",
  expectedBehavior:
    "工具卡片绿色，输出以 'sed modified' 开头并包含 modified/unchanged 摘要；受影响的文件中 btn class 名变为 button。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_sed_class",
            name: BASH_TOOL_NAME,
            args: {
              command: "sed -i 's/className=\"btn\"/className=\"button\"/g' src/**/*.tsx",
              description: "将 CSS class btn 重命名为 button",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["已将所有 tsx 文件中的 className='btn' 替换为 className='button'。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** 组合重构：mv + sed 串联 */
export const bashRefactorSequenceCase: TestCase = {
  id: "bash-refactor-sequence",
  name: "bash: 完整重构流程（mv + rename + sed）",
  group: "Bash 文件操作",
  priority: "P0",
  description:
    "模拟完整重构流程：1) mv 将 components/ 移至 ui/; 2) rename 将 pages/ 重命名为 views/; 3) sed 更新所有 import 路径。",
  expectedBehavior:
    "三个工具卡片依次成功，输出分别以 'moved'、'renamed'、'sed modified' 开头。FS Viewer 最终：src/ui/ 下有组件，src/views/ 下有页面，所有 import 路径已更新。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_refactor_1",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/components/*.tsx src/ui/",
              description: "将组件目录从 components 移至 ui",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_refactor_2",
            name: BASH_TOOL_NAME,
            args: {
              command: "rename 's/pages/views/' src/pages/**/*.tsx",
              description: "将 pages 目录重命名为 views",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_refactor_3",
            name: BASH_TOOL_NAME,
            args: {
              command: "sed -i 's/components/ui/g' src/**/*.tsx",
              description: "更新所有文件中 components 路径引用为 ui",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: [
          "重构完成。",
          "已将 components 移至 ui，pages 重命名为 views，并更新了所有相关 import 路径。",
        ],
        ttftMs: 200,
        chunkDelayMs: 60,
      },
    ],
    { loop: true }
  ),
};

/** bash 错误：mv 源文件不存在 */
export const bashMvNotFoundCase: TestCase = {
  id: "bash-mv-not-found",
  name: "bash: mv 源文件不存在（非 0 返回）",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash mv 命令移动一个不存在的文件，工具应像命令行一样返回输出和非 0 exitCode。",
  expectedBehavior:
    "工具卡片显示错误图标，输出包含 'No such file' 和 'Exit code: 1'；LLM 在收到命令返回后继续回复并说明原因。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_mv_err",
            name: BASH_TOOL_NAME,
            args: {
              command: "mv src/nonexistent.ts src/other.ts",
              description: "尝试移动不存在的文件",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["文件不存在，请先确认路径是否正确。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/** bash 错误：不支持的命令 */
export const bashUnsupportedCommandCase: TestCase = {
  id: "bash-unsupported-command",
  name: "bash: 不支持的命令（非 0 返回）",
  group: "Bash 文件操作",
  description:
    "LLM 调用 bash 工具传入 ls 命令，工具应像命令行一样返回不支持提示和非 0 exitCode。",
  expectedBehavior:
    "工具卡片显示错误图标，输出包含 'command not supported'、支持命令列表和 'Exit code: 1'。",
  initialTurns: [],
  initialFiles: REFACTOR_FILES,
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_unsupported",
            name: BASH_TOOL_NAME,
            args: {
              command: "ls src/",
              description: "尝试使用不支持的 ls 命令",
            },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: ["ls 命令不支持，请改用 glob_search 工具查询文件列表。"],
        ttftMs: 200,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};
