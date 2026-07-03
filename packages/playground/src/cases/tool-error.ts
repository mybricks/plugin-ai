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

/**
 * LLM 将 write_file 的 content 中的中文以 \uXXXX 字面量形式输出。
 *
 * 复现场景：某些模型在生成工具参数 JSON 时，对非 ASCII 字符采用
 * ASCII-safe 编码策略，将"关闭"写成字面文本 \u5173\u95ed，
 * 而非直接输出汉字。这导致写入文件的内容包含 \uXXXX 文本而非真实汉字。
 *
 * 在 JS 源码中，'\\u5173' 是包含字面反斜杠的 6 字符字符串 \u5173，
 * JSON.stringify 后变为 \\u5173，agent 解析 JSON 后得到含反斜杠的字面文本。
 */
export const toolWriteUnicodeEscapeCase: TestCase = {
  id: "tool-write-unicode-escape",
  name: "write_file 含 \\uXXXX 转义中文",
  group: "工具调用",
  description:
    "LLM 返回的 write_file content 中，中文以字面 \\uXXXX 形式出现（如 \\u5173\\u95ed 代替「关闭」），而非直接输出汉字。",
  expectedBehavior:
    "工具卡片绿色，FS Viewer 中文件内容包含字面量 \\uXXXX 文本，可观察到汉字未被正确写入。",
  initialTurns: [],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_unicode_1",
            name: "write_file",
        args: {
          path: "src/components/Button.tsx",
          // 字符串中的 \\uXXXX 是字面反斜杠 + uXXXX，模拟 LLM 将汉字转义输出的场景
          content: [
            "import React from 'react';",
            "",
            "// \\u6309\\u9215\\u7ec4\\u4ef6 (Button)",
            "interface ButtonProps {",
            "  // \\u6807\\u7b7e (label)",
            "  label: string;",
            "  // \\u70b9\\u51fb\\u4e8b\\u4ef6 (onClick)",
            "  onClick?: () => void;",
            "  // \\u7981\\u7528\\u72b6\\u6001 (disabled)",
            "  disabled?: boolean;",
            "}",
            "",
            "export function Button({ label, onClick, disabled }: ButtonProps) {",
            "  return (",
            "    // \\u6309\\u9215\\u5bb9\\u5668",
            "    <button",
            "      className=\"btn\"",
            "      onClick={onClick}",
            "      disabled={disabled}",
            "    >",
            "      {/* \\u6309\\u9215\\u6587\\u5b57 */}",
            "      {label}",
            "    </button>",
            "  );",
            "}",
          ].join("\n"),
        },
          },
        ],
        delayMs: 400,
      },
      {
        type: "content",
        chunks: [
          "\\u5df2\\u521b\\u5efa Modal.tsx\\uff0c",
          "\\u5305\\u542b\\u5f39\\u7a97\\u7ec4\\u4ef6\\u7684\\u57fa\\u7840\\u7ed3\\u6784\\u3002",
        ],
        ttftMs: 300,
        chunkDelayMs: 80,
      },
    ],
    { loop: true }
  ),
};

/**
 * write_file 的 content 含 \uXXXX 转义序列，且流式传输在某个转义序列中途断开。
 *
 * 复现场景：
 *  1. LLM 开始流式输出 write_file 的参数 JSON
 *  2. content 中含有多处 \uXXXX 序列（字面反斜杠 + uXXXX）
 *  3. 在第一个 \\u 序列的数字部分尚未完整传输时，连接中断
 *
 * 此 case 使用 raw async 函数以精确控制流的截断位置。
 */
export const toolWriteUnicodeMidStreamCase: TestCase = {
  id: "tool-write-unicode-mid-stream",
  name: "write_file \\uXXXX 序列流式中断",
  group: "工具调用",
  description:
    "write_file 的 content 含字面 \\uXXXX 序列，流式传输时在某个转义序列的数字部分中途断开连接。",
  expectedBehavior:
    "工具卡片显示不完整参数后进入 error 状态，消息气泡进入 error 状态，可重试。",
  initialTurns: [],
  request: async (params) => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // content 中含字面 \uXXXX 序列（JS 源码中 \\uXXXX = 字面反斜杠 + uXXXX）
    // JSON.stringify 后，单个反斜杠变为 \\，即流中传输的是 \\u5173 等序列
    const argsObj = {
      path: "src/components/Button.tsx",
      content: [
        "import React from 'react';",
        "",
        "// \\u6309\\u9215\\u7ec4\\u4ef6 (Button)",
        "interface ButtonProps {",
        "  label: string; // \\u6807\\u7b7e",
        "  onClick?: () => void; // \\u70b9\\u51fb",
        "  disabled?: boolean; // \\u7981\\u7528",
        "}",
        "",
        "export function Button({ label, onClick, disabled }: ButtonProps) {",
        "  return <button onClick={onClick} disabled={disabled}>{label}</button>;",
        "}",
      ].join("\n"),
    };
    const argsStr = JSON.stringify(argsObj);

    // 找到第一处 \\u 序列（JSON 中两个连续反斜杠后跟 u），在其数字部分中途截断
    // argsStr 是 JS 字符串，\\（两个反斜杠）在 JS 字符串中分别是独立的反斜杠字符
    let cutIdx = -1;
    for (let i = 0; i < argsStr.length - 2; i++) {
      if (argsStr[i] === "\\" && argsStr[i + 1] === "\\" && argsStr[i + 2] === "u") {
        // 截断在 \\u 之后、16 进制数字的中间（保留前两位数字，丢弃后两位）
        cutIdx = i + 5; // \\u + 前两位数字（共 5 字符），留下 \\u5f 然后断流
        break;
      }
    }
    if (cutIdx === -1) cutIdx = Math.floor(argsStr.length * 0.55);

    await delay(300);

    params.emits.onToolCallStream?.({
      index: 0,
      id: "c_umid_1",
      name: "write_file",
      argsChunk: "",
    });

    // 流式发送直到截断点，每次 4 字符
    for (let i = 0; i < cutIdx; i += 4) {
      await delay(20);
      params.emits.onToolCallStream?.({
        index: 0,
        argsChunk: argsStr.slice(i, Math.min(i + 4, cutIdx)),
      });
    }

    // 在 \uXXXX 序列数字部分中途断流
    await delay(200);
    params.emits.error(
      new Error("Stream aborted: connection reset mid-unicode-escape (\\uXXXX truncated)")
    );
  },
};

/**
 * 工具参数 JSON 传输完成但内容本身不可解析。
 *
 * 和 network-error 里的“参数流中途接口报错”不同，这里 LLM 正常返回 tool_calls，
 * 但 arguments 是坏 JSON，agent 应该在工具执行阶段标记 tool:error。
 */
export const toolArgsJsonParseErrorCase: TestCase = {
  id: "tool-args-json-parse-error",
  name: "工具参数 JSON 解析失败",
  group: "工具调用",
  description: "LLM 流式返回 write_file 的坏 JSON 参数，onToolCalls 正常结束，触发 agent 内部 JSON.parse 失败。",
  expectedBehavior:
    "工具卡片保留流式展示的原始参数内容，随后进入红色错误态；args 不应被 _argsRaw 污染，也不应被 tool:call 清空。",
  initialTurns: [],
  request: async (params) => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const badArgs = `{"path":"src/Broken.tsx","content":"export const broken = true;"`;

    await delay(300);
    params.emits.onToolCallStream?.({
      index: 0,
      id: "c_bad_json_1",
      name: "write_file",
      argsChunk: "",
    });

    for (let i = 0; i < badArgs.length; i += 5) {
      await delay(25);
      params.emits.onToolCallStream?.({
        index: 0,
        argsChunk: badArgs.slice(i, i + 5),
      });
    }

    params.emits.onToolCalls?.([
      { id: "c_bad_json_1", name: "write_file", args: null as any },
    ]);
    params.emits.onFinishReason?.("tool_calls");
    params.emits.complete?.("");
  },
};

/**
 * write_file 超长文件名测试
 *
 * 复现场景：LLM 返回一个超长文件名（超过 200 字符），验证 UI 渲染不会溢出或截断异常。
 * 文件名包含多级嵌套目录和长文件名，用于测试前端对长路径的展示效果。
 */
export const toolWriteLongFilenameCase: TestCase = {
  id: "tool-write-long-filename",
  name: "write_file 超长文件名",
  group: "工具调用",
  description: "LLM 调用 write_file 写入一个超长路径的文件，验证 UI 渲染效果",
  expectedBehavior: "工具卡片显示完整路径，不应溢出或截断异常。多次发消息循环触发。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "c_long_1",
        name: "write_file",
        args: {
          path: "src/features/user-management/components/authentication/forms/login-form/fields/LoginFormUsernameFieldWithValidationAndPlaceholder.tsx",
          content: `import React from 'react';

interface LoginFormUsernameFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LoginFormUsernameFieldWithValidationAndPlaceholder({
  value,
  onChange,
  placeholder = '请输入用户名',
  disabled = false,
}: LoginFormUsernameFieldProps) {
  return (
    <input
      type="text"
      className="form-input username-field"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label="用户名输入框"
    />
  );
}`,
        },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "已创建登录表单的用户名字段组件，路径较长以便于项目结构清晰。",
        "组件包含验证逻辑和占位符文本，可直接在 LoginForm 中使用。",
      ],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ], { loop: true }),
};
