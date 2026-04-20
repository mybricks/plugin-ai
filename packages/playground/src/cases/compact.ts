import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory, makeTextHistoryWithUsage } from "../lib/fixtures";

/**
 * Compact case。
 *
 * compact 触发条件：successTurns.length > maxTurns（默认 30）。
 * 为方便测试，case 里设 maxTurns: 2，预设 2 轮历史，
 * 再发一条消息就满足 successTurns > 2，触发 compact。
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
  description: "预设 2 轮历史，maxTurns=2，发第 3 条消息后 successTurns > 2，触发 compact。compact fork 会额外发起一次 requestAI 请求。",
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
        // 最后一轮回复后 usage 降回正常（compact 已在上一步触发）
        params.emits.onUsage?.({ promptTokens: 8000, completionTokens: 50, totalTokens: 8050 });
        params.emits.complete?.("");
      }
    };
  })(),
  compactOptions: { enabled: true, contextWindow: 200_000 },
};

// ─── Usage 阈值触发 warmup ─────────────────────────────────────────────────────

/**
 * usage 很大时触发 compact，启动时发送 agent:warmup 事件。
 * contextWindow 默认 200k，阈值 = 200k - 20k - 13k = 167000。
 * 当 usage.promptTokens >= 167000 时触发。
 * 
 * 为了能看到 warmup 效果，compact 响应延迟 2 秒。
 */
export const compactWarmupByUsageCase: TestCase = {
  id: "compact-warmup-usage",
  name: "compact 前置 warmup（usage 超阈值）",
  group: "Compact",
  description: "预设历史 usage.promptTokens = 170000（超过阈值 167000），发消息时触发 agent:warmup loading -> compact -> success。",
  expectedBehavior: "发送消息后，先显示 '启动中...' loading，然后执行 compact fork 请求（约 2 秒），最后显示 '启动成功'，主 Agent 正常回复。",
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
 */
export const compactErrorCase: TestCase = {
  id: "compact-error",
  name: "compact 接口报错",
  group: "Compact",
  description: "compact fork 请求返回 error 事件，触发 agent:warmup error。",
  expectedBehavior: "发送消息后，显示 '启动中...'，然后 compact fork 请求失败，显示 '启动失败，建议清空历史记录再重新使用'，turn:error 事件触发，当前请求中断。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
    { user: "帮我读一下 App.tsx", assistant: "好的，我来读取 App.tsx 文件。" },
  ]),
  request: makeCompactErrorRequest(),
  compactOptions: { enabled: true, maxTurns: 1 },
};

/**
 * compact fork 请求返回空内容（无 <compact> 标签）的例子。
 */
export const compactEmptyResponseCase: TestCase = {
  id: "compact-empty-response",
  name: "compact 无有效返回",
  group: "Compact",
  description: "compact fork 请求返回内容但不含 <compact> 标签，compact 不生效，继续正常流程。",
  expectedBehavior: "发送消息后，显示 '启动中...'，compact fork 返回无效内容，不写入 compactRecord，显示 '启动成功'，主 Agent 正常回复。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
    { user: "帮我读一下 App.tsx", assistant: "好的，我来读取 App.tsx 文件。" },
  ]),
  request: makeCompactEmptyResponseRequest(),
  compactOptions: { enabled: true, maxTurns: 1 },
};

/**
 * compact fork 请求返回空字符串的例子。
 */
export const compactNoContentCase: TestCase = {
  id: "compact-no-content",
  name: "compact 无返回内容",
  group: "Compact",
  description: "compact fork 请求直接返回空字符串（complete 无任何 write）。",
  expectedBehavior: "发送消息后，显示 '启动中...'，compact fork 返回空内容，不写入 compactRecord，显示 '启动成功'，主 Agent 正常回复。",
  initialTurns: makeTextHistory([
    { user: "你好", assistant: "你好！有什么可以帮你的？" },
    { user: "帮我读一下 App.tsx", assistant: "好的，我来读取 App.tsx 文件。" },
  ]),
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

/** 生成 compact 错误请求的 mock */
function makeCompactErrorRequest(): TestCase["request"] {
  return async (params) => {
    const msgs = params.messages ?? [];
    const lastUserMsg = [...msgs].reverse().find(m => m.role === "user");
    const isCompactFork =
      typeof lastUserMsg?.content === "string" &&
      lastUserMsg.content.includes("请对上方完整的对话历史进行总结");

    await new Promise(r => setTimeout(r, 200));

    if (isCompactFork) {
      // 模拟 compact fork 请求失败
      params.emits.error?.(new Error("compact request failed: API rate limit exceeded"));
      return;
    }

    // 正常回复
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

    await new Promise(r => setTimeout(r, 200));

    if (isCompactFork) {
      // 返回不含 <compact> 标签的内容
      const invalidContent = "这是摘要内容，但没有正确的标签包裹。";
      for (const chunk of invalidContent.match(/.{1,10}/g) ?? []) {
        await new Promise(r => setTimeout(r, 20));
        params.emits.write(chunk);
      }
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    // 正常回复
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

    await new Promise(r => setTimeout(r, 200));

    if (isCompactFork) {
      // 直接返回空内容
      params.emits.onFinishReason?.("stop");
      params.emits.complete?.("");
      return;
    }

    // 正常回复
    const reply = "这是正常的回复内容。";
    for (const chunk of reply.match(/.{1,8}/g) ?? []) {
      await new Promise(r => setTimeout(r, 30));
      params.emits.write(chunk);
    }
    params.emits.onFinishReason?.("stop");
    params.emits.complete?.("");
  };
}
