/**
 * contentEditable 删除紧邻非编辑 chip 前的最后一个文本节点时，
 * 浏览器可能会在编辑器开头补一个 <br> 作为光标占位，形成：
 *   <br><span data-chip-id="..." contenteditable="false">...</span>
 *
 * 这个 <br> 不属于用户输入，也不会被 serializeEditorContent 识别，
 * 但会真实参与排版，导致 chip 前方出现一行空白。
 *
 * 只移除 editor 开头且紧挨 chip 的占位换行，避免影响用户在中间主动输入的换行。
 */
export function removeLeadingPlaceholderBreakBeforeChip(editor: HTMLDivElement) {
  let changed = false;

  while (true) {
    const first = editor.firstChild;
    if (first?.nodeType === Node.TEXT_NODE && !(first.textContent ?? "").length) {
      editor.removeChild(first);
      changed = true;
      continue;
    }

    if (first?.nodeName === "BR" && isChipNode(nextMeaningfulSibling(first))) {
      editor.removeChild(first);
      changed = true;
      continue;
    }

    break;
  }

  if (changed) {
    editor.normalize();
  }
}

function isChipNode(node: ChildNode | null): node is HTMLSpanElement {
  return node instanceof HTMLSpanElement && Boolean(node.dataset.chipId);
}

function nextMeaningfulSibling(node: ChildNode): ChildNode | null {
  let next = node.nextSibling;
  while (next?.nodeType === Node.TEXT_NODE && !(next.textContent ?? "").length) {
    next = next.nextSibling;
  }
  return next;
}
