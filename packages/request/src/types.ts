import type { TokenUsage } from "../../agent/src/types";

export type { TokenUsage };

export type ToolCallSpec = {
  id: string;
  name: string;
  args: Record<string, any>;
};

export type ToolCallStreamDelta = {
  index: number;
  id?: string;
  name?: string;
  argsChunk?: string;
};

export type ToolDescriptor = {
  name: string;
  description: string;
  parameters?: Record<string, any>;
};

export type RequestAsStreamEmits = {
  write: (chunk: string) => void;
  complete: (v: string) => void;
  error: (e: any) => void;
  cancel: (fn: () => void) => void;
  onUsage?: (usage: TokenUsage) => void;
  onThinking?: (chunk: string) => void;
  onToolCalls?: (toolCalls: ToolCallSpec[]) => void;
  onToolCallStream?: (delta: ToolCallStreamDelta) => void;
  onFinishReason?: (reason: string) => void;
};

export type RequestAsStreamParams = {
  messages: any;
  emits: RequestAsStreamEmits;
  aiRole?: any;
  tools?: ToolDescriptor[];
};

export type RequestAsStreamFn = (params: RequestAsStreamParams) => Promise<void>;

export type OnUploadFn = (file: File) => Promise<string>;

export type ExtraHeadersInput =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);
