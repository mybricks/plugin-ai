import type { ChatChipFormatContext, ChatChipInstance, ElementTextUpdateChipData } from "../../../agent/src";
import { ELEMENT_TEXT_UPDATE_CHIP_TYPE } from "../../../agent/src";
import {
  buildElementRepeatContextInfo,
  createChatChipId,
  extractDomSummary,
  getElementCodeLocation,
  indentText,
} from "./dom-info";

export { ELEMENT_TEXT_UPDATE_CHIP_TYPE };

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

/**
 * 创建一个文本元素修改 chip 实例。
 *
 * @param ele     需要修改文案的目标元素
 * @param content 用户期望写入的新文案
 * @param label   目标元素的显示名称（可选）
 */
export function createElementTextUpdateChip(
  ele: Element,
  content: string,
  label?: string
): ChatChipInstance {
  const data: ElementTextUpdateChipData = { ele, label, content };
  const chipLabel = `修改「${label ?? ele.tagName}」文案`;
  return {
    id: createChatChipId(),
    type: ELEMENT_TEXT_UPDATE_CHIP_TYPE,
    label: chipLabel,
    data,
  };
}

function getCurrentText(ele?: Element): string {
  const text = ele?.textContent?.trim().replace(/\s+/g, " ") ?? "";
  return text || "无可识别文本";
}

// ─── 格式化函数 ───────────────────────────────────────────────────────────────

/**
 * 格式化 element-text-update chip：将占位符替换为操作描述，
 * 并在消息末尾追加包含目标文本元素、新文案和结构信息的上下文块，供 LLM 理解文本修改操作。
 */
export function formatElementTextUpdateChipMessage({ message, chips }: ChatChipFormatContext): string {
  let resolved = message;
  const infoBlocks: string[] = [];
  let counter = 1;

  for (const chip of chips) {
    const data = chip.data as ElementTextUpdateChipData | undefined;
    const opId = counter++;
    const opLabel = `文本修改操作${opId}`;

    if (!data) {
      resolved = resolved.split(`[[chip:${chip.id}]]`).join(`执行「${opLabel}」，`);
      continue;
    }

    const { ele, label, content } = data;
    const name = label ?? ele?.tagName ?? "目标文本元素";
    const nextText = content ?? "";

    // 行内占位符替换为 "执行文本修改操作N，"，与下方说明块的 id 对应
    resolved = resolved
      .split(`[[chip:${chip.id}]]`)
      .join(`执行「${opLabel}」，`);

    const codeLocation = getElementCodeLocation(ele);
    const currentText = getCurrentText(ele);
    const domSummary = ele ? extractDomSummary(ele) : "无";
    const { hasRepeatContext, block: repeatContextBlock } = buildElementRepeatContextInfo(ele);

    const changeRequirements = [
      `1. 只修改【目标文本元素】对应的文案内容，不重写无关 JSX 结构`,
      `2. 将目标文案改为【目标新文案】中给出的完整内容；如果包含换行，按现有项目文本换行习惯处理（如 <br/> 或字符串换行）`,
      ...(hasRepeatContext
        ? [
            `3. 如果【目标文本元素】疑似位于循环 JSX / map 渲染中，默认只修改当前元素对应的数据项或条件分支，不要直接修改整个 map 模板导致全部同类项文案变化`,
          ]
        : []),
      `${hasRepeatContext ? 4 : 3}. 保持该元素的组件、属性、样式类名、事件绑定和相邻元素结构不变`,
      `${hasRepeatContext ? 5 : 4}. 不要因为只改文案而新增无关组件、状态或样式`,
    ];
    const notes = [
      ...(hasRepeatContext
        ? [
            `如果无法判断用户是要只修改当前这一项，还是修改循环 JSX 中的全部同类项，请先向用户确认，不要贸然改动整个 map/循环模板。`,
          ]
        : []),
      `如果无法在源码中可靠定位该文本，请用一句话向用户说明原因，不要修改任何代码。`,
    ];

    infoBlocks.push(
      [
        `<element-text-update-operation id="${opLabel}">`,
        `## 操作意图（${opLabel}）`,
        `用户触发了文本修改操作，请在 JSX 源码中把目标文本元素的文案改为指定新文案。`,
        ``,
        `## 目标文本元素`,
        `- 名称：${name}`,
        `- 代码位置：${codeLocation}`,
        `- 当前 DOM 文本：${currentText}`,
        repeatContextBlock,
        `- DOM 结构摘要：`,
        indentText(domSummary, "  "),
        ``,
        `## 目标新文案`,
        nextText || "（空文本）",
        ``,
        `## 修改要求`,
        ...changeRequirements,
        ``,
        `## 注意`,
        ...notes,
        `</element-text-update-operation>`,
      ].join("\n")
    );
  }

  if (infoBlocks.length === 0) return resolved;
  return `${resolved}\n\n${infoBlocks.join("\n\n")}`;
}
