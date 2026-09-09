import { expandPromptTemplate, resolvePromptTemplate } from "./prompt-templates";
import type { PromptTemplateFile, PromptTemplateScope } from "./prompt-templates";

/**
 * Stable MBS records are plain text and survive history export/copy/paste.
 * A template marker may sit beside chip placeholders; chip formatting may wrap
 * the user text in `<user_query>` before expansion runs.
 */
export type MbsReference = `mbs-template:${string}`;

export interface MbsTemplateRecord {
  reference: MbsReference;
  args: string;
}

const MBS_TEMPLATE_MARKER = /\[\$(mbs-template:[^\]\s]+)\]/;

function findMbsTemplateMarker(input: string): { reference: MbsReference; index: number; length: number } | null {
  const match = MBS_TEMPLATE_MARKER.exec(input);
  if (!match || match.index === undefined) return null;
  return {
    reference: match[1] as MbsReference,
    index: match.index,
    length: match[0].length,
  };
}

/** Parse a whole-message durable MBS record, as used by copy/paste. */
export function parseMbsTemplateRecord(input: string): MbsTemplateRecord | null {
  const trimmed = input.trim();
  const marker = findMbsTemplateMarker(trimmed);
  if (!marker || marker.index !== 0) return null;
  const after = trimmed.slice(marker.length);
  if (after.length > 0 && !/^\s/.test(after)) return null;
  return { reference: marker.reference, args: after.replace(/^\s+/, "") };
}

/** The MBS metadata that a UI may turn into its own slash-menu entry. */
export interface MbsTemplateDescriptor {
  type: "template";
  /** Stable identifier used by the MBS record. */
  name: string;
  /** UI label, normally read from `PROMPT.md` frontmatter. */
  displayName: string;
  description: string;
  scope: PromptTemplateScope;
  reference: MbsReference;
}

export interface MbsTemplate {
  descriptor: MbsTemplateDescriptor;
  template: ReturnType<typeof resolvePromptTemplate>;
}

export function collectPluginPromptTemplates(
  plugins: Array<{ name: string; promptTemplates?: PromptTemplateFile[] }>,
  enabledNames: Set<string>,
): Array<{ template: PromptTemplateFile; scope: "plugin" }> {
  return plugins
    .filter((plugin) => enabledNames.has(plugin.name))
    .flatMap((plugin) => plugin.promptTemplates ?? [])
    .map((template) => ({ template, scope: "plugin" as const }));
}

/** Resolve plugin template files into MBS descriptors. Invalid or duplicate names are skipped. */
export function createMbsTemplates(
  templates: Array<{ template: PromptTemplateFile; scope: PromptTemplateScope }>,
): MbsTemplate[] {
  const names = new Set<string>();
  const result: MbsTemplate[] = [];
  for (const { template, scope } of templates) {
    let resolved;
    try {
      resolved = resolvePromptTemplate(template, scope);
    } catch (error) {
      console.warn(`[CodeAgent] skipped prompt template "${template.name}":`, error);
      continue;
    }
    if (names.has(resolved.name)) {
      console.warn(`[CodeAgent] skipped duplicate MBS template name: ${resolved.name}`);
      continue;
    }
    names.add(resolved.name);
    result.push({
      descriptor: {
        type: "template",
        name: resolved.name,
        displayName: resolved.displayName,
        description: resolved.description,
        scope: resolved.scope,
        reference: `mbs-template:${resolved.name}`,
      },
      template: resolved,
    });
  }
  return result;
}

/**
 * Replace the first durable MBS marker with its expanded prompt.
 * Arguments stop at `</user_query>` so chip-formatted tails stay outside the
 * template body.
 */
export function expandMbsTemplateMessage(input: string, templates: MbsTemplate[]): string | null {
  const marker = findMbsTemplateMarker(input);
  if (!marker) return null;
  const template = templates.find((item) => item.descriptor.reference === marker.reference);
  if (!template) return null;

  const afterMarker = input.slice(marker.index + marker.length);
  const userQueryClose = afterMarker.indexOf("</user_query>");
  const args = userQueryClose >= 0 ? afterMarker.slice(0, userQueryClose) : afterMarker;
  const suffix = userQueryClose >= 0 ? afterMarker.slice(userQueryClose) : "";
  return `${input.slice(0, marker.index)}${expandPromptTemplate(template.template, args)}${suffix}`;
}
