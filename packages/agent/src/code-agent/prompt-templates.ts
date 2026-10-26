import { getFrontmatterString, splitFrontmatter } from "../utils/frontmatter";

/** The places a slash command may be discovered from. */
export type PromptTemplateScope = "config" | "plugin" | "project" | "builtin";

/**
 * A prompt template packaged in memory, mirroring SkillFile's virtual-file
 * shape. PROMPT.md is the required default entry point; PROMPT.<locale>.md
 * files optionally override its metadata and body for a locale. Template files
 * stay in plugin memory and are not injected into the Agent sandbox.
 */
export interface PromptTemplateFile {
  /** Stable identifier used in `[$mbs-template:<name>]` records. */
  name: string;
  /** Programmatic fallback when Markdown files do not declare displayName. */
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
const TEMPLATE_LOCALE_FILE_PATTERN = /^PROMPT\.([a-z]{2,3}(?:[-_][a-z0-9]{2,8})*)\.md$/i;

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, "-").toLowerCase();
}

function getLocaleEntry(template: PromptTemplateFile, locale: string): { path: string; content: string } | undefined {
  const normalizedLocale = normalizeLocale(locale);
  const localeParts = normalizedLocale.split("-");
  const candidates = localeParts.map((_part, index) => localeParts.slice(0, localeParts.length - index).join("-"));

  for (const candidate of candidates) {
    const entry = template.files.find((file) => {
      const match = file.path.match(TEMPLATE_LOCALE_FILE_PATTERN);
      return match ? normalizeLocale(match[1]!) === candidate : false;
    });
    if (entry) return entry;
  }
  return undefined;
}

export function getPromptTemplateEntry(template: PromptTemplateFile): { path: string; content: string } | undefined {
  return template.files.find((file) => file.path === TEMPLATE_ENTRY_FILE);
}

/** Parse the template metadata without expanding its prompt body. */
export function resolvePromptTemplate(
  template: PromptTemplateFile,
  scope: PromptTemplateScope = "config",
  locale = "zh",
): PromptTemplate {
  const defaultEntry = getPromptTemplateEntry(template);
  if (!defaultEntry) {
    throw new Error(`PROMPT.md not found in prompt template "${template.name}".`);
  }

  const localeEntry = getLocaleEntry(template, locale);
  const { fmText: defaultFmText, body: defaultBody } = splitFrontmatter(defaultEntry.content);
  const { fmText: localeFmText, body: localeBody } = localeEntry
    ? splitFrontmatter(localeEntry.content)
    : { fmText: "", body: "" };

  // PROMPT.md is the complete default. A locale file only overrides fields it
  // declares and supplies a body when it has non-whitespace content.
  const body = localeBody.trim() ? localeBody : defaultBody;

  // Keep `name` stable and machine-readable. Labels are presentation metadata.
  const displayName =
    getFrontmatterString(localeFmText, "displayName") ??
    getFrontmatterString(localeFmText, "name") ??
    getFrontmatterString(defaultFmText, "displayName") ??
    template.displayName ??
    getFrontmatterString(defaultFmText, "name") ??
    template.name;
  const description =
    getFrontmatterString(localeFmText, "description") ??
    getFrontmatterString(defaultFmText, "description") ??
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
