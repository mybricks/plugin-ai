import { isProduction } from "./env";
import {
  loadRequestInfraFromCDN,
  requestAsStreamForDevelopmentSSE,
  requestAsStreamForProductionSSE,
} from "./base";
import { createMyBricksAIRequest, createMyBricksAIRequestSSE } from "./mybricks";
import { checkInfraAvailable, createInfraAIOnUpload, createInfraAIRequest, createOnUpload } from "./infra";
import type { OnUploadFn, RequestAsStreamFn } from "./types";
import { LLMProviders } from "./providers";

// import { requestAsStreamInfra } from './cdzd'
// import { createCustomRequest } from './custom';

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

export type { ModelConfig, ProviderConfig, ModelSelection, LLMProvidersOptions } from "./providers";

function createRequestAsStream(config?: { useInfra?: boolean }): RequestAsStreamFn {
  const { useInfra = true } = config ?? {};

  if (useInfra && !isProduction()) {
    loadRequestInfraFromCDN().catch(() => {});
  }

  return async function (params) {

    // return requestAsStreamInfra(params)
  
    // 开发环境
    if (!isProduction()) {
      // useInfra = true 时，尝试 CDN
      if (useInfra) {
        const cdnFn = await loadRequestInfraFromCDN();
        if (cdnFn) return cdnFn(params);
        // CDN 不存在，走 Development SSE
      }
      // useInfra = false 或 CDN 不存在，走 Development SSE
      // TODO：测试接口已下线
      return requestAsStreamForProductionSSE()(params);
    }

    // 生产环境走 Production SSE
    return requestAsStreamForProductionSSE()(params);
  };
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

  // 3. Infra
  createInfraAIRequest,
  checkInfraAvailable,
  createInfraAIOnUpload,

  // 其他通用能力
  createOnUpload,

  // 4. LLMProviders 类
  LLMProviders,
};
