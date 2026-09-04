import type { ChatChipInstance } from "../../../../../agent/src";

/** MyBricks chat chip 的私有剪贴板格式。 */
export const MCHIP_CLIPBOARD_MIME = "application/x-mchip+json";
/** Chromium 的 Async Clipboard API 对 Web 自定义格式要求的命名。 */
const WEB_MCHIP_CLIPBOARD_MIME = `web ${MCHIP_CLIPBOARD_MIME}`;
const NON_TRANSFERABLE_CHIP_TYPES = new Set(["dom"]);

export interface MChipClipboardContent {
  /** 输入框原始文本，保留 [[chip:id]] 占位符。 */
  message: string;
  /** 用户消息元信息；其中 meta.chips 用于重新渲染 chip。 */
  meta?: Record<string, any> & { chips?: ChatChipInstance[] };
}

interface MChipClipboardPayload extends MChipClipboardContent {
  version: 1;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getClipboardChips(meta?: Record<string, any>): ChatChipInstance[] {
  if (!Array.isArray(meta?.chips)) return [];
  return meta.chips.filter((chip): chip is ChatChipInstance => (
    isRecord(chip) &&
    typeof chip.id === "string" && chip.id.length > 0 &&
    typeof chip.type === "string" && chip.type.length > 0 &&
    typeof chip.label === "string"
  ));
}

/**
 * DOM chip 依赖运行时 HTMLElement，经过剪贴板 JSON 化后没有可信上下文。
 * 将它从 meta.chips 移除并降级为 label 纯文本，确保不会进入后续 format / 发送链路。
 */
function removeInvalidPastedChips(content: MChipClipboardContent): MChipClipboardContent {
  const chips = getClipboardChips(content.meta);
  const invalidChips = new Map(
    chips
      .filter((chip) => NON_TRANSFERABLE_CHIP_TYPES.has(chip.type))
      .map((chip) => [chip.id, chip])
  );
  if (!invalidChips.size) return content;

  return {
    message: content.message.replace(/\[\[chip:([^\]]+)\]\]/g, (placeholder, id: string) => {
      const chip = invalidChips.get(id);
      return chip ? chip.label : placeholder;
    }),
    meta: {
      ...content.meta,
      chips: chips.filter((chip) => !invalidChips.has(chip.id)),
    },
  };
}

/** 外部应用只能取得 text/plain，因此将内部占位符转换为用户可见的 chip 标签。 */
export function getMchipPlainText({ message, meta }: MChipClipboardContent): string {
  const chips = new Map(getClipboardChips(meta).map((chip) => [chip.id, chip]));
  return message.replace(/\[\[chip:([^\]]+)\]\]/g, (placeholder, id: string) => {
    return chips.get(id)?.label ?? placeholder;
  });
}

function serializeMchipClipboard(content: MChipClipboardContent): string | null {
  try {
    const payload: MChipClipboardPayload = {
      version: 1,
      message: content.message,
      ...(content.meta ? { meta: content.meta } : {}),
    };
    return JSON.stringify(payload);
  } catch {
    // meta 可能包含循环引用或 BigInt。此时仍应保证普通文本复制可用。
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function getMchipHtml(plainText: string, serialized: string): string {
  return `<span data-mchip="${encodeURIComponent(serialized)}">${escapeHtml(plainText)}</span>`;
}

/** 写入普通文本和 mchip 私有格式。若宿主不支持自定义 MIME，退化为普通文本。 */
export async function writeMchipClipboard(content: MChipClipboardContent): Promise<void> {
  const plainText = getMchipPlainText(content);
  const serialized = serializeMchipClipboard(content);

  if (serialized && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    const plainTextBlob = new Blob([plainText], { type: "text/plain" });
    const htmlBlob = new Blob([getMchipHtml(plainText, serialized)], { type: "text/html" });
    const mchipBlob = new Blob([serialized], { type: MCHIP_CLIPBOARD_MIME });

    try {
      // Electron / 原生 clipboard bridge 通常可直接保留 application/x-mchip+json。
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": plainTextBlob, "text/html": htmlBlob, [MCHIP_CLIPBOARD_MIME]: mchipBlob }),
      ]);
      return;
    } catch {
      // Chromium Web Custom Formats 需要 web 前缀，系统中的其他应用会自动忽略它。
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": plainTextBlob, "text/html": htmlBlob, [WEB_MCHIP_CLIPBOARD_MIME]: mchipBlob }),
        ]);
        return;
      } catch {
        // 没有自定义格式支持时，保留 HTML data attribute 作为同应用粘贴的回退。
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "text/plain": plainTextBlob, "text/html": htmlBlob }),
          ]);
          return;
        } catch {
          // 下方再退化为 writeText。
        }
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  throw new Error("Clipboard API is unavailable");
}

/** 从 paste 事件中读取并校验 mchip 私有格式。 */
function parseMchipClipboard(serialized: string): MChipClipboardContent | null {
  if (!serialized) return null;

  try {
    const payload: unknown = JSON.parse(serialized);
    if (!isRecord(payload) || payload.version !== 1 || typeof payload.message !== "string") {
      return null;
    }
    if (payload.meta !== undefined && !isRecord(payload.meta)) return null;

    return removeInvalidPastedChips({
      message: payload.message,
      ...(payload.meta ? { meta: payload.meta } : {}),
    });
  } catch {
    return null;
  }
}

/** 先从 paste 事件读取，Electron 等宿主会在这里直接提供自定义 MIME。 */
export function readMchipClipboard(data: DataTransfer): MChipClipboardContent | null {
  const customContent = parseMchipClipboard(
    data.getData(MCHIP_CLIPBOARD_MIME) || data.getData(WEB_MCHIP_CLIPBOARD_MIME)
  );
  if (customContent) return customContent;

  const html = data.getData("text/html");
  if (!html) return null;
  const encoded = new DOMParser()
    .parseFromString(html, "text/html")
    .body.querySelector("[data-mchip]")?.getAttribute("data-mchip");
  if (!encoded) return null;

  try {
    return parseMchipClipboard(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}
