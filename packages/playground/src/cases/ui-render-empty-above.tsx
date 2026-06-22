import React from "react";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

// ─── renderEmpty 测试用例 ──────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "📋 生成代码", prompt: "帮我生成一个 React 组件" },
  { label: "🔍 代码审查", prompt: "帮我 review 以下代码" },
  { label: "🐛 排查 Bug", prompt: "帮我排查一个 Bug" },
  { label: "📝 写文档", prompt: "帮我写一份技术文档" },
];

function EmptyGuide() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "0 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28 }}>👋</div>
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--mybricks-text-color-main, #333)",
            marginBottom: 4,
          }}
        >
          有什么可以帮你？
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--mybricks-text-color-main, #999)",
          }}
        >
          你可以直接输入需求，或从下方快捷选项开始
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--mybricks-border-color, #e5e5e5)",
              background: "var(--mybricks-bg-color-main, #fff)",
              color: "var(--mybricks-text-color-main, #333)",
              fontSize: 12,
              cursor: "pointer",
              lineHeight: "20px",
            }}
            onClick={() => {
              // eslint-disable-next-line no-console
              console.log("[renderEmpty] clicked:", action.prompt);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** renderEmpty 测试用例：消息为空时在 messages 区域居中展示引导内容，发送后消失 */
export const renderEmptyAboveCase: TestCase = {
  id: "ui-render-empty-above",
  name: "空消息状态自定义内容",
  group: "UI 渲染",
  description:
    "通过 renderEmpty 在消息列表为空时在 messages 区域居中展示自定义内容（引导语 + 快捷指令），发送第一条消息后自动隐藏。",
  expectedBehavior:
    "初始状态下 messages 区域居中显示引导卡片；发送消息后卡片消失，正常展示消息列表。",
  initialTurns: [],
  renderEmpty: () => <EmptyGuide />,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["好的，我来帮你处理这个需求。"],
      ttftMs: 200,
      chunkDelayMs: 40,
    },
  ]),
};
