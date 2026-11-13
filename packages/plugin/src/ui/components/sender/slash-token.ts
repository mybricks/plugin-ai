import tokenCss from "../mbs-template-token.less";

/**
 * Sender's visual form of a durable MBS template record.
 *
 * This is intentionally DOM-only: it has no ChatChipInstance, no chip map,
 * and is never included in `meta.chips`.
 */
const SLASH_TEMPLATE_REFERENCE_DATASET = "slashTemplateReference";

export function createSlashTemplateToken(
  reference: `mbs-template:${string}`,
  displayName: string,
): HTMLSpanElement {
  const token = document.createElement("span");
  token.contentEditable = "false";
  token.dataset[SLASH_TEMPLATE_REFERENCE_DATASET] = reference;
  token.className = tokenCss.token;
  token.textContent = `/${displayName}`;
  return token;
}

export function getSlashTemplateRecord(node: Node): string | null {
  if (!(node instanceof HTMLSpanElement)) return null;
  const reference = node.dataset[SLASH_TEMPLATE_REFERENCE_DATASET];
  return reference?.startsWith("mbs-template:") ? `[$${reference}]` : null;
}
