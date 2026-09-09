import { getFrontmatterString, splitFrontmatter } from "../utils/frontmatter";

/** The places a slash command may be discovered from. */
export type PromptTemplateScope = "config" | "plugin" | "project" | "builtin";

/**
 * A prompt template packaged in memory, mirroring SkillFile's virtual-file
 * shape. PROMPT.md is the required entry point; template files stay in plugin
 * memory and are not injected into the Agent sandbox.
 */
export interface PromptTemplateFile {
  /** Stable identifier used in `[$mbs-template:<name>]` records. */
  name: string;
  /** Programmatic fallback when PROMPT.md does not declare displayName. */
  displayName?: string;
  files: Array<{
    path: string;
    content: string;
  }>;
}

export interface PromptTemplate {
  name: string;
  displayName: string;
  description: string;
  content: string;
  scope: PromptTemplateScope;
}

const TEMPLATE_ENTRY_FILE = "PROMPT.md";

export function getPromptTemplateEntry(template: PromptTemplateFile): { path: string; content: string } | undefined {
  return template.files.find((file) => file.path === TEMPLATE_ENTRY_FILE);
}

/** Parse the template metadata without expanding its prompt body. */
export function resolvePromptTemplate(
  template: PromptTemplateFile,
  scope: PromptTemplateScope = "config",
): PromptTemplate {
  const entry = getPromptTemplateEntry(template);
  if (!entry) {
    throw new Error(`PROMPT.md not found in prompt template "${template.name}".`);
  }

  const { fmText, body } = splitFrontmatter(entry.content);
  // Keep `name` stable and machine-readable. The author-facing label belongs
  // in PROMPT.md so packaged templates can provide Chinese display names.
  const displayName =
    getFrontmatterString(fmText, "displayName") ??
    template.displayName ??
    getFrontmatterString(fmText, "name") ??
    template.name;
  const description =
    getFrontmatterString(fmText, "description") ??
    body.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    displayName;

  return {
    name: template.name,
    displayName,
    description,
    content: body,
    scope,
  };
}

/**
 * Expand arguments in a prompt template.
 *
 * `$@` is the full trimmed argument string. `$1`, `$2`, ... address positional
 * whitespace-separated arguments. Unknown positional arguments expand to an
 * empty string.
 */
export function expandPromptTemplate(template: PromptTemplate, args: string): string {
  const normalizedArgs = args.trim();
  const positional = normalizedArgs ? normalizedArgs.split(/\s+/) : [];
  return template.content
    .replace(/\$@/g, normalizedArgs)
    .replace(/\$(\d+)/g, (_match, value: string) => positional[Number(value) - 1] ?? "");
}
