import type { CodeAgentPlugin } from "../../../../agent/src";
import reviewGuide from "./review-guide.md";
import evaluateImpactPrompt from "./evaluate-impact.md";

export interface ImpactDocumentPluginOptions {
  configDirName: string;
}

/** 影响评估只在用户主动调用模板时提供规则，不占用每轮 system 或 attachment。 */
export function createImpactDocumentPlugin(options: ImpactDocumentPluginOptions): CodeAgentPlugin {
  const root = options.configDirName.replace(/^\/+|\/+$/g, "");
  const prompt = `${evaluateImpactPrompt}\n\n${reviewGuide}`
    .replaceAll("<配置目录>", root);
  return {
    name: "impact-document",
    description: "按需分析分支改动并维护 REVIEW.md。",
    promptTemplates: [{
      name: "evaluate-impact",
      files: [
        { path: "PROMPT.md", content: prompt },
        {
          path: "PROMPT.en.md",
          content: `---
displayName: Assess impact
description: Assess the impact of all current changes
---`,
        },
      ],
    }],
  };
}
