import React from "react";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const DemoFocus = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 22,
      padding: "0 8px",
      borderRadius: 11,
      background: "color-mix(in srgb, var(--mybricks-color-primary, #FA6400) 9%, transparent)",
      color: "var(--mybricks-color-primary, #FA6400)",
      fontSize: 12,
      lineHeight: "22px",
    }}
  >
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
    renderFocus: 当前测试区域
  </div>
);

export const renderFocusCase: TestCase = {
  id: "render-focus",
  name: "Sender：renderFocus",
  group: "UI 渲染",
  description:
    "验证旧的 renderFocus 插槽仍然渲染在 Sender 输入框上方。",
  expectedBehavior:
    "输入框顶部展示 renderFocus pill；底部 + 菜单、输入和发送仍然正常。",
  initialTurns: [],
  renderFocus: () => <DemoFocus />,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，renderFocus 插槽仍然可用。"],
      ttftMs: 250,
      chunkDelayMs: 30,
    },
  ]),
};
