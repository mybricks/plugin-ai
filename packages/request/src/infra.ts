import type { RequestAsStreamFn } from "./types";
import {
  checkInfraAvailable,
  createInfraAIOnUpload,
  createOnUpload,
  loadRequestInfraFromCDN,
} from "./base";


export { checkInfraAvailable, createInfraAIOnUpload, createOnUpload };

export function createInfraAIRequest(): RequestAsStreamFn {
  return async function (params) {
    const cdnFn = await loadRequestInfraFromCDN();
    return cdnFn!(params);
  };
}
