import type { ChatChipFormatContext, ChatChipInstance, ElementMoveChipData } from "../../../agent/src";
import { ELEMENT_MOVE_CHIP_TYPE } from "../../../agent/src";
import {
  createChatChipId,
  extractDomSummary,
  getElementCodeLocation,
  indentText,
} from "./dom-info";

export { ELEMENT_MOVE_CHIP_TYPE };

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 拖拽方向文案映射 */
const PLACEMENT_LABEL: Record<string, string> = {
  before: "前面（上方）",
  after: "后面（下方）",
};

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

/**
 * 创建一个元素移动 chip 实例。
 *
 * @param fromEle  被拖拽元素
 * @param toEle    参照元素
 * @param placement 移动方向（"before" | "after"）
 * @param fromLabel 被拖拽元素的显示名称（可选）
 * @param toLabel   参照元素的显示名称（可选）
 */
export function createElementMoveChip(
  fromEle: Element,
  toEle: Element,
  placement: "before" | "after",
  fromLabel?: string,
  toLabel?: string
): ChatChipInstance {
  const data: ElementMoveChipData = { fromEle, toEle, placement, fromLabel, toLabel };
  const direction = PLACEMENT_LABEL[placement] ?? placement;
  const label = `将「${fromLabel ?? fromEle.tagName}」移到「${toLabel ?? toEle.tagName}」${direction}`;
  return {
    id: createChatChipId(),
    type: ELEMENT_MOVE_CHIP_TYPE,
    label,
    data,
  };
}

// ─── 格式化函数 ───────────────────────────────────────────────────────────────

/**
 * 格式化 element-move chip：将占位符替换为操作描述，
 * 并在消息末尾追加包含被拖拽元素和参照元素的结构信息块，供 LLM 理解拖拽操作的上下文。
 */
export function formatElementMoveChipMessage({ message, chips }: ChatChipFormatContext): string {
  let resolved = message;
  const infoBlocks: string[] = [];
  let counter = 1;

  for (const chip of chips) {
    const data = chip.data as ElementMoveChipData | undefined;
    const opId = counter++;
    const opLabel = `元素移动操作${opId}`;

    if (!data) {
      resolved = resolved.split(`[[chip:${chip.id}]]`).join(`执行「${opLabel}」，`);
      continue;
    }

    const { fromEle, toEle, placement, fromLabel, toLabel } = data;
    const direction = PLACEMENT_LABEL[placement] ?? placement;
    const from = fromLabel ?? fromEle?.tagName ?? "被拖拽元素";
    const to = toLabel ?? toEle?.tagName ?? "参照元素";

    // 行内占位符替换为 "执行元素移动操作N，"，与下方说明块的 id 对应
    resolved = resolved
      .split(`[[chip:${chip.id}]]`)
      .join(`执行「${opLabel}」，`);

    // 追加详细上下文块
    const fromCode = getElementCodeLocation(fromEle);
    const toCode = getElementCodeLocation(toEle);
    const fromSummary = fromEle ? extractDomSummary(fromEle) : "无";
    const toSummary = toEle ? extractDomSummary(toEle) : "无";
    const changeRequirements = [
      `1. 只移动【被拖拽元素】的 JSX 节点（含其完整子树），不修改任何属性或样式`,
      `2. 将【被拖拽元素】放到【参照元素】的${direction}`,
      `3. 保持其余元素的顺序和缩进不变`,
      `4. 如果两个元素在不同父容器中，请自行判断最合理的移动方案`,
    ];
    const notes = [
      `如果你认为此操作不合法，请用一句话向用户说明原因，不要修改任何代码。`,
    ];

    infoBlocks.push(
      [
        `<element-move-operation id="${opLabel}" direction="${direction}">`,
        `## 操作意图（${opLabel}）`,
        `用户通过拖拽，将【被拖拽元素】移动到【参照元素】的${direction}，请在 JSX 源码中完成对应的顺序调整。`,
        ``,
        `## 被拖拽元素（需要移动）`,
        `- 名称：${from}`,
        `- 代码位置：${fromCode}`,
        `- DOM 结构摘要：`,
        indentText(fromSummary, "  "),
        ``,
        `## 参照元素（位置不变，作为锚点）`,
        `- 名称：${to}`,
        `- 代码位置：${toCode}`,
        `- DOM 结构摘要：`,
        indentText(toSummary, "  "),
        ``,
        `## 修改要求`,
        ...changeRequirements,
        ``,
        `## 注意`,
        ...notes,
        `</element-move-operation>`,
      ].join("\n")
    );
  }

  if (infoBlocks.length === 0) return resolved;
  return `${resolved}\n\n${infoBlocks.join("\n\n")}`;
}
