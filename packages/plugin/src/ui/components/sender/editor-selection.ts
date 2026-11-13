/** A collapsed selection inside a direct text node of Sender's editor. */
export interface EditorTextCaret {
  range: Range;
  node: Text;
  offset: number;
  before: string;
}

/**
 * Shared caret lookup for textual triggers such as `@` mentions and `/`.
 * Inline entities keep their separate handling in inline-token.ts.
 */
export function getEditorTextCaret(editor: HTMLDivElement): EditorTextCaret | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;

  const range = selection.getRangeAt(0);
  if (!range.collapsed || !editor.contains(range.commonAncestorContainer)) return null;
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const node = range.startContainer as Text;
  const text = node.textContent ?? "";
  return {
    range,
    node,
    offset: range.startOffset,
    before: text.slice(0, range.startOffset),
  };
}

export function focusEditorAtEnd(editor: HTMLDivElement): void {
  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
