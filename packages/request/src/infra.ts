import type { RequestAsStreamFn } from "./types";
import {
  checkInfraAvailable,
  createInfraAIOnUpload,
  createOnUpload,
  loadRequestInfraFromCDN,
  requestAsStreamForProduction,
} from "./base";

// import { requestAsStreamInfra } from './cdzd'

export { checkInfraAvailable, createInfraAIOnUpload, createOnUpload };

export function createInfraAIRequest(): RequestAsStreamFn {
  return async function (params) {

    // return requestAsStreamInfra(params);

    const cdnFn = await loadRequestInfraFromCDN();
    if (cdnFn) return cdnFn(params);
    return requestAsStreamForProduction()(params);
  };
}
