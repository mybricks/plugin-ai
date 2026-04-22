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

function makeSummaryAwareRequest(): TestCase["request"] {
  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isSummaryFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("IMPORTANT: 不要调用工具");

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

    // 正常回复（延迟 300ms 模拟真实响应）
    await new Promise(r => setTimeout(r, 300));
    const userCount = msgs.filter((m: any) => m.role === "user").length;
    const reply = `这是第 ${userCount} 条消息的回复，turn 结束后会异步生成摘要。`;
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
  description: "summary.enabled=true，每轮 turn 结束后异步 fork 生成 <summary> 和 <handoff>，写入 TurnRecord。summary fork 延迟 1 秒，可在 Inspector 的 turn 详情里看到 summary 字段。",
  expectedBehavior: "发送消息后主 Agent 正常回复，约 1 秒后 Inspector 中当前 turn 的 summary 字段出现摘要内容（需刷新或切换查看）。控制台无报错。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
  ]),
  request: makeSummaryAwareRequest(),
  summaryOptions: { enabled: true },
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
