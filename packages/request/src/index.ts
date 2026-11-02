import {
  requestAsStreamForProductionSSE,
} from "./base";
import { createMyBricksAIRequest, createMyBricksAIRequestSSE } from "./mybricks";
import { createOnUpload } from "./base";
import type { OnUploadFn, RequestAsStreamFn } from "./types";
import { LLMProvider } from "./providers";

export { sanitizeMessages, preprocessMessagesForModel, attachmentToMessagePart } from "./base";

export type {
  TokenUsage,
  ToolCallSpec,
  ToolCallStreamDelta,
  ToolDescriptor,
  RequestAsStreamEmits,
  RequestAsStreamParams,
  RequestAsStreamFn,
  OnUploadFn,
} from "./types";

export type { ModelConfig, ModelCapabilities, ToolAttachment, ProviderConfig, RemoteProviderConfig, CustomProviderConfig, ModelSelection, LLMProviderOptions } from "./providers";

function createRequestAsStream(): RequestAsStreamFn {
  return requestAsStreamForProductionSSE();
}

export {
  // 1. 聚合出口: for mybricks / 本地开发
  createRequestAsStream,

  // 2. 指定 MyBricks: for vscode 别的地方指定渠道
  /**
   * @deprecated
   */
  createMyBricksAIRequest,
  /**
   * @description mybricks sse 接口
   */
  createMyBricksAIRequestSSE,

  // 其他通用能力
  createOnUpload,

  // 4. LLM Provider 请求路由
  LLMProvider,
};
