import type { CreateAgent } from "./sandbox/connect-shared";

/** 判断是否使用调用方提供的 Agent 工厂。 */
export function isCustomAgent(createAgent: CreateAgent | undefined): createAgent is CreateAgent {
  return !!createAgent;
}
