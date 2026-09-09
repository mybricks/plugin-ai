import identitySection from "./identitySection.md";
import taskGuide from "./taskGuide.md";
import usingToolsSection from "./usingToolsSection.md";

export const cliPdePromptSection = {
  agent: {
    identitySection,
    usingToolsSection: `${usingToolsSection}\n${taskGuide}`,
  },
};
