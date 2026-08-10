import React from "react";
import type { Tool } from "@agent/types";
import type { TestCase } from "./types";
import { makeToolHistory } from "../lib/fixtures";
import { makeScriptedRequest } from "../lib/scripted-request";

const STREAMING_RENDER_TOOL_NAME = "playground_streaming_render";

const STREAMING_TOOL_OUTPUT =
  "工具执行内容也会逐字推送到卡片。这个过程用于验证 tool:progress 是否会让整个历史消息列表反复提交渲染。";

function createStreamingRenderTool(): Tool {
  return {
    name: STREAMING_RENDER_TOOL_NAME,
    title: "逐字流式工具内容",
    description: "Playground 性能压测：每 8ms 推送一次累积进度内容。",
    parameters: {
      type: "object",
      properties: {
        payload: { type: "string", description: "用于拉长逐字符参数流的测试文本" },
      },
      required: ["payload"],
    },
    async execute(_params, context) {
      let content = "";
      for (const char of STREAMING_TOOL_OUTPUT) {
        content += char;
        context.emitProgress({ content });
        await new Promise((resolve) => setTimeout(resolve, 8));
      }
      return { output: content, metadata: { streamed: true, characters: content.length } };
    },
    render(tool) {
      const progress = typeof tool.progress?.content === "string" ? tool.progress.content : "";
      return (
        <div style={{ padding: "8px 0", fontSize: 12 }}>
          <strong>{tool.status === "pending" ? "逐字工具内容流式中" : "逐字工具内容流式完成"}</strong>
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{progress || tool.argsContent || "等待参数…"}</div>
        </div>
      );
    },
  };
}

const historyWithManyTools = makeToolHistory(
  Array.from({ length: 8 }, (_, turnIndex) => ({
    user: `历史第 ${turnIndex + 1} 轮：检查模块并记录结果`,
    assistant: `历史第 ${turnIndex + 1} 轮已完成，三个工具调用的结果均已记录。`,
    toolCalls: [
      { name: "read_file", args: { path: `/src/module-${turnIndex + 1}.ts` }, result: "export const ready = true;" },
      { name: "grep_search", args: { query: `module-${turnIndex + 1}` }, result: "找到 3 处引用。" },
      { name: "write_file", args: { path: `/tmp/log-${turnIndex + 1}.txt`, content: "done" }, result: "写入完成。" },
    ],
  })),
  Date.now() - 60 * 60 * 1000
);

const FINAL_STREAM_CONTENT =
  "本轮验证完成：参数流、工具内容流和最终回答都按单个字符到达。请在控制台查看已提交的列表和气泡渲染次数。";

/** 用于在浏览器 Performance 面板中观察长历史下的流式渲染开销。 */
export const streamingRenderPerformanceCase: TestCase = {
  id: "streaming-render-performance",
  name: "流式历史列表渲染计数",
  group: "性能",
  description:
    "8 轮历史、每轮 3 个工具；新 turn 的工具参数、工具进度和最终回复均每 8ms 逐字符流式输出。",
  expectedBehavior:
    "发送消息后，在浏览器 Performance 面板录制本轮；历史消息 DOM 应保持稳定，耗时主要集中在当前流式项。",
  initialTurns: historyWithManyTools,
  tools: [createStreamingRenderTool()],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        calls: [
          {
            id: "c_streaming_render_probe",
            name: STREAMING_RENDER_TOOL_NAME,
            args: { payload: "参数按字符传输以放大 UI 更新次数。".repeat(12) },
          },
        ],
        delayMs: 120,
        streamChunkSize: 1,
        streamChunkDelayMs: 8,
      },
      {
        type: "content",
        chunks: Array.from(FINAL_STREAM_CONTENT),
        ttftMs: 80,
        chunkDelayMs: 8,
      },
    ],
    { loop: true }
  ),
};
