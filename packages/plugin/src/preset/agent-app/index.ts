import type { PluginAIParams } from "../../index";
import type { PromptSections } from "../../prompts";

import { agentAppPromptSection } from './sections'
export { agentAppPromptSection } from './sections'

export type PluginAIPreset = Partial<PluginAIParams>;

/**
 * 
 * @deprecated
 */
export function agentAppPromptBuilder(): PluginAIPreset {
  return {
    disallowedDebugEnvs: ["mock"],
    promptSections: {
      agent: agentAppPromptSection.agent,
      developeGuide: agentAppPromptSection.developeGuide,
      designGuide: agentAppPromptSection.designGuide,
      documentGuide: agentAppPromptSection.documentGuide,
    } satisfies PromptSections,
    virtualFiles: async (context) => {
      const libraryDocsSection = await context.getEffectiveLibrariesSection();

      return [
        {
          path: ".agent/agent.md",
          content: [
            agentAppPromptSection.root.metaSection,
            '# 开发宪章',
            agentAppPromptSection.root.guideSection,
            '## 工程架构',
            agentAppPromptSection.root.architectureSection,
            "## 可用的三方库",
            libraryDocsSection,
            '# 可视化Skill & Tool 开发规范',
            'TODO',
            '#服务端开发',
            'TODO'
          ].filter(Boolean).join("\n\n"),
          permissions: { read: true, write: false, delete: false },
          visible: false,
        },
      ];
    },
  };
}
