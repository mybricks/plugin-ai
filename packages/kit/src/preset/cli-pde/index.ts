import type { CodeAgentPlugin } from "../../../../agent/src";
import type { PromptSections } from "../../prompts";
import identitySection from "./identitySection.md";
import taskGuide from "./taskGuide.md";
import usingToolsSection from "./usingToolsSection.md";

/** CLI PDE owns its task, review, and audit documents under this directory. */
const CLI_PDE_CONFIG_DIR_NAME = ".lingchuang";

export const cliPdePromptSection = {
  agent: {
    identitySection,
    usingToolsSection: `${usingToolsSection}\n${taskGuide}`,
  },
} satisfies PromptSections;

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
  plugins?: CodeAgentPlugin[];
}

type CliPdeAgentOptionBuilderResult<T extends CliPdeAgentOptionBuilderOptions> =
  Omit<T, "configDirName" | "promptSections" | "plugins"> & {
    configDirName: string;
    promptSections: PromptSections;
    plugins: CodeAgentPlugin[];
  };

/**
 * Builds PluginAI options for the CLI PDE preset without discarding host options.
 * Callers may still override individual prompt sections or use another config
 * directory.
 */
export function cliPdeAgentOptionBuilder<T extends CliPdeAgentOptionBuilderOptions>(
  options: T,
): CliPdeAgentOptionBuilderResult<T> {
  const { configDirName, plugins, promptSections, ...restOptions } = options;

  return {
    ...restOptions,
    configDirName: configDirName ?? CLI_PDE_CONFIG_DIR_NAME,
    promptSections: cliPdePromptSection,
    plugins: [...(plugins ?? [])],
  } as CliPdeAgentOptionBuilderResult<T>;
}
