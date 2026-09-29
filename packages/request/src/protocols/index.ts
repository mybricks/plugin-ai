import { anthropicProtocol } from "./anthropic";
import { openAIProtocol } from "./openai";
import type { ModelProtocol, ProtocolType } from "./types";

const protocols: Record<ProtocolType, ModelProtocol> = {
  openai: openAIProtocol,
  anthropic: anthropicProtocol,
};

export function getProtocol(type: ProtocolType): ModelProtocol {
  return protocols[type];
}

export function normalizeProtocolUrl(type: ProtocolType, url: string): string {
  const protocol = getProtocol(type);
  let baseUrl = url.trim().replace(/\/+$/, "");
  for (const candidate of Object.values(protocols)) {
    if (baseUrl.endsWith(candidate.endpoint)) {
      baseUrl = baseUrl.slice(0, -candidate.endpoint.length);
      break;
    }
  }
  if (!baseUrl) return "";
  if (baseUrl.endsWith("/v1") && protocol.endpoint.startsWith("/v1/")) {
    return `${baseUrl}${protocol.endpoint.slice(3)}`;
  }
  return `${baseUrl}${protocol.endpoint}`;
}

export { anthropicProtocol, openAIProtocol };
export type { ModelProtocol, ProtocolRequestInput, ProtocolType } from "./types";
