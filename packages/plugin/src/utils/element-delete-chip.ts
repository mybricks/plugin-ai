import type { ChatChipFormatContext, ChatChipInstance, ElementDeleteChipData } from "../../../agent/src";
import { ELEMENT_DELETE_CHIP_TYPE } from "../../../agent/src";
import {
  buildElementRepeatContextInfo,
  createChatChipId,
  extractDomSummary,
  getElementCodeLocation,
  indentText,
} from "./dom-info";

export { ELEMENT_DELETE_CHIP_TYPE };

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

/**
 * 创建一个元素删除 chip 实例。
 *
 * @param ele    被删除的目标元素
 * @param label  被删除元素的显示名称（可选）
 */
export function createElementDeleteChip(
  ele: Element,
  label?: string
): ChatChipInstance {
  const data: ElementDeleteChipData = { ele, label };
  const chipLabel = `删除「${label ?? ele.tagName}」`;
  return {
    id: createChatChipId(),
    type: ELEMENT_DELETE_CHIP_TYPE,
    label: chipLabel,
    data,
  };
}

// ─── 格式化函数 ───────────────────────────────────────────────────────────────

/**
 * 格式化 element-delete chip：将占位符替换为操作描述，
 * 并在消息末尾追加包含被删除元素结构信息的上下文块，供 LLM 理解删除操作的上下文。
 */
export function formatElementDeleteChipMessage({ message, chips }: ChatChipFormatContext): string {
  let resolved = message;
  const infoBlocks: string[] = [];
  let counter = 1;

  for (const chip of chips) {
    const data = chip.data as ElementDeleteChipData | undefined;
    const opId = counter++;
    const opLabel = `元素删除操作${opId}`;

    if (!data) {
      resolved = resolved.split(`[[chip:${chip.id}]]`).join(`执行「${opLabel}」，`);
      continue;
    }

    const { ele, label } = data;
    const name = label ?? ele?.tagName ?? "被删除元素";

    // 行内占位符替换为 "执行元素删除操作N，"，与下方说明块的 id 对应
    resolved = resolved
      .split(`[[chip:${chip.id}]]`)
      .join(`执行「${opLabel}」，`);

    // 追加详细上下文块
    const codeLocation = getElementCodeLocation(ele);
    const domSummary = ele ? extractDomSummary(ele) : "无";
    const { hasRepeatContext, block: repeatContextBlock } = buildElementRepeatContextInfo(ele);

    const changeRequirements = [
      `1. 从 JSX 中完整移除【被删除元素】节点（含其所有子节点）`,
      ...(hasRepeatContext
        ? [
            `2. 如果【被删除元素】疑似位于循环 JSX / map 渲染中，默认只删除当前元素对应的数据项或条件分支，不要直接删除整个 map/循环表达式或循环模板节点`,
          ]
        : []),
      `${hasRepeatContext ? 3 : 2}. 同时移除该元素相关的 import 语句（如该组件不再被使用）`,
      `${hasRepeatContext ? 4 : 3}. 同时移除该元素独有的样式类定义（如对应 CSS/Less 中仅被该元素使用的类）`,
      `${hasRepeatContext ? 5 : 4}. 保持其余元素的顺序、缩进和结构不变`,
    ];
    const notes = [
      ...(hasRepeatContext
        ? [
            `如果无法判断用户是要删除当前这一项，还是删除循环 JSX 中的全部同类项，请先向用户确认，不要贸然移除整个 map/循环结构。`,
          ]
        : []),
      `如果你认为此操作不合法（例如删除会导致父容器渲染异常），请用一句话向用户说明原因，不要修改任何代码。`,
    ];

    infoBlocks.push(
      [
        `<element-delete-operation id="${opLabel}">`,
        `## 操作意图（${opLabel}）`,
        `用户触发了删除操作，请在 JSX 源码中移除对应的元素节点（含其完整子树）。`,
        ``,
        `## 被删除元素`,
        `- 名称：${name}`,
        `- 代码位置：${codeLocation}`,
        repeatContextBlock,
        `- DOM 结构摘要：`,
        indentText(domSummary, "  "),
        ``,
        `## 修改要求`,
        ...changeRequirements,
        ``,
        `## 注意`,
        ...notes,
        `</element-delete-operation>`,
      ].join("\n")
    );
  }

  if (infoBlocks.length === 0) return resolved;
  return `${resolved}\n\n${infoBlocks.join("\n\n")}`;
}
