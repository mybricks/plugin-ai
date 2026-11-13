import { requestAsStreamForProductionSSE } from "./legacy";
import { createMyBricksAIRequest, createMyBricksAIRequestSSE } from "./mybricks";
import { createOnUpload } from "./legacy";
import type { OnUploadFn, RequestAsStreamFn } from "./types";
import { LLMProvider } from "./llm-provider";

export {
  attachmentToMessagePart,
  prepareMessagesForModel,
  preprocessMessagesForModel,
  sanitizeMessages,
} from "./messages";
export type { MessageAttachment, ModelCapabilityLike } from "./messages";

export {
  anthropicProtocol,
  getProtocol,
  normalizeProtocolUrl,
  openAIProtocol,
} from "./protocols";
export type {
  ModelProtocol,
  ProtocolRequestInput,
  ProtocolType,
} from "./protocols";

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

export type { ModelConfig, ModelCapabilities, ToolAttachment, ProviderConfig, RemoteProviderConfig, CustomProviderConfig, ModelSelection, LLMProviderOptions } from "./llm-provider";

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
