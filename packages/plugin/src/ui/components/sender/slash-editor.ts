import { focusEditorAtEnd, getEditorTextCaret } from "./editor-selection";
import { hasSenderInlineToken } from "./inline-token";
import { createSlashTemplateToken } from "./slash-token";
import type { SenderPromptTemplateSlashCommand } from "./slash-command";

export interface SlashMenuInput {
  /** Slash query at the caret (`""` for a bare `/`). `null` when not in a trigger. */
  query: string | null;
}

export function getSlashTriggerAtCaret(editor: HTMLDivElement): { query: string; range: Range } | null {
  const caret = getEditorTextCaret(editor);
  if (!caret) return null;
  const match = caret.before.match(/^\/([^\s/]*)$/);
  if (!match) return null;

  const range = document.createRange();
  range.setStart(caret.node, 0);
  range.setEnd(caret.node, caret.offset);
  return { query: match[1] ?? "", range };
}

export function readSlashMenuInput(editor: HTMLDivElement | null): SlashMenuInput {
  if (!editor || hasSenderInlineToken(editor, "slash")) return { query: null };
  return { query: getSlashTriggerAtCaret(editor)?.query ?? null };
}

/** Insert the single allowed template token at the active editor selection. */
export function insertSlashTemplateToken(
  editor: HTMLDivElement,
  command: SenderPromptTemplateSlashCommand,
  args = "",
): boolean {
  if (hasSenderInlineToken(editor, "slash")) return false;

  const token = createSlashTemplateToken(
    command.reference as `mbs-template:${string}`,
    command.displayName ?? command.name,
  );
  const suffix = document.createTextNode(args ? ` ${args}` : " ");
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (range && editor.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(token);
    range.setStartAfter(token);
    range.collapse(true);
    range.insertNode(suffix);
    range.setStartAfter(suffix);
    range.setEndAfter(suffix);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else {
    editor.append(token, suffix);
    focusEditorAtEnd(editor);
  }
  return true;
}

export function selectSlashTemplateCommand(editor: HTMLDivElement, command: SenderPromptTemplateSlashCommand): boolean {
  if (hasSenderInlineToken(editor, "slash")) return false;
  const trigger = getSlashTriggerAtCaret(editor);
  if (!trigger) return false;

  trigger.range.deleteContents();
  trigger.range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(trigger.range);
  return insertSlashTemplateToken(editor, command);
}
