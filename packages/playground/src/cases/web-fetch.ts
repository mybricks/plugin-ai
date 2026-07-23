import type { TestCase } from "./types";
import { Tools, WEB_FETCH_TOOL_NAME } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";
import { getWebFetchUrl } from "../lib/web-fetch-state";

/**
 * web_fetch 是外部注入工具，不属于 CodeAgent 默认沙盒工具。
 * 这里按 packages/agent/src/tools/web-fetch 的真实分支维护少量代表 case：
 * - 默认 markdown
 * - 指定 text/html format
 * - 图片 metadata.dataUrl
 * - validate 失败
 * - 非 2xx HTTP 抛错
 */

function webFetchCall(id: string, args: Record<string, unknown>) {
  return {
    id,
    name: WEB_FETCH_TOOL_NAME,
    args,
  };
}

export const webFetchBasicCase: TestCase = {
  id: "web-fetch-markdown",
  name: "WebFetch 默认 Markdown",
  group: "WebFetch",
  description: "使用左侧 URL 输入框中的地址，默认以 markdown 获取网页内容。",
  expectedBehavior:
    "工具卡片绿色；HTML 会转成 Markdown，metadata 包含 url、title、mime、format、size、status。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest([
    {
      type: "dynamic_tool_calls",
      delayMs: 300,
      resolve: () => [webFetchCall("call_webfetch_markdown_001", { url: getWebFetchUrl() })],
    },
    {
      type: "content",
      chunks: ["已按默认 Markdown 格式获取并解析网页内容。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ]),
};

export const webFetchFormatCase: TestCase = {
  id: "web-fetch-format",
  name: "WebFetch 指定格式",
  group: "WebFetch",
  description: "连续调用 text 和 html 两种 format，覆盖 HTML 转纯文本和原始 HTML 返回。",
  expectedBehavior:
    "两张工具卡片绿色；text 会剥离 HTML 标签，html 会保留原始 HTML。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest([
    {
      type: "dynamic_tool_calls",
      delayMs: 300,
      resolve: () => {
        const url = getWebFetchUrl();
        return [
          webFetchCall("call_webfetch_text_001", { url, format: "text" }),
          webFetchCall("call_webfetch_html_001", { url, format: "html" }),
        ];
      },
    },
    {
      type: "content",
      chunks: ["text 和 html 两种格式都已请求完成。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ]),
};

export const webFetchImageCase: TestCase = {
  id: "web-fetch-image",
  name: "WebFetch 图片",
  group: "WebFetch",
  description: "输入图片 URL，覆盖 image/* 响应转换为 base64 Data URL。",
  expectedBehavior:
    "工具卡片绿色，输出 Image fetched successfully，metadata.format 为 image，并包含 dataUrl。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest([
    {
      type: "dynamic_tool_calls",
      delayMs: 300,
      resolve: () => [webFetchCall("call_webfetch_image_001", { url: getWebFetchUrl() })],
    },
    {
      type: "content",
      chunks: ["图片内容已获取，工具 metadata 中包含 base64 dataUrl。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ]),
};

export const webFetchValidationCase: TestCase = {
  id: "web-fetch-validation",
  name: "WebFetch 参数校验",
  group: "WebFetch",
  description: "传入不支持的 file:// URL，覆盖 URL 协议校验失败。",
  expectedBehavior:
    "工具卡片红色，显示 URL must use http or https protocol。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      delayMs: 300,
      calls: [webFetchCall("call_webfetch_validation_001", { url: "file:///tmp/index.html" })],
    },
    {
      type: "content",
      chunks: ["web_fetch 只允许 http 或 https URL。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ]),
};

export const webFetchHttpErrorCase: TestCase = {
  id: "web-fetch-http-error",
  name: "WebFetch HTTP 错误",
  group: "WebFetch",
  description: "使用左侧 URL 输入框中的 404/500 地址，覆盖 response.ok=false 时抛错。",
  expectedBehavior:
    "工具卡片红色，显示 HTTP 状态码和 URL；实现不会把非 2xx 错误页当作成功内容返回。",
  initialTurns: [],
  tools: [Tools.createWebFetch()],
  request: makeScriptedRequest([
    {
      type: "dynamic_tool_calls",
      delayMs: 300,
      resolve: () => [webFetchCall("call_webfetch_http_error_001", { url: getWebFetchUrl(), format: "html" })],
    },
    {
      type: "content",
      chunks: ["请求返回非 2xx 状态，web_fetch 按错误处理。"],
      ttftMs: 250,
      chunkDelayMs: 50,
    },
  ]),
};
