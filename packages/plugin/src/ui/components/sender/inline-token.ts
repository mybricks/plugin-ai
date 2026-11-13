/** The shared DOM shape of Sender's independently-owned inline entities. */
export type SenderInlineTokenKind = "chip" | "slash";

export interface SenderInlineToken {
  kind: SenderInlineTokenKind;
  element: HTMLSpanElement;
}

export function getSenderInlineToken(node: Node): SenderInlineToken | null {
  if (!(node instanceof HTMLSpanElement)) return null;
  if (node.dataset.chipId) return { kind: "chip", element: node };
  if (node.dataset.slashTemplateReference) return { kind: "slash", element: node };
  return null;
}

/** Locate the immediate Sender entity beside a collapsed editor selection. */
export function getAdjacentSenderInlineToken(
  editor: HTMLDivElement,
  range: Range,
  direction: "backward" | "forward",
): SenderInlineToken | null {
  if (!range.collapsed) return null;

  const container = direction === "backward" ? range.startContainer : range.endContainer;
  const offset = direction === "backward" ? range.startOffset : range.endOffset;
  let target: ChildNode | null = null;

  if (container === editor) {
    target = direction === "backward" ? editor.childNodes[offset - 1] ?? null : editor.childNodes[offset] ?? null;
  } else if (container.nodeType === Node.TEXT_NODE && container.parentNode === editor) {
    const textLength = container.textContent?.length ?? 0;
    if (direction === "backward" && offset === 0) target = container.previousSibling;
    if (direction === "forward" && offset === textLength) target = container.nextSibling;
  }

  return target ? getSenderInlineToken(target) : null;
}

export function hasSenderInlineToken(editor: ParentNode, kind: SenderInlineTokenKind): boolean {
  return kind === "chip"
    ? !!editor.querySelector("[data-chip-id]")
    : !!editor.querySelector("[data-slash-template-reference]");
}

/** DOM cleanup shared by slash and chip; each owner clears its own metadata. */
export function removeSenderInlineToken(editor: HTMLDivElement, token: HTMLSpanElement): void {
  token.parentNode?.removeChild(token);
  editor.normalize();
}
