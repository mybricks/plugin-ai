import type { TurnRecord } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { Tool } from "@agent/types";
import type { SubAgentConfig, Sandbox } from "@agent/code-agent";
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
  subAgents?: SubAgentConfig[];
  createSubAgents?: (sandbox: Sandbox) => SubAgentConfig[];
  maskOptions?: {
    maxTurns?: number;
    maxAgeMinutes?: number;
  };
  compactOptions?: {
    enabled?: boolean;
    maxTurns?: number;
    contextWindow?: number;
  };
  /** 覆盖 CodeAgent 的其他配置（maxSteps、doomLoopThreshold 等） */
  agentOptions?: {
    maxSteps?: number;
    doomLoopThreshold?: number;
    retry?: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
    };
  };
}
