import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * 工具调用相关 case。
 * CodeAgent 已内置 read_file / write_file / edit_file / delete_file 工具，
 * 通过 MemFS 实现真实的内存文件系统读写。
 * 这里只控制 LLM 返回哪个 tool_call，以及何时报错。
 *
 * 所有 case 均使用 loop: true，确保多次发消息时 step 序列循环，工具调用持续可见。
 */

export const toolSuccessCase: TestCase = {
  id: "tool-success-read",
  name: "read_file 成功",
  group: "工具调用",
  description: "LLM 调用 read_file 读取 src/App.tsx，工具正常返回文件内容",
  expectedBehavior: "工具卡片绿色，LLM 基于文件内容继续回复。多次发消息循环触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_read_1", name: "read_file", args: { path: "src/App.tsx" } }],
      delayMs: 500,
    },
    {
      type: "content",
      chunks: ["我读取了 App.tsx。", "文件中有一个默认导出的 App 组件，引用了 Button 组件，整体结构清晰。"],
      ttftMs: 400,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolWriteCase: TestCase = {
  id: "tool-write-file",
  name: "write_file 写入",
  group: "工具调用",
  description: "LLM 调用 write_file 修改 src/App.tsx，写入成功后 LLM 继续回复",
  expectedBehavior: "工具卡片绿色，FS Viewer 中 src/App.tsx 内容更新。多次发消息循环触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "c_write_1",
        name: "write_file",
        args: {
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
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: ["已将 App.tsx 更新，添加了 Header 组件的引用。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolMultiWriteCase: TestCase = {
  id: "tool-multi-write",
  name: "multi_write 批量写入",
  group: "工具调用",
  description: "LLM 调用 multi_write_file 同时创建多个新文件",
  expectedBehavior: "多个工具卡片依次成功，FS Viewer 中出现新文件。多次发消息循环触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "c_mw_1",
        name: "multi_write_file",
        args: {
          files: [
            {
              path: "src/components/Header.tsx",
              content: `import React from 'react';
interface HeaderProps { title: string; }
export function Header({ title }: HeaderProps) {
  return <header className="header"><h1>{title}</h1></header>;
}`,
            },
            {
              path: "src/components/Footer.tsx",
              content: `import React from 'react';
export function Footer() {
  return <footer className="footer">© 2024 My App</footer>;
}`,
            },
          ],
        },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: ["已创建 Header.tsx 和 Footer.tsx 两个组件文件。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolReadThenWriteCase: TestCase = {
  id: "tool-read-then-write",
  name: "read → write 完整流程",
  group: "工具调用",
  description: "先 read_file 读取 Button.tsx，再 write_file 修改它，验证多步工具调用",
  expectedBehavior: "两个工具卡片依次成功，FS Viewer 中 Button.tsx 内容已更新。多次发消息循环触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_r_1", name: "read_file", args: { path: "src/components/Button.tsx" } }],
      delayMs: 400,
    },
    {
      type: "tool_calls",
      calls: [{
        id: "c_w_1",
        name: "write_file",
        args: {
          path: "src/components/Button.tsx",
          content: `import React from 'react';

interface ButtonProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({ label, onClick, variant = 'primary', disabled }: ButtonProps) {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}`,
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["已读取并更新 Button.tsx，新增了 variant 和 disabled 两个 props。"],
      ttftMs: 400,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolDeleteCase: TestCase = {
  id: "tool-delete-file",
  name: "delete_file 删除",
  group: "工具调用",
  description: "LLM 调用 delete_file 删除 src/styles/global.css",
  expectedBehavior: "工具卡片绿色，FS Viewer 中 global.css 消失。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_del_1", name: "delete_file", args: { paths: ["src/styles/global.css"] } }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["已删除 global.css。如果需要重新添加样式，可以创建新的 CSS 文件。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};

export const toolNotFoundCase: TestCase = {
  id: "tool-not-found",
  name: "读取不存在的文件",
  group: "工具调用",
  description: "LLM 尝试读取一个不存在的文件路径，工具抛出 ToolValidationError",
  expectedBehavior: "tool:error 触发，工具卡片红色，错误信息 'File not found'，LLM 继续回复。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{ id: "c_r_err", name: "read_file", args: { path: "src/nonexistent.ts" } }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: ["文件 src/nonexistent.ts 不存在。当前项目中没有这个文件，请确认文件路径后重试。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};
