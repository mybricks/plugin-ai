import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * edit_file doom loop 测试场景。
 * 
 * 场景 1：LLM 连续 3 次尝试用同一个不存在的 old_str 编辑同一文件。
 * 每次工具执行失败，LLM 收到错误后继续尝试相同的编辑。
 * 第 3 次失败后，第 4 次 LLM 还想调用相同工具+参数，此时触发 doomloop。
 * 
 * 预期行为：
 * - 第 1 次失败：错误消息 "old_str 未找到，已连续失败 1 次，请先通过 read_file 读取..."
 * - 第 2 次失败：错误消息 "同一 old_str 已连续失败 2 次，请先通过 read_file..."
 * - 第 3 次失败：错误消息 "同一 old_str 已连续失败 3 次，再次编辑会造成重大失误，必须改用 write_file..."
 * - 第 4 次调用前检测到 history 中已有 3 次连续相同调用，触发 doomloop，不执行工具
 * 
 * 场景 2：LLM 连续 3 次尝试编辑同一文件失败，但第 4 次换参数了。
 * 第 4 次调用不同的 old_str，不触发 doomloop，继续正常执行。
 */

const initialFiles = [
  {
    path: "src/utils.ts",
    content: `export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`,
  },
];

// 不存在的 old_str，用于触发失败
const NONEXISTENT_OLD_STR = "export function multiply(a: number, b: number): number {\n  return a * b;\n}";

// 存在的 old_str，用于场景 2 的第 4 次调用
const EXISTING_OLD_STR = "export function add(a: number, b: number): number {\n  return a + b;\n}";

// 场景 1: 连续 4 次相同的编辑调用，第 4 次触发 doomloop
// 使用 loop: true 让它永远返回相同的 tool_call
const editDoomRequest = makeScriptedRequest(
  [
    {
      type: "tool_calls",
      calls: [
        {
          id: "edit_doom",
          name: "edit_file",
          args: {
            path: "src/utils.ts",
            old_str: NONEXISTENT_OLD_STR,
            new_str: "// multiply function removed",
          },
        },
      ],
      delayMs: 300,
    },
  ],
  { loop: true }
);

// 场景 2: 前 3 次相同失败，第 4 次换参数成功
// 不使用 loop，显式列出 4 次调用，前 3 次相同，第 4 次不同
const editNoDoomRequest = makeScriptedRequest(
  [
    // 第 1 次：不存在的 old_str → 失败
    {
      type: "tool_calls",
      calls: [
        {
          id: "edit_nodoom_1",
          name: "edit_file",
          args: {
            path: "src/utils.ts",
            old_str: NONEXISTENT_OLD_STR,
            new_str: "// multiply function removed",
          },
        },
      ],
      delayMs: 300,
    },
    // 第 2 次：相同的 old_str → 失败
    {
      type: "tool_calls",
      calls: [
        {
          id: "edit_nodoom_2",
          name: "edit_file",
          args: {
            path: "src/utils.ts",
            old_str: NONEXISTENT_OLD_STR,
            new_str: "// multiply function removed",
          },
        },
      ],
      delayMs: 300,
    },
    // 第 3 次：相同的 old_str → 失败
    {
      type: "tool_calls",
      calls: [
        {
          id: "edit_nodoom_3",
          name: "edit_file",
          args: {
            path: "src/utils.ts",
            old_str: NONEXISTENT_OLD_STR,
            new_str: "// multiply function removed",
          },
        },
      ],
      delayMs: 300,
    },
    // 第 4 次：换了一个存在的 old_str → 成功，不触发 doomloop
    {
      type: "tool_calls",
      calls: [
        {
          id: "edit_nodoom_4",
          name: "edit_file",
          args: {
            path: "src/utils.ts",
            old_str: EXISTING_OLD_STR,
            new_str: "// add function removed",
          },
        },
      ],
      delayMs: 300,
    },
    // 第 5 次及以后：返回文本结束
    {
      type: "content",
      chunks: ["好的，", "我已经成功编辑了文件。", "add 函数已被移除。"],
      ttftMs: 300,
      chunkDelayMs: 60,
    },
  ],
  { loop: true }
);

export const editDoomLoopCase: TestCase = {
  id: "edit-doom-loop",
  name: "edit_file Doom Loop（连续 4 次相同）",
  group: "Doom Loop",
  description:
    "LLM 连续 4 次尝试用同一个不存在的 old_str 编辑同一文件。前 3 次执行并失败，第 4 次触发 doomloop。",
  expectedBehavior:
    "第 1-3 次工具执行失败，错误消息递进变化；第 4 次 LLM 返回相同 tool_call 时触发 doomloop，不执行工具，turn 以 error 结束。",
  initialFiles,
  initialTurns: [],
  request: editDoomRequest,
};

export const editNoDoomLoopCase: TestCase = {
  id: "edit-no-doom-loop",
  name: "edit_file 不触发 Doom Loop（第 4 次换参数）",
  group: "Doom Loop",
  description:
    "LLM 连续 3 次尝试用同一个不存在的 old_str 编辑失败，第 4 次换了一个存在的 old_str，不触发 doomloop。",
  expectedBehavior:
    "前 3 次工具执行失败；第 4 次 LLM 返回不同的 old_str（存在的 'add' 函数），不触发 doomloop，工具正常执行成功。",
  initialFiles,
  initialTurns: [],
  request: editNoDoomRequest,
};
