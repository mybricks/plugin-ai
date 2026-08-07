import React, { useState } from "react";
import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

const LikeButton = ({ id }: { id: string }) => {
  const [liked, setLiked] = useState(false);

  return (
    <button
      type="button"
      title={liked ? "已点赞" : "点赞"}
      onClick={() => setLiked((v) => !v)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        padding: 0,
        border: "none",
        background: "none",
        cursor: "pointer",
        color: liked ? "#fa6400" : "#333",
        transition: "color 0.15s",
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    </button>
  );
};

export const customActionBarCase: TestCase = {
  id: "custom-action-bar",
  name: "ActionBar：自定义点赞按钮",
  group: "UI 渲染",
  description: "验证 actionBar 支持自定义 render，点赞按钮点击后切换颜色状态。",
  expectedBehavior: "消息气泡左下角显示复制 + 点赞按钮；点击点赞后图标变橙色，再次点击恢复。",
  initialTurns: [],
  actionBar: [
    "copy",
    {
      key: "like",
      title: "点赞",
      render: ({ id }) => <LikeButton id={id} />,
    },
  ],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["这是一条测试消息，你可以点击左下角的点赞按钮试试看效果。"],
      ttftMs: 200,
      chunkDelayMs: 30,
    },
  ]),
};
