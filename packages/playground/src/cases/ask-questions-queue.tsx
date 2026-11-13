import React from "react";
import { ASK_QUESTIONS_TOOL_NAME, Tools } from "@agent/index";
import { context } from "@plugin/context";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

function BlockingToolControls({
  agent,
}: Parameters<NonNullable<TestCase["renderRightPanelActions"]>>[0]) {
  return (
    <div className="pg-action-panel">
      <div className="pg-action-panel-header">
        <span className="pg-action-panel-title">阻塞工具操作</span>
        <span className="pg-action-panel-subtitle">在 ask_questions 等待回答时使用</span>
      </div>
      <div className="pg-action-grid">
        <button
          className="pg-action-btn"
          disabled={!agent}
          onClick={() => {
            if (!agent) return;
            const message = "这是一条在 ask_questions 阻塞期间加入的待发送消息。";
            const params = { message, animation: true };
            context.aiQueue.send(
              agent,
              () => agent.requestAI(params),
              params,
            );
          }}
        >
          <span>发送到待发送队列</span>
          <small>在 ask_questions 阻塞时添加消息</small>
        </button>
      </div>
    </div>
  );
}

export const askQuestionsQueueCase: TestCase = {
  id: "ask-questions-queue",
  name: "阻塞提问中的队列发送",
  group: "工具调用",
  priority: "P0",
  description: "ask_questions 阻塞时，可用右侧发送按钮将消息加入待发送队列。",
  expectedBehavior: "先发送任意消息触发提问；点击“发送到待发送队列”后，阻塞区仅显示主题色的“有 N 条消息排队中”摘要。该请求会携带 animation: true；回答提问后，排队消息会继续执行。",
  initialTurns: [],
  tools: [Tools.createAskQuestions()],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      delayMs: 200,
      calls: [{
        id: "call_ask_queue_001",
        name: ASK_QUESTIONS_TOOL_NAME,
        args: {
          questions: [{
            question: "继续前需要确认实现方向吗？",
            header: "实现方向",
            options: [
              { label: "保持当前方案", description: "按现有实现继续推进。" },
              { label: "调整交互", description: "先根据反馈修改交互方式。" },
            ],
          }],
        },
      }],
    },
    {
      type: "content",
      chunks: ["已收到选择，正在处理这次提问。"],
      ttftMs: 80,
      chunkDelayMs: 30,
    },
    {
      type: "content",
      chunks: ["已处理阻塞期间加入的待发送消息。"],
      ttftMs: 80,
      chunkDelayMs: 30,
    },
  ], { loop: true }),
  renderRightPanelActions: (params) => <BlockingToolControls {...params} />,
};
