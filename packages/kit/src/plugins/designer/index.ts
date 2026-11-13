import type { CodeAgentPlugin } from "../../../../agent/src";
import analyzeSelectionPrompt from "./analyze-selection.md";

/** 设计器场景的内置 Agent 能力，供客户端和服务端共用。 */
export const designerPlugin = {
  name: "designer",
  promptTemplates: [
    {
      name: "analyze-selection",
      files: [
        { path: "PROMPT.md", content: analyzeSelectionPrompt },
        {
          path: "PROMPT.en.md",
          content: `---
displayName: Analyze selection
description: Understand how the selected area works
---`,
        },
      ],
    },
  ],
} satisfies CodeAgentPlugin;
