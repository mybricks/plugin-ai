export type {
  ToolCallSpec,
  ToolCallStreamDelta,
  ToolDescriptor,
  RequestAsStreamEmits,
  RequestAsStreamParams,
  RequestAsStreamFn,
} from "../../agent/src/types/request";

import type { ModelSelection } from "./providers";

export type { TokenUsage } from "../../agent/src/types";

export type OnUploadFn = (file: File) => Promise<string>;

export type ExtraHeadersInput =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

export type { ModelSelection };
