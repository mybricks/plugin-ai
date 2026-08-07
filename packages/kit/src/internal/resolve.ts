import { MYBRICKS_PROMPT_SECTIONS } from "../prompts/mybricks";
import type { CodeAgentPromptOptions } from "@mybricks/agent";
import type { PromptSections } from "../prompts";

/** 将外部 promptSections 与 kit 内置默认值按 section 深度合并。 */
export function resolveDefaultPromptSections(input?: PromptSections): Required<PromptSections> {
  const D = MYBRICKS_PROMPT_SECTIONS;
  const result: any = {};
  for (const key of Object.keys(D) as (keyof typeof D)[]) {
    result[key] = { ...D[key], ...input?.[key as keyof PromptSections] };
  }
  return result;
}

/** 将 promptSections 转换为 CodeAgent 所需的 promptOptions。 */
export function promptSectionsAdaptToPromptOption(input?: PromptSections): CodeAgentPromptOptions {
  return resolveDefaultPromptSections(input).agent;
}
