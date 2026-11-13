import type { ChatChipInstance } from "../../../../../agent/src";
import { getSenderInlineToken } from "./inline-token";
import { getSlashTemplateRecord } from "./slash-token";

export interface SenderSerializedContent {
  message: string;
  chips: ChatChipInstance[];
}

interface SenderDomWalk {
  message: string;
  chips: ChatChipInstance[];
  containsSlashToken: boolean;
}

/** contentEditable 中浏览器自行产生的块级容器（Enter / 多行 insertText 粘贴）。 */
const BLOCK_TAGS = new Set(["DIV", "P"]);

/**
 * 按行内语义遍历 Sender 编辑器 DOM：文本原样输出；<br> 与块级容器边界输出为 \n；
 * chip / slash token 按各自的 wire 协议展开。
 *
 * 浏览器在 Shift+Enter、多行粘贴（execCommand("insertText") 按 \n 拆块）时
 * 会产生 <br> / <div> 结构，序列化必须识别它们，否则换行后的内容会被整段丢弃。
 */
function walkSenderContent(
  parent: Node,
  /** 传 null 表示不解析 chip 协议（复制路径），chip 按普通行内元素取可见文本。 */
  chipMap: Map<string, ChatChipInstance> | null,
): SenderDomWalk {
  const result: SenderDomWalk = { message: "", chips: [], containsSlashToken: false };

  /** 新行仅在已有内容时补充，避免编辑器占位 <br> / 尾部空块产生多余空行。 */
  const appendNewline = () => {
    if (result.message && !result.message.endsWith("\n")) result.message += "\n";
  };

  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result.message += node.textContent ?? "";
        return;
      }
      if (!(node instanceof HTMLElement)) return;

      const token = getSenderInlineToken(node);
      if (token?.kind === "slash") {
        const record = getSlashTemplateRecord(node);
        if (record) {
          result.containsSlashToken = true;
          result.message += record;
          return;
        }
        walk(node);
        return;
      }
      if (token?.kind === "chip" && chipMap) {
        const chipId = token.element.dataset.chipId;
        const chip = chipId ? chipMap.get(chipId) : undefined;
        if (chip) {
          result.chips.push(chip);
          result.message += `[[chip:${chipId}]]`;
          return;
        }
      }

      if (node instanceof HTMLBRElement) {
        appendNewline();
        return;
      }
      if (BLOCK_TAGS.has(node.tagName)) {
        appendNewline();
        walk(node);
        return;
      }
      walk(node);
    });
  };

  walk(parent);
  return result;
}

/** Serialize Sender's editable DOM into its two independent wire protocols. */
export function serializeSenderContent(
  editor: HTMLDivElement,
  chipMap: Map<string, ChatChipInstance>,
): SenderSerializedContent {
  const { message, chips } = walkSenderContent(editor, chipMap);
  return { message, chips };
}

/** Convert selected slash tokens to their durable MBS text during copy. */
export function serializeCopiedSenderContent(
  fragment: DocumentFragment,
): { text: string; containsSlashToken: boolean } {
  const { message, containsSlashToken } = walkSenderContent(fragment, null);
  return { text: message, containsSlashToken };
}
