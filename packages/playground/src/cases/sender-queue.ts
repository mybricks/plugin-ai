import React from "react";
import { context } from "@plugin/context";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

function SenderQueueControls({ agent }: Parameters<NonNullable<TestCase["renderRightPanelActions"]>>[0]) {
  const send = () => {
    if (!agent) return;
    const message = "这是一条在请求阻塞期间由右侧按钮加入的待发送消息。";
    const params = { message, animation: true };
    context.aiQueue.send(
      agent,
      () => agent.requestAI(params),
      params,
    );
  };

  return React.createElement(
    "div",
    { className: "pg-action-panel" },
    React.createElement(
      "div",
      { className: "pg-action-panel-header" },
      React.createElement("span", { className: "pg-action-panel-title" }, "队列操作"),
      React.createElement("span", { className: "pg-action-panel-subtitle" }, "请求阻塞时可继续添加"),
    ),
    React.createElement(
      "div",
      { className: "pg-action-grid" },
      React.createElement(
        "button",
        { className: "pg-action-btn", disabled: !agent, onClick: send },
        React.createElement("span", null, "发送到待发送队列"),
        React.createElement("small", null, "在请求阻塞时添加一条消息"),
      ),
    ),
  );
}

export const senderQueueCase: TestCase = {
  id: "sender-queue",
  name: "Sender 队列：添加、删除与编辑",
  group: "队列",
  priority: "P0",
  description: "首条消息保持等待状态；后续可通过 Sender 或右侧发送按钮将消息加入待发送队列。",
  expectedBehavior: "先发送首条消息使请求保持等待；继续输入消息并按 Enter，或点击右侧“发送到待发送队列”，都会在 Sender 上方生成队列项。右侧按钮请求会携带 animation: true。点击删除图标可移除该项；点击编辑图标会将消息取回输入框，修改后按 Enter 会作为新队列项重新加入。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "pending",
      delayMs: 150,
    },
  ]),
  renderRightPanelActions: (params) => React.createElement(SenderQueueControls, params),
};
