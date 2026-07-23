import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * edit_file doom loop 测试场景。
 * 
 * 场景 1：LLM 持续用同一个不存在的 old_str 编辑同一文件。
 * 每次工具执行失败，LLM 收到错误后继续尝试相同的编辑序列。
 * 新版 agent 会在工具执行完成后，按每个 iter 的完整 tool_calls 序列检测 doom loop。
 * 
 * 预期行为：
 * - 前 3 次相同 edit_file 调用都会执行并失败，错误消息里的 Same old_str failed 次数递增
 * - 第 4 次相同 edit_file 调用仍会执行；执行完成后触发 doom loop，turn:error 结束
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

// 场景 1: 连续相同的编辑调用，第 4 次执行完成后触发 doom loop
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
  name: "edit_file Doom Loop（相同编辑序列）",
  group: "Doom Loop",
  description:
    "LLM 持续尝试用同一个不存在的 old_str 编辑同一文件，覆盖新版 agent 按 iter 工具序列检测 doom loop。",
  expectedBehavior:
    "前 3 次工具执行失败；第 4 次相同 edit_file 调用执行后触发 turn:doom，turn 以 error 结束并显示“连续调用，已自动中断”。",
  initialFiles,
  initialTurns: [],
  request: editDoomRequest,
};

export const editNoDoomLoopCase: TestCase = {
  id: "edit-no-doom-loop",
  name: "edit_file 不触发 Doom Loop（第 4 次换参数）",
  group: "Doom Loop",
  description:
    "LLM 连续 3 次尝试用同一个不存在的 old_str 编辑失败，第 4 次换成存在的 old_str，完整工具调用序列发生变化。",
  expectedBehavior:
    "前 3 次工具执行失败；第 4 次参数不同，不触发 doom loop，工具正常执行成功并进入最终文本回复。",
  initialFiles,
  initialTurns: [],
  request: editNoDoomRequest,
};
