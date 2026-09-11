import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * edit_file 行数警告测试场景。
 * 
 * 场景：LLM 使用少于 3 行的 old_str 进行编辑（文件本身超过 3 行）。
 * 
 * 预期行为：
 * - 工具执行成功
 * - 输出包含警告，并要求模型重新读取受影响文件核验修改。
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
    "工具卡片显示成功；output 包含短 old_str 警告，并要求重新读取受影响文件核验。",
  initialFiles,
  initialTurns: [],
  request: editFewLinesRequest,
};
