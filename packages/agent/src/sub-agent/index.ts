export { CALL_SUB_AGENT_TOOL_NAME } from "./config";
export { collectSubAgentTurns } from "./collect";
export { startBackgroundSubAgent } from "./async-sub-agent";
export { createSubAgentTool } from "./tool";
export { applySubAgentEvent } from "./events";
export { readLegacySubAgentData } from "./legacy";
export type {
  SubAgentConfig,
  ResolvedSubAgentConfig,
  CallSubAgentArgs,
  ChildAgentRequest,
  SubAgentMetadata,
  BackgroundSubAgentRequest,
  BackgroundSubAgentInfo,
  BackgroundSubAgentResult,
} from "./types";
