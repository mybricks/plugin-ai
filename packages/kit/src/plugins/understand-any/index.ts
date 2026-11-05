import type { CodeAgentPlugin } from "../../../../agent/src";
import skill from "./skill.md";

/** Shared business diagram template and skill for browser and server agents. */
export function createUnderstandAnyCorePlugin(configDirName: string): CodeAgentPlugin {
  return {
    name: "understand-any",
    skills: [{
      name: "understand-any",
      displayName: "业务理解",
      files: [{ path: "SKILL.md", content: skill.replaceAll("<configDirName>", configDirName) }],
    }],
    promptTemplates: [{
      name: "understand-any",
      displayName: "业务理解",
      files: [{ path: "PROMPT.md", content: "---\ndisplayName: 业务理解\ndescription: 查看或生成对应目录下的业务图\n---\n请先使用 use_skill 加载 understand-any 技能，然后按照技能说明完成：$@" }],
    }],
  };
}
