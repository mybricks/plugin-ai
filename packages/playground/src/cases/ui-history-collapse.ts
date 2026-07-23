import type { TestCase } from "./types";
import { makeTurn } from "../lib/fixtures";
import { makeScriptedRequest } from "../lib/scripted-request";

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

function makeHistoryTurn(
  index: number,
  iterCount: number,
  baseTime: number
): ReturnType<typeof makeTurn> {
  const startTime = baseTime + index * 4000;
  return makeTurn({
    userText: `历史消息 #${index + 1}：请帮我分析一下代码结构`,
    startTime,
    endTime: startTime + 3000,
    iterations: Array.from({ length: iterCount }, (_, i) => ({
      content: i === iterCount - 1
        ? `第 ${index + 1} 轮完成。这是第 ${i + 1} 个迭代的内容。`
        : undefined,
      toolCalls: i < iterCount - 1 ? [
        {
          name: "read_file",
          args: { path: `/src/module-${index + 1}-${i + 1}.ts` },
          result: `// module content ${index + 1}-${i + 1}`,
        },
      ] : [],
    })),
  });
}

const baseTime = Date.now() - 2 * 60 * 60 * 1000; // 2小时前

// 20 条历史，每条 3~5 iter，总 iter ≈ 80（超过默认阈值 50）
const longHistory = Array.from({ length: 20 }, (_, i) =>
  makeHistoryTurn(i, 3 + (i % 3), baseTime)
);

// 接近阈值的历史（约 45 iter），再多一条就会触发折叠
// 每条 3 iter，15 条 = 45 iter，再来 2 条（3 iter each）就超 50
const nearLimitHistory = Array.from({ length: 15 }, (_, i) =>
  makeHistoryTurn(i, 3, baseTime)
);

// ─── Cases ────────────────────────────────────────────────────────────────────

/**
 * P0 Case 1：从历史恢复 → 进来就折叠，展开操作
 *
 * 场景：用户打开一个已有 20 条历史的会话，历史 iter 总数超过阈值，
 * 进入后立即看到折叠条。验证展开上一轮 / 展开全部的交互。
 */
export const historyCollapseRestoreCase: TestCase = {
  id: "history-collapse-restore",
  name: "超长历史折叠（从历史恢复）",
  group: "UI 渲染",
  priority: "P0",
  description:
    "预设 20 条历史（总 iter 数 ≈ 80，超过默认阈值 50）。模拟用户重新打开会话的场景，进入后旧 turns 被自动折叠。",
  expectedBehavior:
    "进入后顶部出现「已折叠 N 轮历史对话」折叠条，只展示最近几轮。" +
    "点「展开上一轮」从最近的折叠 turn 开始逐条揭开；点「展开全部」一次展开所有折叠。" +
    "发新消息完成后，折叠边界重新计算，旧内容重新被折叠（即使刚才展开过）。",
  initialTurns: longHistory,
  request: makeScriptedRequest(
    [
      {
        type: "content",
        chunks: ["好的，根据历史记录我继续分析，这是新的一轮回复。"],
        ttftMs: 400,
        chunkDelayMs: 60,
      },
    ],
    { loop: true }
  ),
};

/**
 * P0 Case 2：对话中持续折叠（从接近阈值的状态开始）
 *
 * 场景：预设 15 条历史（约 45 iter，接近但未超过阈值）。
 * 用户发消息后，新 turn 加进来使 iter 总数超过阈值，触发首次折叠。
 * 继续发消息，折叠边界不断往后推移，旧内容持续被折叠，
 * 即使中途点了"展开上一轮"，下次发消息后仍重新折叠。
 */
export const historyCollapseGrowingCase: TestCase = {
  id: "history-collapse-growing",
  name: "超长历史折叠（对话中持续触发）",
  group: "UI 渲染",
  priority: "P0",
  description:
    "预设 15 条历史（约 45 iter，接近阈值 50）。每次发消息新增 3~4 个 iter，" +
    "累计超阈值后首次出现折叠条；之后每轮对话折叠边界后移，" +
    "即使中途「展开上一轮」，下一次发消息后也会重新折叠。",
  expectedBehavior:
    "初始不显示折叠条（45 iter < 50）。发第一条消息后（新增 3 iter，总计 48 仍不触发），" +
    "再发一条才触发折叠。持续发消息时折叠越来越多；" +
    "展开上一轮后再发消息完成，刚展开的内容重新进入折叠区。",
  initialTurns: nearLimitHistory,
  historyCollapse: { maxIters: 50 },
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          { id: "c_read", name: "read_file", args: { path: "src/index.ts" } },
          { id: "c_write", name: "write_file", args: { path: "src/index.ts", content: "// updated" } },
        ],
        delayMs: 300,
      },
      {
        type: "content",
        chunks: ["已完成修改，这是本轮回复。"],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: true }
  ),
};

/**
 * 辅助 Case：自定义 maxIters=10（低阈值，方便快速验证配置生效）
 */
export const historyCollapseCustomMaxItersCase: TestCase = {
  id: "history-collapse-custom-max-iters",
  name: "超长历史折叠（自定义 maxIters=10）",
  group: "UI 渲染",
  description:
    "通过 historyCollapse.maxIters=10 降低阈值，让更少的历史就触发折叠，验证外部配置生效。",
  expectedBehavior:
    "折叠触发更早，折叠条显示更多被折叠的 turns 数量。发新消息完成后重新折叠。",
  initialTurns: longHistory,
  historyCollapse: { maxIters: 10 },
  request: makeScriptedRequest(
    [
      {
        type: "content",
        chunks: ["（低阈值 maxIters=10 测试）这是新的回复。"],
        ttftMs: 300,
        chunkDelayMs: 60,
      },
    ],
    { loop: true }
  ),
};
