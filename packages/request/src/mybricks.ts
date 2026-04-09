import type { RequestAsStreamFn } from "./types";
import { requestAsStreamForProduction, requestAsStreamForProductionSSE } from "./base";

export function createMyBricksAIRequest(config: { getToken: () => string | Promise<string> }): RequestAsStreamFn {
  return requestAsStreamForProduction(async () => ({
    Authorization: `Bearer ${await Promise.resolve(config.getToken())}`,
  }));
}

export function createMyBricksAIRequestSSE(config: { getToken: () => string | Promise<string> }): RequestAsStreamFn {
  return requestAsStreamForProductionSSE(async () => ({
    Authorization: `Bearer ${await Promise.resolve(config.getToken())}`,
  }));
}
