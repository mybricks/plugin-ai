import type { TestCase } from "./types";
import { createInitProjectTool } from "@agent";
import { MemFS } from "../lib/mem-fs";
import type { FsFile } from "../lib/mem-fs";

const INIT_PROJECT_TOOL_NAME = "init-project";

/**
 * P0 测试用例：init-project SubAgent LLM 中途断流
 *
 * 背景：
 *   init-project tool 内部使用 SubAgent 生成文件，SubAgent 会边流边写。
 *   如果 SubAgent 的 LLM 请求在生成第 N 个文件后中途报错，
 *   之前已写入的文件应保留，output 需告知外层 Agent 已写/未写文件。
 *
 * 流程（request 按调用次序响应）：
 *   1. 外层 Agent 第1次请求 → 返回 init-project tool_call（filesToGenerate 包含5个文件）
 *   2. SubAgent 请求 → 流出文件1~3的完整代码块，第4个文件传输中途报错（模拟流中断）
 *   3. 外层 Agent 第2次请求（收到中断 output 后继续）→ 返回 content
 *
 * 验证要点：
 *   - FS Viewer 中 index.jsx / App.jsx / utils.js 已写入
 *   - tool 卡片 output 包含「生成过程中断」和已写/未写文件列表
 *   - 外层 Agent 正常收到 output 并继续响应
 */
export const initProjectSubAgentErrorCase: TestCase = {
  id: "init-project-subagent-error",
  name: "SubAgent 流中断（已写文件保留）",
  group: "init-project",
  priority: "P0",
  description:
    "init-project tool 调用 SubAgent 生成5个文件，SubAgent LLM 在第3个文件写完后流中断报错。验证：已写的3个文件保留在 FS，tool output 告知外层 Agent 中断原因及剩余文件。",
  expectedBehavior:
    "FS Viewer 出现 index.jsx / App.jsx / utils.js（3个文件）；tool 卡片展示 output 包含「生成过程中断」；外层 Agent 继续回复「已了解，将继续生成剩余文件」。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new MemFS([]))],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      if (idx === 0) {
        await delay(400);
        const argsObj = {
          filesToGenerate: ["index.jsx", "App.jsx", "utils.js", "styles/main.css", "components/Header.jsx"],
        };
        const argsStr = JSON.stringify(argsObj);
        params.emits.onToolCallStream?.({ index: 0, id: "call_init_1", name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 6) {
          await delay(15);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 6) });
        }
        params.emits.onToolCalls?.([{ id: "call_init_1", name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        await delay(300);
        const file1 = "```index.jsx\nimport React from 'react';\nimport App from './App';\nimport ReactDOM from 'react-dom/client';\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);\n```";
        const file2 = "\n\n```App.jsx\nimport React from 'react';\nimport { formatDate } from './utils';\n\nexport default function App() {\n  return (\n    <div className=\"app\">\n      <h1>Hello World</h1>\n      <p>{formatDate(new Date())}</p>\n    </div>\n  );\n}\n```";
        const file3 = "\n\n```utils.js\nexport function formatDate(date) {\n  return date.toLocaleDateString('zh-CN');\n}\n\nexport function formatTime(date) {\n  return date.toLocaleTimeString('zh-CN');\n}\n```";
        const file4Partial = "\n\n```styles/main.css\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\n.app {\n  max-width: 800px;";
        const fullContent = file1 + file2 + file3 + file4Partial;
        for (let i = 0; i < fullContent.length; i += 20) {
          await delay(30);
          params.emits.write?.(fullContent.slice(i, i + 20));
        }
        await delay(200);
        params.emits.error?.(new Error("Stream aborted: connection reset by peer (mid-file)"));
        return;
      }

      await delay(300);
      for (const chunk of ["已收到中断信息。", "文件 index.jsx、App.jsx、utils.js 已写入。", "将继续调用 init-project 生成剩余的 styles/main.css 和 components/Header.jsx。"]) {
        await delay(80);
        params.emits.write?.(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

/**
 * P0 测试用例：SubAgent 首次请求即报错（无文件写入）
 *
 * 背景：
 *   SubAgent LLM 请求在流出任何文件内容之前就报错（如 500）。
 *   output 应说明无文件写入，并列出所有未生成的文件。
 *
 * 流程：
 *   1. 外层 Agent 第1次请求 → init-project tool_call（filesToGenerate: 3个文件）
 *   2. SubAgent 请求 → 立即报错（500）
 *   3. 外层 Agent 第2次请求 → 返回 content
 *
 * 验证要点：
 *   - FS Viewer 无新文件
 *   - tool 卡片 output 包含「生成过程中断」和「无文件写入」
 *   - 外层 Agent 正常继续响应
 */
export const initProjectSubAgentImmediateErrorCase: TestCase = {
  id: "init-project-subagent-immediate-error",
  name: "SubAgent 立即报错（无文件写入）",
  group: "init-project",
  priority: "P0",
  description:
    "init-project tool 的 SubAgent LLM 在返回任何内容前立即报错（如 500）。验证：FS 无新文件；output 包含「无文件写入」和完整的未生成文件列表。",
  expectedBehavior:
    "FS Viewer 无新文件；tool 卡片 output 包含「生成过程中断」和「无文件写入」；外层 Agent 继续回复。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new MemFS([]))],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      if (idx === 0) {
        await delay(300);
        const argsObj = { filesToGenerate: ["index.jsx", "App.jsx", "styles.css"] };
        const argsStr = JSON.stringify(argsObj);
        params.emits.onToolCallStream?.({ index: 0, id: "call_init_imm", name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 6) {
          await delay(15);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 6) });
        }
        params.emits.onToolCalls?.([{ id: "call_init_imm", name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        await delay(400);
        params.emits.error?.(new Error("Request failed with status 500: Internal Server Error"));
        return;
      }

      await delay(300);
      for (const chunk of ["SubAgent 请求失败，未写入任何文件。", "将重新调用 init-project 生成 index.jsx、App.jsx 和 styles.css。"]) {
        await delay(80);
        params.emits.write?.(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

/**
 * P0 测试用例：SubAgent 输出最后一个文件时缺少闭合代码块
 *
 * 背景：
 *   parseFileBlocks 只识别完整的 ```path\ncontent\n``` 块。
 *   如果最后一个文件缺少结尾的 ```，该文件不会被解析为完整文件，
 *   因此不应被写入 FS，也不会出现在 successPaths 里。
 *
 * 流程：
 *   1. 外层 Agent 第1次请求 → init-project tool_call（filesToGenerate: App.jsx, styles.css）
 *   2. SubAgent 请求 → 流出 App.jsx（完整）+ styles.css（缺少闭合 ```）→ finishReason=stop
 *   3. 外层 Agent 第2次请求 → 返回 content
 *
 * 验证要点：
 *   - FS Viewer 只出现 App.jsx，styles.css 不应写入
 *   - tool output 中 styles.css 应出现在缺少或失败文件列表里
 *   - 观察外层 Agent 是否再次调用 init-project 补写
 */
export const initProjectMissingClosingFenceCase: TestCase = {
  id: "init-project-missing-closing-fence",
  name: "文件缺少闭合代码块",
  group: "init-project",
  priority: "P0",
  description:
    "SubAgent 输出多个文件时，最后一个文件缺少代码块闭合符号。验证未闭合文件不会被误判为已写入，并观察外层 Agent 是否继续调用 init-project。",
  expectedBehavior:
    "FS Viewer 只出现已闭合的 App.jsx；styles.css 应出现在 tool output 的缺失文件列表里；Request Inspector 可观察外层 Agent 是否再次发起 init-project。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new MemFS([]))],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const idx = callIndex++;

      if (idx === 0) {
        const argsObj = { filesToGenerate: ["App.jsx", "styles.css"] };
        const argsStr = JSON.stringify(argsObj);
        await delay(200);
        params.emits.onToolCallStream?.({ index: 0, id: "call_init_missing_fence", name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 8) {
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 8) });
        }
        params.emits.onToolCalls?.([{ id: "call_init_missing_fence", name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        const content =
          "```App.jsx\nexport default function App() {\n  return <div>App</div>;\n}\n```\n\n" +
          "```styles.css\n.app {\n  color: red;\n}";
        await delay(200);
        for (let i = 0; i < content.length; i += 16) {
          await delay(20);
          params.emits.write?.(content.slice(i, i + 16));
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      await delay(200);
      params.emits.write?.("styles.css 未闭合未被写入，将继续处理。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

/**
 * PartialFailureMemFS：继承 MemFS，首次写入 broken.js 时抛错，模拟 updateFiles 失败。
 */
class PartialFailureMemFS extends MemFS {
  private failed = false;

  async updateFiles(files: FsFile[]): Promise<void> {
    if (!this.failed && files.some((file) => file.path === "broken.js")) {
      this.failed = true;
      throw new Error("Permission denied: broken.js");
    }
    await super.updateFiles(files);
  }
}

/**
 * P0 测试用例：SubAgent 流式写入时部分文件 updateFiles 失败
 *
 * 背景：
 *   executeSubAgent 在 llm:content 事件里发现完整代码块后立即调用 sandbox.updateFiles。
 *   若 updateFiles 抛错，该文件在 progressState 里被标记为 error，但由于
 *   writtenFiles.add 在 updateFiles 之前执行，失败的文件路径仍会进入 writtenFiles。
 *   这会导致在 requestError 分支里把失败文件误报为"已成功写入"。
 *
 * 流程：
 *   1. 外层 Agent 第1次请求 → init-project tool_call（filesToGenerate: broken.js, healthy.js）
 *   2. SubAgent 请求 → 流出两个文件后触发流错误；
 *      broken.js 的 updateFiles 会被 PartialFailureMemFS 拦截并抛错
 *   3. 外层 Agent 第2次请求 → 返回 content
 *
 * 验证要点（暴露已知 bug）：
 *   - FS Viewer 出现 healthy.js，不应出现 broken.js
 *   - tool output 里 broken.js 应标记为失败（当前实现可能误报为成功）
 *   - 观察 broken.js 是否因 writtenFiles 提前 add 而从 remainingFiles 消失
 */
export const initProjectPartialUpdateFailureCase: TestCase = {
  id: "init-project-partial-update-failure",
  name: "部分文件 update 失败",
  group: "init-project",
  priority: "P0",
  description:
    "SubAgent 输出多个完整文件时，broken.js 的 sandbox.updateFiles 失败，随后请求中断。验证已成功文件、写入失败文件和后续重试请求的行为。",
  expectedBehavior:
    "FS Viewer 出现 healthy.js，不应出现 broken.js；tool output 应准确标记 broken.js 写入失败（当前实现存在 bug：broken.js 可能被误报为成功）。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new PartialFailureMemFS())],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const idx = callIndex++;

      if (idx === 0) {
        const argsObj = { filesToGenerate: ["broken.js", "healthy.js"] };
        const argsStr = JSON.stringify(argsObj);
        await delay(200);
        params.emits.onToolCallStream?.({ index: 0, id: "call_init_partial_failure", name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 8) {
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 8) });
        }
        params.emits.onToolCalls?.([{ id: "call_init_partial_failure", name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        const content =
          "```broken.js\nexport const broken = true;\n```\n\n" +
          "```healthy.js\nexport const healthy = true;\n```";
        await delay(200);
        for (let i = 0; i < content.length; i += 16) {
          await delay(20);
          params.emits.write?.(content.slice(i, i + 16));
        }
        await delay(100);
        params.emits.error?.(new Error("Stream aborted after partial update failure"));
        return;
      }

      await delay(200);
      params.emits.write?.("已收到部分写入失败，将继续补写失败文件。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

/**
 * P0 测试用例：SubAgent finishReason=length 时 beforeRequest hook 注入文件状态
 *
 * 背景：
 *   当 SubAgent LLM 因输出长度限制返回 finishReason=length 时，
 *   Agent 内部 loop 会继续发起下一次 LLM 请求（length 续写）。
 *   executeSubAgent 通过 createFork 的 hooks.beforeRequest 在每次请求前注入
 *   「已写入文件（无需重复）/ 待写入文件」，确保续写时模型不会重复输出已写文件。
 *
 * 流程：
 *   1. 外层 Agent 第1次请求 → init-project tool_call（filesToGenerate: App.jsx, styles.css）
 *   2. SubAgent 第1次请求 → 输出 App.jsx → finishReason=length
 *   3. SubAgent 第2次请求（length 续写，beforeRequest 注入状态）→ 重复输出 App.jsx + 输出 styles.css → finishReason=stop
 *   4. 外层 Agent 第2次请求 → 返回 content
 *
 * 验证要点：
 *   - Request Inspector 第3次请求的 messages 里应能看到 beforeRequest 注入的文件状态 user 消息
 *   - FS Viewer 出现 App.jsx 和 styles.css
 *   - App.jsx 在第2次 SubAgent 响应里重复输出，但因 writtenFiles 已有该路径，不会重复写入
 */
export const initProjectSubAgentLengthContinueCase: TestCase = {
  id: "init-project-subagent-length-continue",
  name: "SubAgent length 续写（beforeRequest 注入文件状态）",
  group: "init-project",
  priority: "P0",
  description:
    "SubAgent 第一次生成 App.jsx 后以 finishReason=length 结束，Agent 内部 loop 自动续写。验证 beforeRequest hook 在续写请求前注入了已写/待写文件列表，且重复输出的 App.jsx 不会被重复写入 FS。",
  expectedBehavior:
    "Request Inspector 第3次请求 messages 里出现「已写入: App.jsx / 待写入: styles.css」的 user 消息；FS Viewer 出现 App.jsx 和 styles.css；App.jsx 内容以最后一次输出为准（不重复写入）。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new MemFS([]))],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
      const idx = callIndex++;

      if (idx === 0) {
        const argsObj = { filesToGenerate: ["App.jsx", "styles.css"] };
        const argsStr = JSON.stringify(argsObj);
        await delay(200);
        params.emits.onToolCallStream?.({ index: 0, id: "call_init_length_continue", name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 8) {
          await delay(10);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 8) });
        }
        params.emits.onToolCalls?.([{ id: "call_init_length_continue", name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
        return;
      }

      if (idx === 1) {
        const content = "```App.jsx\nexport default function App() {\n  return <main className=\"app\">第一段</main>;\n}\n```";
        await delay(200);
        for (let i = 0; i < content.length; i += 16) {
          await delay(20);
          params.emits.write?.(content.slice(i, i + 16));
        }
        params.emits.onFinishReason?.("length");
        params.emits.complete?.("");
        return;
      }

      if (idx === 2) {
        const content =
          "```App.jsx\nexport default function App() {\n  return <main className=\"app\">第二段（续写重复）</main>;\n}\n```\n\n" +
          "```styles.css\n.app {\n  padding: 24px;\n  color: #222;\n}\n```";
        await delay(200);
        for (let i = 0; i < content.length; i += 16) {
          await delay(20);
          params.emits.write?.(content.slice(i, i + 16));
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      await delay(200);
      params.emits.write?.("SubAgent length 续写完成，App.jsx 和 styles.css 已全部写入。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};

/**
 * P0 测试用例：同一 turn 内第3次调用 init-project 时提示注意是否继续生成
 *
 * 背景：
 *   当同一 turn 内 init-project 被调用 ≥3 次时，tool output 末尾会追加
 *   「本轮生成内容较多，请注意是否继续生成」提示，避免无限循环生成。
 *
 * 流程：
 *   1~6. 外层 Agent 三次调用 init-project，每次 SubAgent 各生成一个文件
 *   7. 外层 Agent 第4次请求 → 返回 content（不再继续生成）
 *
 * 验证要点：
 *   - FS Viewer 出现 step-one.jsx / step-two.jsx / step-three.jsx
 *   - 第3个 init-project tool 卡片 output 包含「本轮生成内容较多，请注意是否继续生成」
 */
export const initProjectThirdCallWarnLargeCase: TestCase = {
  id: "init-project-third-call-warn-large",
  name: "第3次 init-project 提醒内容过大",
  group: "init-project",
  priority: "P0",
  description:
    "同一 turn 内连续调用 init-project 3次。验证第3次 tool output 在告知生成内容之外，额外提示「本轮生成内容较多，请注意是否继续生成」。",
  expectedBehavior:
    "FS Viewer 出现 step-one.jsx / step-two.jsx / step-three.jsx；第3个 init-project tool 卡片 output 包含「已写入文件」和「本轮生成内容较多，请注意是否继续生成」。",
  initialTurns: [],
  initialFiles: [],
  tools: [createInitProjectTool(new MemFS([]))],
  agentOptions: { retry: { maxRetries: 0 } },
  request: (() => {
    let callIndex = 0;
    return async (params: Parameters<import("@request/types").RequestAsStreamFn>[0]) => {
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const idx = callIndex++;

      const emitToolCall = async (callId: string, filesToGenerate: string[]) => {
        await delay(200);
        const argsObj = { filesToGenerate };
        const argsStr = JSON.stringify(argsObj);
        params.emits.onToolCallStream?.({ index: 0, id: callId, name: INIT_PROJECT_TOOL_NAME, argsChunk: "" });
        for (let i = 0; i < argsStr.length; i += 8) {
          await delay(10);
          params.emits.onToolCallStream?.({ index: 0, argsChunk: argsStr.slice(i, i + 8) });
        }
        params.emits.onToolCalls?.([{ id: callId, name: INIT_PROJECT_TOOL_NAME, args: argsObj }]);
        params.emits.onFinishReason?.("tool_calls");
        params.emits.complete?.("");
      };

      const emitFileContent = async (path: string, title: string) => {
        await delay(200);
        const content = `\`\`\`${path}\nexport default function ${title}() {\n  return <div>${title}</div>;\n}\n\`\`\``;
        for (let i = 0; i < content.length; i += 20) {
          await delay(20);
          params.emits.write?.(content.slice(i, i + 20));
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
      };

      if (idx === 0) { await emitToolCall("call_init_large_1", ["step-one.jsx"]); return; }
      if (idx === 1) { await emitFileContent("step-one.jsx", "StepOne"); return; }
      if (idx === 2) { await emitToolCall("call_init_large_2", ["step-two.jsx"]); return; }
      if (idx === 3) { await emitFileContent("step-two.jsx", "StepTwo"); return; }
      if (idx === 4) { await emitToolCall("call_init_large_3", ["step-three.jsx"]); return; }
      if (idx === 5) { await emitFileContent("step-three.jsx", "StepThree"); return; }

      await delay(200);
      params.emits.write?.("已完成三段初始化生成，注意到生成内容已很大，将停止继续生成。");
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
    };
  })(),
};
