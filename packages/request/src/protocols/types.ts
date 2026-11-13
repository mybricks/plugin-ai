import type {
  RequestAsStreamEmits,
  ToolDescriptor,
} from "../types";

export type ProtocolType = "openai" | "anthropic";

export interface ProtocolRequestInput {
  model: string;
  messages: any[];
  tools?: ToolDescriptor[];
  extraParams?: Record<string, any>;
}

export interface ModelProtocol {
  type: ProtocolType;
  endpoint: string;
  createHeaders: (apiKey: string) => Record<string, string>;
  createRequestBody: (input: ProtocolRequestInput) => Record<string, any>;
  readStream: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    emits: RequestAsStreamEmits,
  ) => Promise<void>;
}
