import type { ChatChipDef, ChatChipInstance } from "../../agent/src";
import type { LowCodeDesignerAPI, LowCodeFocusParams } from "./designer";
import { buildLowCodeDesignerContext } from "./project";

/** 低代码画布焦点在聊天输入框中的 chip 类型。 */
export const LOWCODE_FOCUS_CHIP_TYPE = "lowcode-focus";

interface LowCodeFocusChipData {
  api?: LowCodeDesignerAPI;
  focus: LowCodeFocusParams;
}

function createChipId(): string {
  return `lowcode-focus-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getFocusLabel(focus: LowCodeFocusParams): string {
  if (focus.focusArea?.title) return focus.focusArea.title;
  const type = focus.type ?? (focus.comId ? "uiCom" : "page");
  if (type === "page" || type === "section") {
    return focus.title ?? "未命名页面";
  }
  return focus.title ?? focus.comId ?? "未命名组件";
}

/** 创建当前低代码页面或组件的引用 chip。 */
export function createLowCodeFocusChip(api: LowCodeDesignerAPI | undefined, focus: LowCodeFocusParams): ChatChipInstance {
  return {
    id: createChipId(),
    type: LOWCODE_FOCUS_CHIP_TYPE,
    label: getFocusLabel(focus),
    data: { api, focus } satisfies LowCodeFocusChipData,
  };
}

/**
 * 保留用户正文中的引用标签，并把页面信息和按需 DSL 片段作为独立上下文块追加。
 * 这样 UI 是一个简洁 chip，模型收到的则是完整、稳定的低代码焦点信息。
 */
export const lowCodeFocusChipDef: ChatChipDef = {
  type: LOWCODE_FOCUS_CHIP_TYPE,
  format({ message, chips }) {
    let resolved = message;
    const blocks: string[] = [];
    for (const chip of chips) {
      const data = chip.data as LowCodeFocusChipData | undefined;
      if (!data?.focus) continue;
      resolved = resolved.replace(`[[chip:${chip.id}]]`, `@${chip.label}`);
      blocks.push(buildLowCodeDesignerContext(data.api, data.focus));
    }
    return blocks.length ? `${resolved}\n\n${blocks.join("\n\n")}` : resolved;
  },
};
