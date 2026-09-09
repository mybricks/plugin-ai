import type { ChatChipInstance } from "../../../../../agent/src";
import { getSenderInlineToken } from "./inline-token";
import { getSlashTemplateRecord } from "./slash-token";

export interface SenderSerializedContent {
  message: string;
  chips: ChatChipInstance[];
}

/** Serialize Sender's editable DOM into its two independent wire protocols. */
export function serializeSenderContent(
  editor: HTMLDivElement,
  chipMap: Map<string, ChatChipInstance>,
): SenderSerializedContent {
  const chips: ChatChipInstance[] = [];
  let message = "";
  editor.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      message += node.textContent ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const token = getSenderInlineToken(node);
    if (token?.kind === "slash") {
      message += getSlashTemplateRecord(node) ?? node.innerText;
      return;
    }
    if (token?.kind !== "chip") return;

    const chipId = token.element.dataset.chipId;
    const chip = chipId ? chipMap.get(chipId) : undefined;
    if (!chip) return;
    chips.push(chip);
    message += `[[chip:${chipId}]]`;
  });
  return { message, chips };
}

/** Convert selected slash tokens to their durable MBS text during copy. */
export function serializeCopiedSenderContent(
  fragment: DocumentFragment,
): { text: string; containsSlashToken: boolean } {
  let containsSlashToken = false;
  const readNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return Array.from(node.childNodes).map(readNode).join("");

    const token = getSenderInlineToken(node);
    if (token?.kind === "slash") {
      const slashRecord = getSlashTemplateRecord(node);
      if (!slashRecord) return Array.from(node.childNodes).map(readNode).join("");
      containsSlashToken = true;
      return slashRecord;
    }
    return Array.from(node.childNodes).map(readNode).join("");
  };
  return { text: Array.from(fragment.childNodes).map(readNode).join(""), containsSlashToken };
}
