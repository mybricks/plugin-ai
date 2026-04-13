import { isProduction } from "./env";
import { createCustomRequest } from "./custom";
import {
  createKimiCompatibleRequest,
  loadRequestInfraFromCDN,
  requestAsStreamForDevelopment,
  requestAsStreamForDevelopmentSSE,
  requestAsStreamForProduction,
  requestAsStreamForProductionSSE,
} from "./base";
import { createMyBricksAIRequest, createMyBricksAIRequestSSE } from "./mybricks";
import { checkInfraAvailable, createInfraAIOnUpload, createInfraAIRequest, createOnUpload } from "./infra";
import type { OnUploadFn, RequestAsStreamFn } from "./types";

import { requestAsStreamInfra } from './cdzd'

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

function createRequestAsSSE(): RequestAsStreamFn {
  return async function (params) {
    if (isProduction()) {
      return requestAsStreamForProductionSSE()(params);
    }
    if (params.aiRole === "kimi") {
      const kimiRequest = createKimiCompatibleRequest({
        apiKey: "",
        model: "kimi-k2.5",
      });
      return kimiRequest(params);
    }
    return requestAsStreamForDevelopmentSSE(params);
  };
}

function createRequestAsStream(): RequestAsStreamFn {
  if (!isProduction()) {
    loadRequestInfraFromCDN().catch(() => {});
  }

  return async function (params) {

    return requestAsStreamInfra(params);

    // return createCustomRequest({
    //   provider: () => "openai",
    //   apiUrl: () => "https://openrouter.ai/api/v1/chat/completions",
    //   apiKey: () => "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",
    //   model: () => 'anthropic/claude-sonnet-4.6'
    // })(params);


    // return createCustomRequest({
    //   provider: () => "openai",
    //   apiUrl: () => "https://openrouter.ai/api/v1/chat/completions",
    //   apiKey: () => "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",
    //   model: () => 'moonshotai/kimi-k2.5'
    // })(params);

    if (isProduction()) {
      return requestAsStreamForProduction()(params);
    }
    const cdnFn = await loadRequestInfraFromCDN();
    if (cdnFn) return cdnFn(params);
    if (params.aiRole === "kimi") {
      const kimiRequest = createKimiCompatibleRequest({
        apiKey: "",
        model: "kimi-k2.5",
      });
      return kimiRequest(params);
    }
    return requestAsStreamForDevelopment(params);
  };
}

export {
  // 1. 聚合出口
  createRequestAsStream,
  createRequestAsSSE,

  // 2. 指定 MyBricks
  createMyBricksAIRequest,
  createMyBricksAIRequestSSE,

  // 3. Infra
  createInfraAIRequest,
  checkInfraAvailable,
  createInfraAIOnUpload,

  // 其他通用能力
  createOnUpload,

  // 4. 自定义
  createCustomRequest,
};
export type { CustomRequestConfig } from "./custom";
