import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeTextHistory } from "../lib/fixtures";

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
    const reply = `这是第 ${msgs.filter(m => m.role === "user").length} 条用户消息的回复。`;
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
  name: "compact + 工具调用",
  group: "Compact",
  description: "maxTurns=2，预设 2 轮历史，发消息触发工具调用的同时验证 compact 是否正常生成。",
  expectedBehavior: "工具卡片正常，Inspector 有 compact fork Step，FS Viewer 文件更新。",
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
        params.emits.complete?.("");
      } else {
        const reply = "文件已更新。";
        for (const chunk of reply.match(/.{1,4}/g) ?? []) {
          await new Promise(r => setTimeout(r, 30));
          params.emits.write(chunk);
        }
        params.emits.onFinishReason?.("stop");
        params.emits.complete?.("");
      }
    };
  })(),
  compactOptions: { enabled: true, maxTurns: 2 },
};
