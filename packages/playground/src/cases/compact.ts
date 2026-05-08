import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory, makeTextHistoryWithUsage } from "../lib/fixtures";

/**
 * Compact case。
 *
 * compact 触发条件：compact 游标之后的上下文轮次 > maxTurns（默认 15），
 * 或最新 usage.promptTokens 超过阈值。
 * 为方便测试，case 里设 maxTurns: 2，预设 2 轮历史，
 * 再发一条消息就满足 context turns > 2，触发 compact。
 *
 * compact 触发后，Agent 内部 fork 一个 Agent 调用 requestAI，
 * mock request 需要能响应这个 compact 摘要请求。
 * 使用 loop: true 确保多轮调用都能得到响应。
 *
 * compact 摘要请求的 user message 以 "请对上方完整的对话历史进行总结" 开头，
 * 我们直接在 mock 里返回合法的 <compact>...</compact> 内容。
 */

const COMPACT_RESPONSE_CONTENT = `<compact>
整体目标：测试 compact 触发流程。
已完成操作：
1. 用户发送了多条测试消息，历史超过阈值
2. Agent 触发 compact，fork 生成摘要
当前状态：compact 摘要已生成并存入 compactRecord，后续 buildMessages 时会用摘要替代历史消息。
</compact>`;

const COMPACT_RETRY_HISTORY = makeTextHistory(
  Array.from({ length: 8 }, (_, i) => ({
    user: `历史消息 ${i + 1}`,
    assistant: `历史回复 ${i + 1}`,
  }))
);

/**
 * mock request 逻辑：
 *  - 如果 messages 里最后一条 user content 包含"请对上方完整的对话历史进行总结"
 *    → 这是 compact fork 发出的请求，返回 compact 摘要
 *  - 否则正常返回 content 回复
 */
function makeCompactAwareRequest(maxTurnsForTest: number): TestCase["request"] {
  // 每次请求 index（用于区分是主 Agent 请求还是 compact fork 请求）
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    await new Promise(r => setTimeout(r, 400));

    if (isCompactFork) {
      // 返回 compact 摘要
      for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 20));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    // 正常回复
    const reply = `这是第 ${msgs.filter((m: any) => m.role === "user").length} 条用户消息的回复。`;
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}

/** 触发 compact 的最小 case（maxTurns=2，预设 2 轮历史，第 3 条消息触发） */
export const compactTriggerCase: TestCase = {
  id: "compact-trigger",
  name: "compact 触发（maxTurns=2）",
  group: "Compact",
  description: "预设 2 轮历史，maxTurns=2，发第 3 条消息后上下文轮次 > 2，触发 compact。compact fork 会额外发起一次 requestAI 请求。",
  expectedBehavior: "Inspector 里会出现额外的 Step（compact fork 请求），其 messages 末尾是摘要 prompt。主 Agent 继续正常回复。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
    { user: "帮我读一下 App.tsx", assistant: "好的，我来读取 App.tsx 文件。" },
  ]),
  request: makeCompactAwareRequest(2),
  compactOptions: { enabled: true, maxTurns: 2 },
  maskOptions: {}, // 不触发 mask
};

/** 带工具调用的 compact（验证 compact 不影响工具流程） */
export const compactWithToolsCase: TestCase = {
  id: "compact-with-tools",
  name: "compact 后置触发（工具调用超阈值）",
  group: "Compact",
  description: "工具调用完成后 usage 超过阈值（170000 > 167000），触发后置 compact。",
  expectedBehavior: "工具卡片正常，turn 结束后触发后置 compact fork（Inspector 可见），下次启动时控制台日志显示占比骤降。",
  initialTurns: makeTextHistory([
    { user: "初始化项目", assistant: "已完成初始化。" },
    { user: "添加一个工具函数", assistant: "好的，我来添加。" },
  ]),
  request: (() => {
    let callCount = 0;
    return async (params: Parameters<TestCase["request"]>[0]) => {      const msgs = params.messages ?? [];
      const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
      const isCompactFork =
        typeof lastUserMsg?.content === "string" &&
        lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

      await new Promise(r => setTimeout(r, 300));

      if (isCompactFork) {
        for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
          await new Promise(r => setTimeout(r, 15));
          params.emits.write(chunk);
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }

      callCount++;
      // 奇数次：tool_calls；偶数次：content
      if (callCount % 2 === 1) {
        params.emits.onToolCallStream?.({ index: 0, id: `c_w_${callCount}`, name: "write_file", argsChunk: "" });
        const args = JSON.stringify({ path: "src/utils.ts", content: `export function util${callCount}() { return ${callCount}; }` });
        for (let i = 0; i < args.length; i += 5) {
          await new Promise(r => setTimeout(r, 15));
          params.emits.onToolCallStream?.({ index: 0, argsChunk: args.slice(i, i + 5) });
        }
        params.emits.onToolCalls?.([{ id: `c_w_${callCount}`, name: "write_file", args: JSON.parse(args) }]);
        params.emits.onFinishReason?.("tool_calls");
        // 工具调用后 usage 超过阈值，触发后置 compact
        params.emits.onUsage?.({ promptTokens: 170000, completionTokens: 200, totalTokens: 170200 });
        params.emits.complete?.("");
      } else {
        const reply = "文件已更新。";
        for (const chunk of reply.match(/.{1,4}/g) ?? []) {
          await new Promise(r => setTimeout(r, 30));
          params.emits.write(chunk);
        }
        params.emits.onFinishReason?.("stop");
        // 最后一轮回复后 usage 仍然超过阈值（compact 尚未完成，还不会降）
        params.emits.onUsage?.({ promptTokens: 175000, completionTokens: 50, totalTokens: 175050 });
        params.emits.complete?.("");
      }
    };
  })(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

// ─── Usage 阈值触发 warmup ─────────────────────────────────────────────────────

/**
 * usage 很大时触发 compact，启动时 Agent 插入 WarmupIter 并 emit warmup:start。
 * contextWindow 默认 200k，阈值 = 200k - 20k - 13k = 167000。
 * 当 usage.promptTokens >= 167000 时触发。
 * 
 * 为了能看到 warmup 效果，compact 响应延迟 2 秒。
 */
export const compactWarmupByUsageCase: TestCase = {
  id: "compact-warmup-usage",
  name: "compact 前置 warmup（usage 超阈值）",
  group: "Compact",
  description: "预设历史 usage.promptTokens = 170000（超过阈值 167000），发消息时触发 warmup:start -> compact -> warmup:complete，UI 显示 WarmupIter。",
  expectedBehavior: "发送消息后，消息气泡内出现 WarmupIter（'启动中...' shimmer + 计时），compact fork 完成（约 2 秒）后 WarmupIter 变为 '启动成功'，主 Agent 正常回复。",
  initialTurns: makeTextHistoryWithUsage([
    { user: "你好", assistant: "你好！有什么可以帮你的？", usage: { promptTokens: 50000, completionTokens: 1000 } },
    { user: "帮我读一下文件", assistant: "好的，文件内容如下...", usage: { promptTokens: 100000, completionTokens: 2000 } },
    { user: "继续分析", assistant: "分析结果如下...", usage: { promptTokens: 170000, completionTokens: 3000 } },
  ]),
  request: makeCompactWarmupRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

// ─── Compact 接口报错 ─────────────────────────────────────────────────────────

/**
 * compact fork 请求返回错误的例子。
 * 启用重试后会重试 3 次，每次都报错最终失败。
 */
export const compactErrorCase: TestCase = {
  id: "compact-error",
  name: "compact 接口报错（重试 3 次后失败）",
  group: "Compact",
  description: "compact fork 请求每次都返回 error 事件，重试 3 次后仍失败，WarmupIter 变为 error 态，触发 turn:error。",
  expectedBehavior: "发送消息后，WarmupIter 显示'启动中...'，compact fork 报错并触发 3 次重试（content 会更新为'正在尝试其他策略进行压缩，第 N 次重试…'），最终 WarmupIter 变为 error 态，底部显示错误'上下文压缩失败，请重试或者点击上方清空历史记录'。",
  initialTurns: COMPACT_RETRY_HISTORY,
  request: makeCompactErrorRequest(),
  compactOptions: { enabled: true, maxTurns: 1 },
};

/**
 * compact fork 请求返回空内容（无 <compact> 标签）的例子。
 * 启用重试后每次都没有标签，3 次重试后最终失败。
 */
export const compactEmptyResponseCase: TestCase = {
  id: "compact-empty-response",
  name: "compact 无有效返回（重试 3 次后失败）",
  group: "Compact",
  description: "compact fork 每次返回内容但不含 <compact> 标签，重试 3 次（保持相同历史轮数）后失败，WarmupIter 变为 error 态，触发 turn:error。",
  expectedBehavior: "发送消息后，WarmupIter 显示'启动中...'，compact fork 3 次均返回无效内容，content 更新显示重试进度，最终 WarmupIter 变为 error 态，底部显示错误'上下文压缩失败，请重试或者点击上方清空历史记录'。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
    { user: "帮我读一下 App.tsx", assistant: "好的，我来读取 App.tsx 文件。" },
  ]),
  request: makeCompactEmptyResponseRequest(),
  compactOptions: { enabled: true, maxTurns: 1 },
};

/**
 * compact fork 请求返回空字符串的例子。
 * 启用重试后每次都空返回，3 次二分缩减历史后仍失败。
 */
export const compactNoContentCase: TestCase = {
  id: "compact-no-content",
  name: "compact 无返回内容（重试 3 次后失败）",
  group: "Compact",
  description: "compact fork 每次直接返回空字符串，触发场景A重试（二分缩减历史轮数：8→4→2→1），3 次重试后仍失败，WarmupIter 变为 error 态，触发 turn:error。",
  expectedBehavior: "发送消息后，WarmupIter 显示'启动中...'，compact fork 4 次均空返回（初次 + 3 次重试），content 更新显示重试进度，最终 WarmupIter 变为 error 态，底部显示错误'上下文压缩失败，请重试或者点击上方清空历史记录'。",
  initialTurns: COMPACT_RETRY_HISTORY,
  request: makeCompactNoContentRequest(),
  compactOptions: { enabled: true, maxTurns: 1 },
};

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 专用于 warmup 测试的 request mock。
 * compact 响应延迟约 2 秒，方便观察 warmup loading → success 效果。
 */
function makeCompactWarmupRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      // 模拟 compact 响应延迟 2 秒
      await new Promise(r => setTimeout(r, 2000));
      for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 50));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    // 正常回复（compact 成功后上下文已压缩，usage 应低于阈值）
    const reply = "这是正常的回复内容。";
    await new Promise(r => setTimeout(r, 300));
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 20, totalTokens: 5020 });
    params.emits.complete?.("");
  };
}

/** 中途压缩报错并恢复的 mock request
 *
 * 调用时序：
 *   1. 主 Agent step=1 → write_file 工具调用 + usage 超阈值
 *   2. compact fork → 返回 compact 摘要
 *   3. 主 Agent step=2 → write_file 工具调用（成功）
 *   4. 主 Agent step=3（原始+重试）→ 全部 error（重试耗尽后 turn:error）
 *   5. 用户 retry → 主 Agent step=3 → 正常返回内容
 */
function makeCompactMidTurnErrorRetryRequest(): TestCase["request"] {
  let hasSeenStep1 = false;
  let hasSeenStep2 = false;
  let step3Attempts = 0;

  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    // ── compact fork 请求 ──
    if (isCompactFork) {
      await new Promise(r => setTimeout(r, 1500));
      for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 30));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    // ── step=1：write_file 工具调用 + usage 超阈值 ──
    if (!hasSeenStep1) {
      hasSeenStep1 = true;
      await new Promise(r => setTimeout(r, 300));
      params.emits.onToolCallStream?.({ index: 0, id: "call_mid_1", name: "write_file", argsChunk: "" });
      const args = JSON.stringify({
        path: "src/utils.ts",
        content: "export function midTurnTest() { return 'success'; }",
      });
      for (let i = 0; i < args.length; i += 4) {
        await new Promise(r => setTimeout(r, 15));
        params.emits.onToolCallStream?.({ index: 0, argsChunk: args.slice(i, i + 4) });
      }
      params.emits.onToolCalls?.([{ id: "call_mid_1", name: "write_file", args: JSON.parse(args) }]);
      params.emits.onFinishReason?.("tool_calls");
      // usage 超阈值，step=2 之前将触发 warmup/compact
      params.emits.onUsage?.({ promptTokens: 170000, completionTokens: 200, totalTokens: 170200 });
      params.emits.complete?.("");
      return;
    }

    // ── step=2（compact 之后）：再写一个文件，成功 ──
    if (!hasSeenStep2) {
      hasSeenStep2 = true;
      await new Promise(r => setTimeout(r, 300));
      params.emits.onToolCallStream?.({ index: 0, id: "call_mid_2", name: "write_file", argsChunk: "" });
      const args2 = JSON.stringify({
        path: "src/helper.ts",
        content: "export function helper() { return 'helper'; }",
      });
      for (let i = 0; i < args2.length; i += 4) {
        await new Promise(r => setTimeout(r, 15));
        params.emits.onToolCallStream?.({ index: 0, argsChunk: args2.slice(i, i + 4) });
      }
      params.emits.onToolCalls?.([{ id: "call_mid_2", name: "write_file", args: JSON.parse(args2) }]);
      params.emits.onFinishReason?.("tool_calls");
      params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 100, totalTokens: 5100 });
      params.emits.complete?.("");
      return;
    }

    // ── step=3：第二个工具完成后，LLM 请求报错（含重试），turn:error ──
    if (step3Attempts < 3) {
      step3Attempts++;
      await new Promise(r => setTimeout(r, 200));
      params.emits.error?.(new Error(`Request failed: 503 Service Unavailable (step=3 attempt ${step3Attempts})`));
      return;
    }

    // ── 用户 retry 后的 step=3：正常返回内容 ──
    await new Promise(r => setTimeout(r, 400));
    const reply = "两个文件均已成功写入，操作完成！";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 50, totalTokens: 5050 });
    params.emits.complete?.("");
  };
}

/** 生成 compact 错误请求的 mock */
function makeCompactErrorRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      // 每次尝试延迟 1.5 秒，让重试进度可见
      await new Promise(r => setTimeout(r, 1500));
      params.emits.error?.(new Error("compact request failed: API rate limit exceeded"));
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}

/** 生成 compact 返回无效内容的 mock */
function makeCompactEmptyResponseRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      // 每次尝试延迟 1.5 秒，让重试进度可见
      await new Promise(r => setTimeout(r, 1500));
      const invalidContent = "这是摘要内容，但没有正确的标签包裹。";
      for (const chunk of invalidContent.match(/.{1,10}/g) ?? []) {
        await new Promise(r => setTimeout(r, 20));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}

/** 生成 compact 返回空字符串的 mock */
function makeCompactNoContentRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      // 每次尝试延迟 1.5 秒，让重试进度可见
      await new Promise(r => setTimeout(r, 1500));
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}

/**
 * 前置 compact 无限延迟（用于测试取消效果）
 * compact fork 请求永远不结束，用户可以测试取消按钮的效果。
 */
export const compactInfiniteCase: TestCase = {
  id: "compact-infinite",
  name: "compact 无限延迟（测试取消）",
  group: "Compact",
  description: "前置 compact warmup 触发后，compact fork 请求永远不结束，WarmupIter 一直显示 '启动中...'，可测试取消效果。",
  expectedBehavior: "发送消息后，WarmupIter 显示 '启动中...' shimmer，compact fork 请求永不结束，用户点击取消按钮可中断请求。",
  initialTurns: makeTextHistoryWithUsage([
    { user: "你好", assistant: "你好！有什么可以帮你的？", usage: { promptTokens: 50000, completionTokens: 1000 } },
    { user: "帮我读一下文件", assistant: "好的，文件内容如下...", usage: { promptTokens: 100000, completionTokens: 2000 } },
    { user: "继续分析", assistant: "分析结果如下...", usage: { promptTokens: 170000, completionTokens: 3000 } },
  ]),
  request: makeCompactInfiniteRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

/**
 * compact 前两次接口报错，第三次成功（场景A 重试后成功）。
 * 模拟 token 超限后 compact fork 二分缩减历史最终成功的场景。
 */
export const compactRetrySuccessErrorCase: TestCase = {
  id: "compact-retry-success-error",
  name: "compact 接口报错 → 重试后成功",
  group: "Compact",
  description: "compact fork 前 2 次请求报错，第 3 次缩小上下文后成功返回摘要。WarmupIter content 会更新重试进度。",
  expectedBehavior: "WarmupIter 显示'启动中...'后两次更新为'正在尝试其他策略进行压缩，第 N 次重试…'，第 3 次成功后变为 success，主 Agent 正常回复。",
  initialTurns: makeTextHistoryWithUsage([
    { user: "你好", assistant: "你好！有什么可以帮你的？", usage: { promptTokens: 50000, completionTokens: 1000 } },
    { user: "帮我读一下文件", assistant: "好的，文件内容如下...", usage: { promptTokens: 100000, completionTokens: 2000 } },
    { user: "继续分析", assistant: "分析结果如下...", usage: { promptTokens: 170000, completionTokens: 3000 } },
  ]),
  request: makeCompactRetrySuccessErrorRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

/**
 * compact 前两次无标签，第三次成功（场景B 重试后成功）。
 * 模拟模型偶发不按格式返回，重试后恢复正常的场景。
 */
export const compactRetrySuccessTagCase: TestCase = {
  id: "compact-retry-success-tag",
  name: "compact 无标签返回 → 重试后成功",
  group: "Compact",
  description: "compact fork 前 2 次返回无 <compact> 标签的内容，第 3 次成功返回合法摘要。WarmupIter content 会更新重试进度。",
  expectedBehavior: "WarmupIter 两次更新'正在尝试其他策略进行压缩，第 N 次重试…'，第 3 次成功，WarmupIter 变为 success，主 Agent 正常回复。",
  initialTurns: makeTextHistoryWithUsage([
    { user: "你好", assistant: "你好！有什么可以帮你的？", usage: { promptTokens: 50000, completionTokens: 1000 } },
    { user: "帮我读一下文件", assistant: "好的，文件内容如下...", usage: { promptTokens: 100000, completionTokens: 2000 } },
    { user: "继续分析", assistant: "分析结果如下...", usage: { promptTokens: 170000, completionTokens: 3000 } },
  ]),
  request: makeCompactRetrySuccessTagRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

/**
 * compact 全量失败后缩小，缩小成功后继续向右扩大，最终写入最大成功范围。
 * 4 条历史：第 1 次全量失败，第 2 次半量成功，第 3 次扩大到 3/4 成功。
 */
export const compactBinaryExpandSuccessCase: TestCase = {
  id: "compact-binary-expand-success",
  name: "compact 二分扩大成功范围",
  group: "Compact",
  description: "compact fork 按实际历史轮次数判断：4 轮全量失败，2 轮成功，随后扩大到 3 轮成功，用于验证不会在半量成功后立即停止。",
  expectedBehavior: "Inspector 中 compact fork 应出现 3 次请求，历史用户消息数依次为 4、2、3；最终 compact 内容写入第 3 次的最大成功结果，主 Agent 正常回复。",
  initialTurns: makeTextHistoryWithUsage([
    { user: "历史 1", assistant: "回复 1", usage: { promptTokens: 50000, completionTokens: 1000 } },
    { user: "历史 2", assistant: "回复 2", usage: { promptTokens: 80000, completionTokens: 1000 } },
    { user: "历史 3", assistant: "回复 3", usage: { promptTokens: 120000, completionTokens: 1000 } },
    { user: "历史 4", assistant: "回复 4", usage: { promptTokens: 170000, completionTokens: 1000 } },
  ]),
  request: makeCompactBinaryExpandSuccessRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

// ─── 中途压缩报错并恢复 ──────────────────────────────────────────────────────

/**
 * 中途压缩报错并恢复：
 *
 * 流程：
 *   1. 第 1 步 LLM 返回 write_file 工具调用，工具执行成功
 *      → usage.promptTokens = 170000（超过阈值 167000）
 *   2. 第 2 步 llm:start 之前触发 warmup/compact → compact 成功
 *   3. 第 2 步 LLM 请求报错，自动重试也失败（maxRetries=2）
 *      → turn:error，底部显示重试按钮
 *   4. 用户点击重试，从 step=2 续跑
 *      → compact 已完成不再触发
 *      → LLM 正常返回内容，turn 成功结束
 */
export const compactMidTurnErrorRetryCase: TestCase = {
  id: "compact-mid-turn-error-retry",
  name: "中途压缩报错并恢复",
  group: "Compact",
  priority: "P0",
  description:
    "进来是空白状态，发消息后：第 1 步 write_file 成功，返回的 usage 超限 → 第 2 步之前触发 compact（WarmupIter），compact 成功后再写入第二个文件成功 → 第 3 步 LLM 请求失败（含重试），最终显示重试按钮。点击重试后从 step=3 续跑成功。",
  expectedBehavior:
    "发消息后先显示 write_file 工具卡片（src/utils.ts），然后 WarmupIter（compact），compact 成功后第二个 write_file 工具卡片（src/helper.ts），随后 LLM 报错进入 error 状态显示重试按钮。点击重试从 step=3 续跑成功返回内容。",
  initialTurns: [],
  request: makeCompactMidTurnErrorRetryRequest(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
  agentOptions: {
    retry: {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 500,
    },
  },
};

/** compact fork 前 2 次报错，第 3 次成功 */
function makeCompactRetrySuccessErrorRequest(): TestCase["request"] {
  let compactAttempt = 0;
  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      compactAttempt++;
      // 每次尝试延迟 1.5 秒，让重试进度可见
      await new Promise(r => setTimeout(r, 1500));
      if (compactAttempt <= 2) {
        // 前两次报错（场景A）
        params.emits.error?.(new Error(`compact request failed (attempt ${compactAttempt}): API rate limit`));
        return;
      }
      // 第三次成功
      for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 30));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "compact 重试成功后的正常回复。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 20, totalTokens: 5020 });
    params.emits.complete?.("");
  };
}

/** compact fork 前 2 次无标签，第 3 次成功 */
function makeCompactRetrySuccessTagRequest(): TestCase["request"] {
  let compactAttempt = 0;
  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      compactAttempt++;
      // 每次尝试延迟 1.5 秒，让重试进度可见
      await new Promise(r => setTimeout(r, 1500));
      if (compactAttempt <= 2) {
        // 前两次无标签（场景B）
        const invalid = `这是第 ${compactAttempt} 次摘要，但没有正确的标签包裹。`;
        for (const chunk of invalid.match(/.{1,10}/g) ?? []) {
          await new Promise(r => setTimeout(r, 20));
          params.emits.write(chunk);
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
        return;
      }
      // 第三次成功
      for (const chunk of COMPACT_RESPONSE_CONTENT.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 30));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "compact 重试成功后的正常回复。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 20, totalTokens: 5020 });
    params.emits.complete?.("");
  };
}

/** compact 根据实际历史轮次数决定失败/成功，用于验证二分收缩和成功后扩大范围 */
function makeCompactBinaryExpandSuccessRequest(): TestCase["request"] {
  let compactAttempt = 0;
  return async (params: any) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find((m: any) => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      compactAttempt++;
      const historyUserCount = msgs.filter((m: any) =>
        m.role === "user" &&
        typeof m.content === "string" &&
        m.content.startsWith("历史 ")
      ).length;
      await new Promise(r => setTimeout(r, 800));
      if (historyUserCount >= 4) {
        params.emits.error?.(new Error(`compact history count ${historyUserCount} failed: context too large`));
        return;
      }

      const compact = `<compact>
compact 第 ${compactAttempt} 次成功。
本次 compact fork 看到 ${historyUserCount} 条历史用户消息。
预期路径为 4 条失败、2 条成功、3 条成功。
</compact>`;
      for (const chunk of compact.match(/.{1,20}/g) ?? []) {
        await new Promise(r => setTimeout(r, 25));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    await new Promise(r => setTimeout(r, 300));
    const reply = "compact 二分扩大测试完成后的正常回复。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 20, totalTokens: 5020 });
    params.emits.complete?.("");
  };
}

/** 生成 compact 无限延迟的 mock（永不结束） */
function makeCompactInfiniteRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    if (isCompactFork) {
      // 模拟 compact 开始处理，但永不结束
      // 先发送一点内容让它看起来在处理中
      const prefix = "<compact>\n正在总结对话历史...";
      for (const chunk of prefix.match(/.{1,10}/g) ?? []) {
        await new Promise(r => setTimeout(r, 100));
        params.emits.write(chunk);
      }
      // 永远不调用 onFinishReason 或 complete，让请求挂着
      // 使用一个很长的循环来模拟无限等待
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await new Promise(r => setTimeout(r, 1000));
        // 每秒发送一个空格，保持连接活跃但不结束
        params.emits.write(" ");
      }
    }

    // 正常回复
    await new Promise(r => setTimeout(r, 300));
    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.onUsage?.({ promptTokens: 5000, completionTokens: 20, totalTokens: 5020 });
    params.emits.complete?.("");
  };
}
