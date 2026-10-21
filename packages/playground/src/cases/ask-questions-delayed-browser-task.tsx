import React, { useState } from "react";
import { AgentModeEnum, Tools } from "@agent/index";
import type { Tool } from "@agent/types";
import { BrowserToolBridge } from "../../../plugin/src/ui/chat/chat-panel/workspace-bridge/browser-tool-bridge";
import type { BrowserToolRequest } from "../../../plugin/src/ui/chat/chat-panel/workspace-bridge/browser-tool-bridge";
import type { TestCase } from "./types";
import { ASK_QUESTIONS_TOOL_NAME } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";

let nextRequestId = 0;
type SimulatedBrowserToolResult = { output?: unknown; metadata?: Record<string, unknown>; error?: string };
const taskResults = new Map<string, SimulatedBrowserToolResult>();
const askQuestions = Tools.createAskQuestions();
let queuedBrowserTask: {
  request: BrowserToolRequest;
  resolve: (result: SimulatedBrowserToolResult) => void;
  reject: (error: unknown) => void;
} | null = null;

const browserToolBridge = new BrowserToolBridge<object>({
  workspaceId: "playground-http-agent",
  requestJson: async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (init?.method === "POST" && path.includes("/browser/tasks/")) {
      const requestId = decodeURIComponent(path.split("/").pop() ?? "");
      taskResults.set(requestId, JSON.parse(String(init.body ?? "{}")) as SimulatedBrowserToolResult);
    }
    return {} as T;
  },
  agent: {},
  tools: [askQuestions],
  getSandbox: () => undefined,
  getMode: () => AgentModeEnum.Build,
  setMode: () => {},
});

const browserAskQuestionsTool: Tool = {
  ...askQuestions,
  async execute(params) {
    const requestId = `playground-http-${++nextRequestId}`;
    taskResults.delete(requestId);
    return new Promise((resolve, reject) => {
      queuedBrowserTask = {
        request: {
          requestId,
          workspaceId: "playground-http-agent",
          browserId: "playground-browser",
          name: ASK_QUESTIONS_TOOL_NAME,
          input: params,
        },
        resolve: (result) => {
          if (result.error) {
            reject(new Error(result.error));
            return;
          }
          resolve({
            output: typeof result.output === "string" ? result.output : "HTTP Agent Browser Tool 已回传结果。",
            ...(result.metadata ? { metadata: result.metadata } : {}),
          });
        },
        reject,
      };
    });
  },
};

function dispatchQueuedBrowserTask(): boolean {
  const queued = queuedBrowserTask;
  if (!queued) return false;
  queuedBrowserTask = null;
  void browserToolBridge.handleRequest(queued.request).then(() => {
    const result = taskResults.get(queued.request.requestId) ?? {};
    taskResults.delete(queued.request.requestId);
    queued.resolve(result);
  }, queued.reject);
  return true;
}

function HttpAgentBrowserTaskControls() {
  const [status, setStatus] = useState("Browser Task 尚未下发；可以先在卡片点确认，再下发观察结果。");
  const dispatch = () => {
    if (dispatchQueuedBrowserTask()) {
      setStatus("Browser Task 已下发；若刚才的提交发生在下发前，请再点一次确认。");
    } else {
      setStatus("当前没有等待下发的 Browser Task。先在聊天框发送消息触发提问。");
    }
  };

  return (
    <div className="pg-action-panel">
      <div className="pg-action-panel-header">
        <span className="pg-action-panel-title">Browser Task 延迟下发</span>
        <span className="pg-action-panel-subtitle">模拟 tool:call 已显示、browser:task 延迟到达</span>
      </div>
      <div className="pg-action-grid">
        <button className="pg-action-btn" onClick={dispatch}>
          <span>立即下发 Browser Task</span>
          <small>下发前先点确认，可模拟提交早于 bridge.wait 的竞态</small>
        </button>
        <button className="pg-action-btn" onClick={() => {
          setStatus("Browser Task 将在 3 秒后下发；请先尝试提交。");
          window.setTimeout(dispatch, 3000);
        }}>
          <span>3 秒后下发</span>
          <small>模拟服务端稍后才派发 browser:task</small>
        </button>
      </div>
      <small>{status}</small>
    </div>
  );
}

export const askQuestionsDelayedBrowserTaskCase: TestCase = {
  id: "ask-questions-delayed-browser-task",
  name: "Browser Task 延迟下发",
  group: "工具调用",
  priority: "P0",
  description: "验证提问卡片先出现、Browser Task 延迟下发时，过早提交是否会被丢弃。",
  expectedBehavior: "触发提问后选择“PC（推荐）”，在右侧点“3 秒后下发”并立刻确认；Browser Task 到达前的提交应无效，下发后再次确认应成功。也可点“立即下发 Browser Task”对比正常时序。",
  initialTurns: [],
  tools: [browserAskQuestionsTool],
  toolUI: browserToolBridge.getToolUI(),
  renderRightPanelActions: () => <HttpAgentBrowserTaskControls />,
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      delayMs: 200,
      calls: [{
        id: "call_ask_questions_http_agent_001",
        name: ASK_QUESTIONS_TOOL_NAME,
        args: {
          questions: [{
            header: "开发端",
            options: [
              {
                label: "PC（推荐）",
                description: "仅支持 PC 端，适合后台管理系统、企业内部工具等场景",
              },
              {
                label: "移动端",
                description: "仅支持移动端，适合手机 App 内嵌页、移动端 Web 场景",
              },
              {
                label: "PC 和移动端",
                description: "同时支持两端，页面会在不同屏幕宽度下自动适配布局",
              },
            ],
            question: "这个登录页面需要支持哪些开发端？",
            multiSelect: false,
          }],
        },
      }],
    },
    {
      type: "content",
      chunks: ["已收到你的选择，Browser Task 已成功回传结果。"],
      ttftMs: 100,
      chunkDelayMs: 30,
    },
  ], { loop: true }),
};
