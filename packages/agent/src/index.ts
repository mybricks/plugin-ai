export { Agent, AgentEvents, ForkAgent } from "./agent";
export type { AgentOptions, AgentHooks, RequestAIOptions, MaskOptions, ForkOptions, ForkAgentOptions, CompactRecord, FormatUserMessageResult } from "./agent";
export { maskMessages } from "./mask";

export type { AgentEventMap } from "./events";
export type { Message, History, Tool, TurnRecord, TurnSender, ToolCallRecord, ToolResult, VersionFile, VersionRecord, BoundHistory } from "./types";
export { ToolValidationError, bindHistory } from "./types";

export { CodeAgent } from "./code-agent";
export type { CodeAgentOptions, CodeAgentPromptOptions, Sandbox, SkillFile } from "./code-agent";
export { READ_TOOL_NAME, WRITE_TOOL_NAME, MULTI_WRITE_TOOL_NAME, EDIT_TOOL_NAME, MULTI_EDIT_TOOL_NAME, DELETE_TOOL_NAME, GREP_TOOL_NAME, GLOB_TOOL_NAME } from "./code-agent/tools";

export { IDBHistory } from "./history/idb-history";
export { HTTPHistory } from "./history/http-history";

export { createSubAgentTool, CALL_SUB_AGENT_TOOL_NAME } from "./sub-agent";
export type { SubAgentConfig } from "./sub-agent";

export type { RetryOptions } from "./retry";
export { AbortError, isAbortError } from "./errors";

// ─── Tools 公共工具集 ──────────────────────────────────────────────────────────
//
// 独立于 CodeAgent 的通用工具集，在创建 Agent 时通过 tools 数组传入：
//
//   import { Tools } from "@mybricks/plugin-ai/agent";
//
//   new CodeAgent({
//     tools: [Tools.createWebFetch({ headers: { Authorization: "Bearer xxx" } })],
//     // ...
//   });
//
import { createWebFetchTool } from "./tools/web-fetch";
export type { WebFetchConfig } from "./tools/web-fetch";
export { WEB_FETCH_TOOL_NAME } from "./tools/web-fetch";

export const Tools = {
  /**
   * 创建 web_fetch 工具。
   *
   * 允许 LLM 通过 HTTP GET 请求获取网页内容，
   * 支持 text / markdown / html 三种返回格式，可配置超时、大小限制和自定义 headers。
   *
   * @param config 可选配置
   * @returns 符合 Tool 接口的工具对象，通过 Agent 构造器的 tools 数组传入
   *
   * @example
   * ```ts
   * new CodeAgent({
   *   tools: [Tools.createWebFetch()],
   * });
   * ```
   */
  createWebFetch: createWebFetchTool,
} as const;
