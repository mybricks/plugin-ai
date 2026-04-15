import type { TurnRecord } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { Tool } from "@agent/types";
import type { FsFile } from "../lib/mem-fs";

export interface TestCase {
  id: string;
  name: string;
  group: string;
  description: string;
  expectedBehavior: string;
  /** 预设历史轮次 */
  initialTurns: TurnRecord[];
  /** 预设文件系统（不传则使用 DEFAULT_FILES） */
  initialFiles?: FsFile[];
  request: RequestAsStreamFn;
  tools?: Tool[];
  maskOptions?: {
    maxTurns?: number;
    maxAgeMinutes?: number;
  };
  compactOptions?: {
    enabled?: boolean;
    maxTurns?: number;
  };
  /** 覆盖 CodeAgent 的其他配置（maxSteps、doomLoopThreshold 等） */
  agentOptions?: {
    maxSteps?: number;
    doomLoopThreshold?: number;
  };
}
