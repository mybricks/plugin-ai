import type { PluginAIParams } from "../../index";
import type { PromptSections } from "../../prompts";
import { fullStackAppPromptSection } from './sections'

export { fullStackAppPromptSection } from './sections'

export type PluginAIPreset = Partial<PluginAIParams>;

export type FullStackAppDatabaseType = "PostgreSQL" | "MySQL";

export interface FullStackAppPromptBuilderOptions {
  dbType?: FullStackAppDatabaseType;
}

/**
 * 
 * @deprecated
 */
export function fullStackAppPromptBuilder(options: FullStackAppPromptBuilderOptions = {}): PluginAIPreset {
  const dbType = options.dbType ?? "PostgreSQL";

  return {
    disallowedDebugEnvs: ["mock"],
    promptSections: {
      agent: fullStackAppPromptSection.agent,
      developeGuide: fullStackAppPromptSection.developeGuide,
      designGuide: fullStackAppPromptSection.designGuide,
      documentGuide: fullStackAppPromptSection.documentGuide,
    } satisfies PromptSections,
    virtualFiles: async (context) => {
      const libraryDocsSection = await context.getEffectiveLibrariesSection();

      return [
        {
          path: ".agent/agent.md",
          content: [
            fullStackAppPromptSection.root.metaSection,
            '## 开发宪章',
            fullStackAppPromptSection.root.guideSection,
            '## 工程架构',
            fullStackAppPromptSection.root.architectureSection,
            "## 可用的三方库",
            libraryDocsSection,
          ].filter(Boolean).join("\n\n"),
          permissions: { read: true, write: false, delete: false },
          visible: false,
        },
        {
          path: "frontend/.agent/agent.md",
          content: [
            fullStackAppPromptSection.frontend.metaSection,
            '# 前端规范',
            fullStackAppPromptSection.frontend.guideSection,
            '## 资源使用规范',
            fullStackAppPromptSection.frontend.assetsUsageSection,
            '## 环境变量',
            fullStackAppPromptSection.frontend.environmentVariablesSection,
            '## JsDoc声明规范',
            fullStackAppPromptSection.frontend.jsDocUsageSection,
            '## 前端示例',
            fullStackAppPromptSection.frontend.examplesSection,
          ].filter(Boolean).join("\n\n"),
          permissions: { read: true, write: false, delete: false },
          visible: false,
        },
        {
          path: "backend/.agent/agent.md",
          content: [
            fullStackAppPromptSection.backend.metaSection,
            '# 服务端规范',
            fullStackAppPromptSection.backend.guideSection,
            '## 代码规范',
            fullStackAppPromptSection.backend.codeRulesSection,
            '## 环境变量',
            fullStackAppPromptSection.backend.environmentVariablesSection,
            "## 服务端框架",
            fullStackAppPromptSection.backend.honoUsageSection,
            dbType === "MySQL"
              ? fullStackAppPromptSection.backend.mysqlUsageSection
              : fullStackAppPromptSection.backend.pgUsageSection,
            '## 服务端示例',
            fullStackAppPromptSection.backend.examplesSection,
          ].filter(Boolean).join("\n\n"),
          permissions: { read: true, write: false, delete: false },
          visible: false,
        },
      ];
    },
  };
}
