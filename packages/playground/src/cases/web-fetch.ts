import type { TestCase } from "./types";
import { Tools, WEB_FETCH_TOOL_NAME } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";
import { getWebFetchUrl } from "../lib/web-fetch-state";

/**
 * WebFetch 测试用例
 *
 * 特点：
 * - 用户通过 URL 输入框提供地址（在 sidebar 顶部）
 * - LLM 调用 web_fetch 工具
 * - 工具真实执行网络请求（不是 mock）
 * - URL 从 web-fetch-state 模块读取
 */

export const webFetchBasicCase: TestCase = {
  id: "web-fetch-basic",
  name: "WebFetch 基础请求",
  group: "WebFetch",
  description: "在左侧 URL 输入框填写地址，发送任意消息后 LLM 调用 web_fetch 工具获取内容。",
  expectedBehavior:
    "用户填写 URL 后发送消息，LLM 返回 tool_calls，web_fetch 工具执行真实的网络请求，返回网页内容。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest(
    [
      {
        type: "dynamic_tool_calls",
        delayMs: 400,
        resolve: () => {
          const url = getWebFetchUrl();
          return [
            {
              id: "call_webfetch_001",
              name: WEB_FETCH_TOOL_NAME,
              args: { url, format: "markdown" },
            },
          ];
        },
      },
      {
        type: "content",
        chunks: [
          "已成功获取网页内容。",
          "内容已转换为 Markdown 格式。",
        ],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: false }
  ),
};

export const webFetchFormatCase: TestCase = {
  id: "web-fetch-format",
  name: "WebFetch 指定返回格式",
  group: "WebFetch",
  description: "测试 format 参数（text），使用 URL 输入框中的地址。",
  expectedBehavior:
    "用户可指定 format 参数，web_fetch 按指定格式返回内容。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest(
    [
      {
        type: "dynamic_tool_calls",
        delayMs: 400,
        resolve: () => {
          const url = getWebFetchUrl();
          return [
            {
              id: "call_webfetch_002",
              name: WEB_FETCH_TOOL_NAME,
              args: { url, format: "text" },
            },
          ];
        },
      },
      {
        type: "content",
        chunks: ["纯文本格式已获取，所有 HTML 标签已剥离。"],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: false }
  ),
};

export const webFetchAuthCase: TestCase = {
  id: "web-fetch-auth",
  name: "WebFetch 带 Authorization",
  group: "WebFetch",
  description: "测试自定义 headers，使用 URL 输入框中的地址。",
  expectedBehavior:
    "web_fetch 工具携带 Authorization header 发起请求。",
  initialTurns: [],
  tools: [
    Tools.createWebFetch({
      headers: {
        Authorization: "Bearer test-token-12345",
      },
    }),
  ],
  request: makeScriptedRequest(
    [
      {
        type: "dynamic_tool_calls",
        delayMs: 400,
        resolve: () => {
          const url = getWebFetchUrl();
          return [
            {
              id: "call_webfetch_003",
              name: WEB_FETCH_TOOL_NAME,
              args: { url },
            },
          ];
        },
      },
      {
        type: "content",
        chunks: ["已携带鉴权信息请求接口。"],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: false }
  ),
};

export const webFetchImageCase: TestCase = {
  id: "web-fetch-image",
  name: "WebFetch 获取图片",
  group: "WebFetch",
  description: "获取图片类型资源，返回 base64 Data URL。",
  expectedBehavior:
    "web_fetch 识别图片 MIME 类型，返回 dataUrl 字段。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest(
    [
      {
        type: "dynamic_tool_calls",
        delayMs: 400,
        resolve: () => {
          const url = getWebFetchUrl();
          return [
            {
              id: "call_webfetch_004",
              name: WEB_FETCH_TOOL_NAME,
              args: { url },
            },
          ];
        },
      },
      {
        type: "content",
        chunks: ["图片已获取，返回 base64 Data URL。"],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: false }
  ),
};

/**
 * WebFetch 错误页场景
 *
 * 演示服务器返回 HTML 错误页（如 403/404/500 页面）的情况
 */
export const webFetchErrorCase: TestCase = {
  id: "web-fetch-error",
  name: "WebFetch 错误页",
  group: "WebFetch",
  description: "测试服务器返回 HTML 错误页（如 403 Forbidden）的场景。",
  expectedBehavior:
    "web_fetch 返回错误页的 HTML 内容，LLM 可识别并告知用户请求失败。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest(
    [
      {
        type: "dynamic_tool_calls",
        delayMs: 400,
        resolve: () => {
          const url = getWebFetchUrl();
          return [
            {
              id: "call_webfetch_005",
              name: WEB_FETCH_TOOL_NAME,
              args: { url, format: "html" },
            },
          ];
        },
      },
      {
        type: "content",
        chunks: [
          "请求返回了错误页面。",
          "服务器可能拒绝了访问请求（如 403 Forbidden）。",
          "请检查 URL 是否正确，或是否需要鉴权信息。",
        ],
        ttftMs: 300,
        chunkDelayMs: 50,
      },
    ],
    { loop: false }
  ),
};
