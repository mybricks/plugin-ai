import type { CodeAgentPlugin } from "../../../../agent/src";
import { createProjectRunnerTool, type ProjectRunnerImplementation } from "../dev-env-prep";
import skill from "./SKILL.md";

export function createEnvGuidePlugin(options?: { projectRunnerImplementation?: ProjectRunnerImplementation }): CodeAgentPlugin {
  return {
    name: "env-guide",
    skills: [{ name: "env-guide", displayName: "项目环境指南", files: [{ path: "SKILL.md", content: skill }] }],
    tools: [createProjectRunnerTool(options?.projectRunnerImplementation)],
  };
}
