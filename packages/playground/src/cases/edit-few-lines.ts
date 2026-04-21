import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * edit_file 行数警告测试场景。
 * 
 * 场景：LLM 使用少于 3 行的 old_str 进行编辑（文件本身超过 3 行）。
 * 
 * 预期行为：
 * - 工具执行成功
 * - 输出包含警告："注意：当前 old_str 只有 X 行，行数较少（推荐3行及以上），请确保修改内容准确，避免误操作周围其他代码。"
 */

const initialFiles = [
  {
    path: "src/config.ts",
    content: `export const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
  retries: 3,
  debug: false,
};

export function getConfig() {
  return config;
}
`,
  },
];

const editFewLinesRequest = makeScriptedRequest([
  {
    type: "tool_calls",
    calls: [
      {
        id: "edit_few_lines",
        name: "edit_file",
        args: {
          path: "src/config.ts",
          old_str: "  timeout: 5000,",
          new_str: "  timeout: 10000,",
        },
      },
    ],
    delayMs: 300,
  },
  {
    type: "content",
    chunks: ["已将 timeout 从 5000 改为 10000。"],
    ttftMs: 200,
    chunkDelayMs: 50,
  },
]);

export const editFewLinesCase: TestCase = {
  id: "edit-few-lines-warning",
  name: "edit_file 行数警告",
  group: "工具调用",
  description:
    "LLM 使用少于 3 行的 old_str 编辑文件（文件超过 3 行），工具返回包含行数警告。",
  expectedBehavior:
    "工具卡片显示成功，但输出包含警告提示：old_str 只有 1 行，推荐 3 行及以上。",
  initialFiles,
  initialTurns: [],
  request: editFewLinesRequest,
};
