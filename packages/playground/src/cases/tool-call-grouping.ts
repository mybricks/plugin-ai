import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * 验证 ChatPanel 的 groupToolCalls 聚合展示：
 *   文本1+edit_file → bash（无文本打断，与上一步合并成一个分组）→ 文本2+bash（最后一步进行中）→ 文本3（结束）
 * 对应需求里的截图效果：收起态只展示状态图标 + 最新工具名 + 聚合耗时，点击展开后逐条展示。
 *
 * 注意：这里用 content_then_tool_calls 而不是纯 content —— 纯 content 这个 mock step 不会调用
 * onToolCalls，agent 判断「没有工具调用」会直接结束 turn（agent.ts 里 shouldContinue = hasToolCalls），
 * 发一条消息只会看到第一段文本就停了。真实场景里模型经常是「先说一句话，紧接着在同一轮调用工具」，
 * 要还原这种会继续 ReAct 循环的多轮效果，必须让每一轮（除最后一轮外）都带上工具调用。
 */
export const toolCallGroupingCase: TestCase = {
  id: "ui-tool-call-grouping",
  name: "连续工具调用聚合展示（groupToolCalls）",
  group: "UI 渲染",
  description:
    "开启 groupToolCalls 后，同一 turn 内「未被文本打断」的连续工具调用会合并成一个可折叠分组；收起时只展示状态图标、最新工具名和聚合耗时，点击可展开查看每个工具的详情。",
  expectedBehavior:
    "第一段文本后出现一个聚合行（而不是 2 张独立卡片），显示最新工具名 bash 和耗时；第二段文本后的 bash 仍在执行中时，该行持续刷新耗时并 shimmer 展示当前工具名；点击聚合行可展开为逐条工具详情，再次点击收起；最终文本出现后 turn 结束。",
  initialTurns: [],
  groupToolCalls: true,
  request: makeScriptedRequest([
    {
      type: "content_then_tool_calls",
      chunks: ["我会把代码语言变量统一改为 ", "`codeLang`", "，避免覆盖 i18n 的 ", "`lang`", "，随后跑一次项目的类型/构建校验。"],
      calls: [{ id: "c_edit_1", name: "edit_file", args: { path: "src/code-lang.ts", oldStr: "lang", newStr: "codeLang" } }],
      ttftMs: 150,
      chunkDelayMs: 20,
      toolDelayMs: 300,
    },
    {
      type: "tool_calls",
      calls: [{ id: "c_bash_1", name: "bash", args: { command: "pnpm typecheck && pnpm build" } }],
      delayMs: 1200,
    },
    {
      type: "content_then_tool_calls",
      chunks: ["修复已完成，插件构建也已通过；", "构建过程只有项目原有的循环依赖与 ", "`crypto`", " 浏览器 bundle 提示，没有新增失败。", "最后我确认一下改动范围。"],
      calls: [{ id: "c_bash_2", name: "bash", args: { command: "git diff --check && git diff -- packages/plugin/src" } }],
      ttftMs: 150,
      chunkDelayMs: 20,
      toolDelayMs: 8000,
    },
    {
      type: "content",
      chunks: ["改动范围确认完毕，没有发现额外的未预期变更。"],
      ttftMs: 150,
      chunkDelayMs: 20,
    },
  ]),
};
