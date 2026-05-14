import type { TurnRecord } from "@agent/types";
import type { RequestAsStreamFn } from "@request/types";
import type { Tool } from "@agent/types";
import type { SkillFile } from "@agent/code-agent";
import type { FsFile } from "../lib/mem-fs";

export type Priority = "P0" | "P1" | "P2";

export interface TestCase {
  id: string;
  name: string;
  group: string;
  /** 优先级，P0 最高，排序时 P0 排在最前 */
  priority?: Priority;
  description: string;
  expectedBehavior: string;
  /** 预设历史轮次 */
  initialTurns: TurnRecord[];
  /** 预设文件系统（不传则使用 DEFAULT_FILES） */
  initialFiles?: FsFile[];
  request: RequestAsStreamFn;
  tools?: Tool[];
  /** 预设技能文件列表，传入 CodeAgent.skills */
  skills?: SkillFile[];
  maskOptions?: {
    maxTurns?: number;
    maxAgeMinutes?: number;
  };
  compactOptions?: {
    enabled?: boolean;
    maxTurns?: number;
    contextWindow?: number;
  };
  summaryOptions?: {
    enabled?: boolean;
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
