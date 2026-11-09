import type { CodeAgentPlugin } from "../../../../agent/src";
import skill from "./skill.md";

/** Shared visual interpretation template and skill for browser and server agents. */
export function createUnderstandAnyCorePlugin(configDirName: string): CodeAgentPlugin {
  return {
    name: "understand-any",
    skills: [{
      name: "understand-any",
      displayName: "可视化解读",
      files: [{ path: "SKILL.md", content: skill.replaceAll("<configDirName>", configDirName) }],
    }],
    promptTemplates: [{
      name: "understand-any",
      displayName: "可视化解读",
      files: [
        { path: "PROMPT.md", content: "---\ndisplayName: 可视化解读\ndescription: 基于代码和相关资料，在配置目录的 docs 中创建和维护可视化解读文件\n---\n确认已通过 use_skill 加载 understand-any 技能内容，然后按照技能说明完成：$@" },
        { path: "PROMPT.en.md", content: "---\ndisplayName: Visual explain\ndescription: Create and maintain visual explanation files in the configuration directory's docs folder based on code and related materials\n---\nEnsure the understand-any skill content has been loaded via use_skill, then follow its instructions to complete: $@" },
      ],
    }],
  };
}
