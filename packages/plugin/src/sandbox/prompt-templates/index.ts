import type { CodeAgentPlugin } from "../../../../agent/src";
import ANALYZE_SELECTION_PROMPT from "./analyze-selection.md";

export const designerPlugin = {
  name: "designer-plugin",
  promptTemplates: [
    {
      name: "analyze-selection",
      files: [
        {
          path: "PROMPT.md",
          content: ANALYZE_SELECTION_PROMPT,
        },
      ],
    },
  ],
} satisfies CodeAgentPlugin;
