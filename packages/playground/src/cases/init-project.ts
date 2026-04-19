import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { createInitProjectSubAgent } from "@plugin/sandbox/tools/init-project-agent";
import type { RequestAsStreamParams } from "@request/types";

export const initProjectSingleFileCase: TestCase = {
  id: "init-project-single-file",
  name: "单文件初始化",
  group: "初始化项目",
  description: "LLM 输出单个带文件路径的代码块，成功写入",
  expectedBehavior: "工具卡片绿色，显示文件列表和行数，FS Viewer 中出现新文件。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_1",
        name: "call-sub-agent",
        args: {
          prompt: "创建一个简单的 React 项目，包含 App.tsx",
          type: "init-project",
          name: "初始化项目",
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: [
        "好的，我来为你创建 React 项目骨架。\n\n",
        "```src/App.tsx\n",
        "import React from 'react';\n",
        "\n",
        "export default function App() {\n",
        "  return (\n",
        "    <div className=\"app\">\n",
        "      <h1>Hello World</h1>\n",
        "    </div>\n",
        "  );\n",
        "}\n",
        "```\n\n",
        "项目已创建，包含一个基础的 App 组件。",
      ],
      ttftMs: 400,
      chunkDelayMs: 30,
    },
    {
      type: "content",
      chunks: ["项目初始化完成，文件已写入沙箱。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectLongWaitCase: TestCase = {
  id: "init-project-long-wait",
  name: "长时间等待",
  group: "初始化项目",
  description: "SubAgent 开始执行后长时间没有输出，模拟网络延迟或模型思考",
  expectedBehavior: "pending 状态持续时间较长，工具卡片显示 loading 动画和计时。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 第一次请求：返回工具调用
      if (idx === 0) {
        await delay(300);
        params.emits.onToolCallStream?.({
          index: 0,
          id: "init_wait",
          name: "call-sub-agent",
          argsChunk: "",
        });
        const argsObj = {
          prompt: "创建一个复杂的大型项目",
          type: "init-project",
          name: "复杂项目",
        };
        const argsStr = JSON.stringify(argsObj);
        for (let i = 0; i < argsStr.length; i += 4) {
          await delay(20);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, Math.min(i + 4, argsStr.length)) });
        }
        params.emits.onToolCalls?.([{ id: "init_wait", name: "call-sub-agent", args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      // 第二次请求：SubAgent 响应，包含长延迟和多个片段
      if (idx === 1) {
        // 首次响应延迟 5 秒
        await delay(5000);
        params.emits.write?.("好的，我来规划这个项目的结构...\n\n");

        // 继续延迟 4 秒
        await delay(4000);
        params.emits.write?.("让我考虑各个模块的划分...\n\n");

        // 再延迟 3 秒后开始输出代码
        await delay(3000);
        const codeChunks = [
          "```src/App.tsx\n",
          "import React from 'react';\n",
          "\n",
          "export default function App() {\n",
          "  return <div>Complex Project</div>;\n",
          "}\n",
          "```\n\n",
          "项目骨架已创建。",
        ];
        for (const chunk of codeChunks) {
          params.emits.write?.(chunk);
          await delay(40);
        }

        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      // 第三次请求：完成消息
      await delay(200);
      params.emits.write?.("复杂项目初始化完成。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

export const initProjectMultiFileCase: TestCase = {
  id: "init-project-multi-file",
  name: "多文件初始化",
  group: "初始化项目",
  description: "LLM 输出多个代码块，批量写入成功",
  expectedBehavior: "工具卡片显示多个文件，全部成功后显示摘要，FS Viewer 中出现所有新文件。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_2",
        name: "call-sub-agent",
        args: {
          prompt: "创建一个完整的 React 项目结构",
          type: "init-project",
          name: "项目初始化",
        },
      }],
      delayMs: 400,
    },
    {
      type: "content",
      chunks: [
        "好的，创建完整的项目结构。\n\n",
        "```src/index.tsx\n",
        "import React from 'react';\n",
        "import ReactDOM from 'react-dom/client';\n",
        "import App from './App';\n",
        "\n",
        "const root = ReactDOM.createRoot(document.getElementById('root')!);\n",
        "root.render(<App />);\n",
        "```\n\n",
        "```src/App.tsx\n",
        "import React from 'react';\n",
        "import { Header } from './components/Header';\n",
        "import { Footer } from './components/Footer';\n",
        "\n",
        "export default function App() {\n",
        "  return (\n",
        "    <div>\n",
        "      <Header />\n",
        "      <main>Content</main>\n",
        "      <Footer />\n",
        "    </div>\n",
        "  );\n",
        "}\n",
        "```\n\n",
        "```src/components/Header.tsx\n",
        "import React from 'react';\n",
        "\n",
        "export function Header() {\n",
        "  return <header>Header</header>;\n",
        "}\n",
        "```\n\n",
        "```src/components/Footer.tsx\n",
        "import React from 'react';\n",
        "\n",
        "export function Footer() {\n",
        "  return <footer>© 2024</footer>;\n",
        "}\n",
        "```\n\n",
        "项目结构已创建完成，包含入口文件和两个组件。",
      ],
      ttftMs: 300,
      chunkDelayMs: 25,
    },
    {
      type: "content",
      chunks: ["项目初始化完成，所有文件已写入沙箱。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectStreamingProgressCase: TestCase = {
  id: "init-project-streaming-progress",
  name: "流式进度解析",
  group: "初始化项目",
  description: "流式输出过程中，实时显示正在写入的文件",
  expectedBehavior: "进度中显示文件列表，最后一个文件状态为 'writing'，完成后变为 'complete'。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      if (idx === 0) {
        await delay(300);
        params.emits.onToolCallStream?.({
          index: 0,
          id: "init_stream",
          name: "call-sub-agent",
          argsChunk: "",
        });
        const argsObj = { prompt: "创建项目", type: "init-project", name: "流式初始化" };
        const argsStr = JSON.stringify(argsObj);
        for (let i = 0; i < argsStr.length; i += 4) {
          await delay(20);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, Math.min(i + 4, argsStr.length)) });
        }
        params.emits.onToolCalls?.([{ id: "init_stream", name: "call-sub-agent", args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        await delay(400);
        params.emits.write?.("好的，开始创建文件。\n\n");
        params.emits.write?.("```src/main.tsx\n");
        await delay(100);
        params.emits.write?.("import React from 'react';\n");
        await delay(80);
        params.emits.write?.("import App from './App';\n");
        await delay(80);
        params.emits.write?.("\nrender(<App />);\n");
        await delay(80);
        params.emits.write?.("```\n\n");
        params.emits.write?.("```src/App.tsx\n");
        await delay(100);
        params.emits.write?.("export default function App() {\n");
        await delay(80);
        params.emits.write?.("  return <div>App</div>;\n");
        await delay(80);
        params.emits.write?.("}\n");
        await delay(80);
        params.emits.write?.("```\n\n");
        params.emits.write?.("文件创建完成。");
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      await delay(200);
      params.emits.write?.("初始化完成。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

export const initProjectNoFilesCase: TestCase = {
  id: "init-project-no-files",
  name: "无有效文件",
  group: "初始化项目",
  description: "LLM 输出普通文本，没有带文件路径的代码块",
  expectedBehavior: "工具结果提示 '未解析到任何文件'，metadata.filesWritten 为 0。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_nofile",
        name: "call-sub-agent",
        args: {
          prompt: "创建项目",
          type: "init-project",
          name: "空初始化",
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: [
        "你需要先告诉我项目的具体需求，",
        "比如使用什么框架、有哪些页面等。",
        "请提供更多信息。",
      ],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
    {
      type: "content",
      chunks: ["好的，请告诉我更多需求。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectPartialFailureCase: TestCase = {
  id: "init-project-partial-failure",
  name: "部分文件写入失败",
  group: "初始化项目",
  description: "多个文件中，部分写入成功，部分因沙箱限制失败",
  expectedBehavior: "工具结果显示成功数和失败数，失败文件名被列出，metadata 包含 failedPaths。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_partial",
        name: "call-sub-agent",
        args: {
          prompt: "创建包含 node_modules 的项目",
          type: "init-project",
          name: "受限初始化",
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: [
        "```src/App.tsx\n",
        "export default function App() { return <div/>; }\n",
        "```\n\n",
        "```node_modules/package/index.js\n",
        "module.exports = {};\n",
        "```\n\n",
        "文件已创建。",
      ],
      ttftMs: 400,
      chunkDelayMs: 40,
    },
    {
      type: "content",
      chunks: ["初始化完成。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectIncompleteBlockCase: TestCase = {
  id: "init-project-incomplete-block",
  name: "代码块未闭合",
  group: "初始化项目",
  description: "流式输出在代码块中途断开，最后一个文件标记为 writing",
  expectedBehavior: "进度显示最后一个文件状态为 'writing'，工具结果正常（已写入的文件）。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_incomplete",
        name: "call-sub-agent",
        args: {
          prompt: "创建大文件",
          type: "init-project",
          name: "中断初始化",
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: [
        "```src/large.ts\n",
        "// Large file content\n",
        "const data = {\n",
      ],
      ttftMs: 400,
      chunkDelayMs: 50,
    },
    {
      type: "content",
      chunks: ["初始化完成。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectWithLanguageCase: TestCase = {
  id: "init-project-with-language",
  name: "带语言标记的代码块",
  group: "初始化项目",
  description: "LLM 输出 ```tsx src/App.tsx 格式，验证解析正确",
  expectedBehavior: "文件路径正确提取（忽略语言标记），写入成功。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      calls: [{
        id: "init_lang",
        name: "call-sub-agent",
        args: {
          prompt: "创建 TypeScript 项目",
          type: "init-project",
          name: "TS初始化",
        },
      }],
      delayMs: 300,
    },
    {
      type: "content",
      chunks: [
        "```tsx src/App.tsx\n",
        "import React from 'react';\n",
        "\n",
        "export default function App(): JSX.Element {\n",
        "  return <div>TS App</div>;\n",
        "}\n",
        "```\n\n",
        "已创建 TypeScript 组件。",
      ],
      ttftMs: 400,
      chunkDelayMs: 40,
    },
    {
      type: "content",
      chunks: ["TypeScript 项目初始化完成。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};

export const initProjectRetryCase: TestCase = {
  id: "init-project-retry",
  name: "网络重试",
  group: "初始化项目",
  description: "第一次请求失败触发重试，重试后成功并返回长内容",
  expectedBehavior: "显示重试提示 '正在重试 (1/2)'，然后成功显示长内容。",
  initialTurns: [],
  createSubAgents: (sandbox) => [createInitProjectSubAgent(sandbox)],
  request: (() => {
    let callIndex = 0;
    return async (params: RequestAsStreamParams) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      // 第一次请求：失败，触发重试
      if (idx === 0) {
        await delay(300);
        params.emits.error?.(new Error("Network timeout"));
        return;
      }

      // 第二次请求（重试后）：成功，返回工具调用
      if (idx === 1) {
        await delay(400);
        params.emits.onToolCallStream?.({
          index: 0,
          id: "init_retry",
          name: "call-sub-agent",
          argsChunk: "",
        });
        const argsObj = { prompt: "创建项目", type: "init-project", name: "重试初始化" };
        const argsStr = JSON.stringify(argsObj);
        for (let i = 0; i < argsStr.length; i += 4) {
          await delay(20);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, Math.min(i + 4, argsStr.length)) });
        }
        params.emits.onToolCalls?.([{ id: "init_retry", name: "call-sub-agent", args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      // 第三次请求：SubAgent 内部的响应，包含大量片段和较长延迟
      if (idx === 2) {
        await delay(800); // 首次响应延迟

        const chunks = [
          "好的，我来创建项目。\n\n",
          "```src/index.tsx\n",
          "import React from 'react';\n",
          "import ReactDOM from 'react-dom/client';\n",
          "import App from './App';\n",
          "\n",
          "const root = ReactDOM.createRoot(document.getElementById('root')!);\n",
          "root.render(<App />);\n",
          "```\n\n",
          "```src/App.tsx\n",
          "import React from 'react';\n",
          "import { Header } from './components/Header';\n",
          "import { Content } from './components/Content';\n",
          "import { Footer } from './components/Footer';\n",
          "\n",
          "export default function App() {\n",
          "  return (\n",
          "    <div className=\"app\">\n",
          "      <Header />\n",
          "      <Content />\n",
          "      <Footer />\n",
          "    </div>\n",
          "  );\n",
          "}\n",
          "```\n\n",
          "```src/components/Header.tsx\n",
          "import React from 'react';\n",
          "\n",
          "export function Header() {\n",
          "  return (\n",
          "    <header>\n",
          "      <h1>MyBricks App</h1>\n",
          "    </header>\n",
          "  );\n",
          "}\n",
          "```\n\n",
          "```src/components/Content.tsx\n",
          "import React from 'react';\n",
          "\n",
          "export function Content() {\n",
          "  return (\n",
          "    <main>\n",
          "      <p>这是主要内容区域</p>\n",
          "    </main>\n",
          "  );\n",
          "}\n",
          "```\n\n",
          "```src/components/Footer.tsx\n",
          "import React from 'react';\n",
          "\n",
          "export function Footer() {\n",
          "  return <footer>© 2024 MyBricks</footer>;\n",
          "}\n",
          "```\n\n",
          "项目结构已创建完成。",
        ];

        // 流式输出，每个片段之间有延迟
        for (const chunk of chunks) {
          params.emits.write?.(chunk);
          await delay(150); // 片段之间的延迟
        }

        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      // 第四次请求：最后的完成消息
      await delay(300);
      params.emits.write?.("项目初始化完成，所有文件已写入沙箱。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};
