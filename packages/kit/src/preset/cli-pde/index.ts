import { type CodeAgentPlugin, type CodeAgentPluginInput, type Tool } from "../../../../agent/src";
import type { PromptSections } from "../../prompts";
import identitySection from "./identity-section.md";
import usingToolsSection from "./using-tools-section.md";
import gitPushSkill from "./git-push/SKILL.md";
import { createTaskFirstPlugin } from "../../plugins/task-first";
import { createImpactDocumentPlugin } from "../../plugins/impact-document";
import type { ProjectRunnerImplementation } from "../../plugins/dev-env-prep";
import { createEnvGuidePlugin } from "../../plugins/env-guide";
import { createCanvasInfoPlugin } from "./canvas-info";
import devEnvPrep from "./dev-env-prep.md";

/** CLI PDE owns its task, review, and audit documents under this directory. */
const CLI_PDE_CONFIG_DIR_NAME = ".lingchuang";

export const cliPdePromptSection = {
  agent: {
    identitySection,
    usingToolsSection,
  },
} satisfies PromptSections;

/** CLI PDE 内置插件：提供代码推送技能。 */
export const cliPdePlugin = {
  name: "cli-pde-plugin",
  skills: [
    {
      name: "git-push",
      displayName: "推送代码",
      files: [
        {
          path: "SKILL.md",
          content: gitPushSkill,
        },
        {
          path: "SKILL.en.md",
          content: `---
displayName: Push code
description: Commit and push current changes to the remote branch
---`,
        },
      ],
    },
  ],
} satisfies CodeAgentPlugin;

/**
 * PluginAI fields consumed by this preset. Extra PluginAI configuration is
 * preserved through the generic builder result, avoiding a Kit → Plugin type
 * dependency cycle.
 */
interface CliPdeAgentOptionBuilderOptions {
  /** PluginAI instances require an isolated storage namespace. */
  key: string;
  configDirName?: string;
  promptSections?: PromptSections;
  plugins?: CodeAgentPluginInput[];
  /** 追加到 CLI PDE 的工具；ask_questions 始终由 preset 内置。 */
  tools?: Tool[];
  /** 「开发环境指南」的 project-runner 实现；不传时不注册 env-guide 插件。 */
  projectRunnerImplementation?: ProjectRunnerImplementation;
}

type CliPdeAgentOptionBuilderResult<T extends CliPdeAgentOptionBuilderOptions> =
  Omit<T, "mask" | "configDirName" | "promptSections" | "plugins" | "tools" | "projectRunnerImplementation"> & {
    mask: { maxTurns: number };
    configDirName: string;
    promptSections: PromptSections;
    plugins: CodeAgentPluginInput[];
    tools: Tool[];
  };

/**
 * Builds PluginAI options for the CLI PDE preset without discarding host options.
 * Callers may still override individual prompt sections or use another config
 * directory.
 */
export function cliPdeAgentOptionBuilder<T extends CliPdeAgentOptionBuilderOptions>(
  options: T,
): CliPdeAgentOptionBuilderResult<T> {
  const { configDirName, plugins, tools, projectRunnerImplementation, ...restOptions } = options;
  const resolvedConfigDirName = configDirName ?? CLI_PDE_CONFIG_DIR_NAME;

  return {
    ...restOptions,
    mask: { maxTurns: 10 },
    configDirName: resolvedConfigDirName,
    promptSections: {
      ...cliPdePromptSection,
      agent: {
        ...cliPdePromptSection.agent,
        identitySection: cliPdePromptSection.agent.identitySection.replace(
          "<dev-env-prep>",
          () => projectRunnerImplementation ? devEnvPrep.replaceAll("dev-env-prep", "env-guide") : "",
        ),
      },
    },
    plugins: [
      cliPdePlugin,
      createCanvasInfoPlugin(),
      ...(projectRunnerImplementation ? [createEnvGuidePlugin({ projectRunnerImplementation })] : []),
      createTaskFirstPlugin(),
      createImpactDocumentPlugin({ configDirName: resolvedConfigDirName }),
      ...(plugins ?? []),
    ],
    tools: tools ?? [],
  } as CliPdeAgentOptionBuilderResult<T>;
}
