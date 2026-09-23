import { Tools, type CodeAgentPlugin, type Tool } from "../../../../agent/src";
import type { PromptSections } from "../../prompts";
import identitySection from "./identitySection.md";
import taskGuide from "./taskGuide.md";
import usingToolsSection from "./usingToolsSection.md";
import REVOKE_TASK_PROMPT from "./revoke-task.md";
import GIT_PUSH_PROMPT from "./git-push.md";

/** CLI PDE owns its task, review, and audit documents under this directory. */
const CLI_PDE_CONFIG_DIR_NAME = ".lingchuang";

export const cliPdePromptSection = {
  agent: {
    identitySection,
    usingToolsSection: `${usingToolsSection}\n${taskGuide}`,
  },
} satisfies PromptSections;

/** CLI PDE 内置插件：提供任务回滚、代码推送等与 TASKS.md 联动的 Prompt Templates。 */
export const cliPdePlugin = {
  name: "cli-pde-plugin",
  promptTemplates: [
    {
      name: "revoke-task",
      files: [
        {
          path: "PROMPT.md",
          content: REVOKE_TASK_PROMPT,
        },
      ],
    },
    {
      name: "git-push",
      files: [
        {
          path: "PROMPT.md",
          content: GIT_PUSH_PROMPT,
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
  plugins?: CodeAgentPlugin[];
  /** 追加到 CLI PDE 的工具；ask_questions 始终由 preset 内置。 */
  tools?: Tool[];
}

type CliPdeAgentOptionBuilderResult<T extends CliPdeAgentOptionBuilderOptions> =
  Omit<T, "configDirName" | "promptSections" | "plugins" | "tools"> & {
    configDirName: string;
    promptSections: PromptSections;
    plugins: CodeAgentPlugin[];
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
  const { configDirName, plugins, promptSections, tools, ...restOptions } = options;
  const askQuestionsTool = Tools.createAskQuestions();

  return {
    ...restOptions,
    configDirName: configDirName ?? CLI_PDE_CONFIG_DIR_NAME,
    promptSections: cliPdePromptSection,
    plugins: [cliPdePlugin, ...(plugins ?? [])],
    // CLI PDE 必须能够在 Ask / Plan 模式中向用户收集决策；同名调用方工具去重，
    // 以预设提供的交互实现为准，避免模型看到重复 function definition。
    tools: [
      askQuestionsTool,
      ...(tools ?? []).filter((tool) => tool.name !== askQuestionsTool.name),
    ],
  } as CliPdeAgentOptionBuilderResult<T>;
}
