import React, { useState } from "react";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const AttachmentSuffixButton = () => {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      style={{
        height: 25,
        padding: "0 8px",
        border: "1px solid var(--mybricks-border-color-main, #E6E6E6)",
        borderRadius: 13,
        background: "var(--mybricks-bg-color-main, #fff)",
        color: "var(--mybricks-text-color-main, #333)",
        fontSize: 12,
        cursor: "pointer",
      }}
      onClick={() => setCount((value) => value + 1)}
    >
      Suffix{count ? ` ${count}` : ""}
    </button>
  );
};

export const renderAttachmentSuffixCase: TestCase = {
  id: "render-attachment-suffix",
  name: "Sender：renderAttachmentSuffix",
  group: "UI 渲染",
  description:
    "验证旧的 renderAttachmentSuffix 插槽仍然渲染在 Sender 的 + 按钮之后。",
  expectedBehavior:
    "输入框底部左侧先显示 + 按钮，后面显示 Suffix 按钮；点击 Suffix 按钮数字递增，不影响 + 菜单和发送。",
  initialTurns: [],
  renderAttachmentSuffix: () => <AttachmentSuffixButton />,
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["收到，renderAttachmentSuffix 插槽仍然可用。"],
      ttftMs: 250,
      chunkDelayMs: 30,
    },
  ]),
};
