import type { TestCase } from "./types";
import { TOOL_CONTRACT_INITIAL_FILES } from "../tool-contract-runtime";

export const toolContractCase: TestCase = {
  id: "tool-contract",
  name: "工具参数与文件契约",
  group: "工具回归",
  priority: "P0",
  description: "不经过 Agent：直接执行工具，检查参数、output/metadata 与文件系统变化。",
  expectedBehavior: "可切换 Sandbox V1 与 AgentSandbox，并查看每次调用的完整结果和自动断言。",
  initialTurns: [],
  initialFiles: TOOL_CONTRACT_INITIAL_FILES,
  request: async () => {},
  playgroundLayout: "tool-contract",
};
