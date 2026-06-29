import type { TestCase } from "./types";
import { makeTextHistory } from "../lib/fixtures";

/**
 * AutoSummary case。
 *
 * summary.enabled=true 时，每轮 turn 结束后 Agent 会异步 fork 一个子 Agent，
 * 对本轮对话生成 <summary> 和 <handoff> 两份摘要，写入 TurnRecord。
 *
 * mock request 需要能识别 summary fork 的请求（末尾 user message 以 "IMPORTANT: 不要调用工具" 开头），
 * 并返回合法的 <summary>...</summary> 和 <handoff>...</handoff> 内容。
 */

const SUMMARY_RESPONSE = `<summary>
用户发送了一条测试消息，Agent 正常回复。
1. 演示了 autoSummary 功能的触发流程；
2. summary fork 在 turn 结束后异步生成摘要并写入 TurnRecord。
</summary>

<handoff>
## 目标

验证 autoSummary 机制是否正常触发并写入摘要。

## 重要指示

- 这是一个 playground 测试用例，用于验证 summary fork 的行为

## 关键发现

autoSummary fork 使用 turnsSlice: { from: "end", count: 1 } 只看最后一轮对话。

## 完成情况

已完成：验证 summary fork 触发并返回摘要内容。

## 相关文件

packages/agent/src/agent.ts（_runAutoSummary 方法）
</handoff>`;

const SUGGESTIONS_RESPONSE = `<summary>
本轮读取了 App.tsx 并给出初步分析。
1. 调用了 read_file 工具读取文件内容；
2. Agent 已完成主回复，但还可以继续做验证或改动。
</summary>

<handoff>
## 目标

验证 autoSummary 生成 suggestions 后，ChatPanel 能在最后一条消息展示建议选项。

## 重要指示

- 这是 playground P0 测试用例，用于验证 suggestions 展示和点击入口

## 关键发现

suggestions 通过 turn:suggestions 事件异步写入当前 MessageRecord。

## 完成情况

已完成：主 turn 有工具调用并成功结束；summary fork 返回 <ask> 建议块。

## 相关文件

packages/agent/src/agent.ts（_runAutoSummary 方法）
packages/plugin/src/ui/chat/messages/index.tsx（SuggestionsBlock）
</handoff>

<ask>
  <desc>本轮已经读取并分析了文件，可以选择继续验证或直接推进修改。</desc>
  <option>继续检查相关文件并给出改动建议</option>
  <option>运行一次构建验证当前状态</option>
  <option>基于刚才的分析直接修改 App.tsx</option>
</ask>`;

function makeSummaryAwareRequest(): TestCase["request"] {
  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isSummaryFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("IMPORTANT: 不要调用工具");
    const hasReadResult = msgs.some(
      (m: any) =>
        m.role === "tool" &&
        typeof m.content === "string" &&
        m.content.includes("src/App.tsx")
    );

    if (isSummaryFork) {
      // 模拟 summary 生成延迟 1 秒
      await new Promise(r => setTimeout(r, 1000));
      for (const chunk of SUMMARY_RESPONSE.match(/.{1,30}/g) ?? []) {
        await new Promise(r => setTimeout(r, 20));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    if (!hasReadResult) {
      await new Promise(r => setTimeout(r, 300));
      params.emits.onToolCallStream?.({
        index: 0,
        id: "c_summary_read_1",
        name: "read_file",
        argsChunk: "",
      });
      params.emits.onToolCalls?.([
        { id: "c_summary_read_1", name: "read_file", args: { path: "src/App.tsx" } },
      ]);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }

    // 工具调用后的正常回复（延迟 300ms 模拟真实响应）
    await new Promise(r => setTimeout(r, 300));
    const userCount = msgs.filter((m: any) => m.role === "user").length;
    const reply = `这是第 ${userCount} 条消息的回复，已读取 src/App.tsx，turn 结束后会异步生成摘要。`;
    for (const chunk of reply.match(/.{1,10}/g) ?? []) {
      await new Promise(r => setTimeout(r, 25));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}

/** autoSummary 正常触发（turn 结束后异步生成 summary + handoff） */
export const summaryBasicCase: TestCase = {
  id: "summary-basic",
  name: "autoSummary 正常触发",
  group: "Summary",
  priority: "P0",
  description: "summary.enabled=true，主 turn 先调用 read_file，再正常回复；turn 结束后异步 fork 生成 <summary> 和 <handoff>，写入 TurnRecord。",
  expectedBehavior: "发送消息后先看到 read_file 工具卡片和主回复；约 1 秒后 Request Inspector 出现 summary fork 请求，当前 turn 写入 summary / handoff。控制台无报错。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
  ]),
  request: makeSummaryAwareRequest(),
  summaryOptions: { enabled: true, suggestions: false },
};

/** autoSummary fork 返回空内容（静默失败，不影响主流程） */
export const summaryEmptyResponseCase: TestCase = {
  id: "summary-empty-response",
  name: "autoSummary 空返回（静默失败）",
  group: "Summary",
  description: "summary fork 返回空字符串，autoSummary 静默忽略，turn 正常完成，TurnRecord.summary 为空。",
  expectedBehavior: "发送消息后主 Agent 正常回复，summary fork 静默失败（控制台无错误），Inspector 中 summary 字段为空。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！" },
  ]),
  request: (async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isSummaryFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("IMPORTANT: 不要调用工具");

    await new Promise(r => setTimeout(r, 500));

    if (isSummaryFork) {
      // 直接空返回
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 25));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  }) as TestCase["request"],
  summaryOptions: { enabled: true },
};

/** suggestions 展示（summary fork 返回 <ask>，ChatPanel 渲染可点击选项） */
export const suggestionsDisplayCase: TestCase = {
  id: "suggestions-display",
  name: "suggestions 展示",
  group: "Summary",
  priority: "P0",
  description:
    "主 turn 先调用 read_file，再正常回复；turn 完成后 summary fork 返回 <summary>、<handoff> 和 <ask>，用于验证最后一条消息下方展示建议选项。",
  expectedBehavior:
    "发送消息后先看到 read_file 工具卡片和主回复；约 800ms 后最后一条消息下方出现说明文案和 3 个建议按钮，点击任一按钮会作为下一轮用户消息发送。",
  initialTurns: makeTextHistory([
    { user: "先看看 App.tsx", assistant: "可以，我会先读取文件。" },
  ]),
  request: async (params: any) => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isSummaryFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("IMPORTANT: 不要调用工具");

    if (isSummaryFork) {
      await delay(800);
      for (const chunk of SUGGESTIONS_RESPONSE.match(/.{1,35}/g) ?? []) {
        await delay(15);
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    const hasReadResult = msgs.some(
      (m: any) =>
        m.role === "tool" &&
        typeof m.content === "string" &&
        m.content.includes("App")
    );

    if (!hasReadResult) {
      await delay(300);
      params.emits.onToolCallStream?.({
        index: 0,
        id: "c_suggestion_read_1",
        name: "read_file",
        argsChunk: "",
      });
      params.emits.onToolCalls?.([
        { id: "c_suggestion_read_1", name: "read_file", args: { path: "src/App.tsx" } },
      ]);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.complete?.("");
      return;
    }

    const reply = "我已经读取了 App.tsx，并完成了初步检查。这个场景会在 turn 完成后异步展示 suggestions。";
    for (const chunk of reply.match(/.{1,12}/g) ?? []) {
      await delay(25);
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  },
  summaryOptions: { enabled: true, suggestions: true },
};
