import type { ChatChipFormatContext, ChatChipInstance } from "../../../agent/src";

/** 单段文本在 DOM 摘要中的最大字符数 */
const DOM_SUMMARY_SINGLE_TEXT_MAX = 20;
/** 选区 DOM 摘要总最大字符数，超出时裁剪中间部分 */
const DOM_SUMMARY_TOTAL_MAX = 300;

interface DomLoc {
  codeLine?: { start?: number; end?: number };
  files?: { jsx?: string; less?: string };
}

/**
 * 从 DOM 元素提取结构化摘要，用于描述用户选区，控制 token 消耗。
 * - 按层级输出 tag、class、role 及文本摘要，不输出完整 HTML。
 * - 单段文本会截断到一定长度；若总长度超出上限，会裁剪中间部分并插入省略提示。
 */
export function extractDomSummary(
  el: Element,
  options?: { singleTextMax?: number; totalMax?: number }
): string {
  const singleTextMax = options?.singleTextMax ?? DOM_SUMMARY_SINGLE_TEXT_MAX;
  const totalMax = options?.totalMax ?? DOM_SUMMARY_TOTAL_MAX;
  const lines: string[] = [];

  function walk(node: Element, indent: number) {
    const tag = node.tagName.toLowerCase();
    const text = Array.from(node.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, singleTextMax);
    let cls = "";
    try {
      const parsed: string[] = JSON.parse(node.getAttribute("data-zone-selector") ?? "[]");
      cls = parsed.slice(0, 3).join(" ");
    } catch (_) {
      // ignore
    }
    const comName = node.getAttribute("data-com-name") || "";
    const parts: string[] = [tag];
    if (cls) parts.push(`(${cls})`);
    if (comName) parts.push(` 组件: ${comName}`);
    if (text) parts.push(`文本: "${text}"`);
    const desc = parts.join("");
    lines.push("  ".repeat(indent) + desc);
    if (indent < 3) {
      Array.from(node.children)
        .slice(0, 8)
        .forEach((child) => walk(child, indent + 1));
      if (node.children.length > 8) {
        lines.push("  ".repeat(indent + 1) + `... ${node.children.length - 8} more children`);
      }
    }
  }

  walk(el, 0);
  let result = lines.join("\n");
  if (result.length <= totalMax) return result;
  const half = Math.floor((totalMax - 30) / 2);
  result =
    result.slice(0, half) + "\n... [中间内容已省略] ...\n" + result.slice(result.length - half);
  return result;
}

/**
 * 若当前聚焦处于「列表」中（兄弟节点拥有相同的 data-com-name 或 data-zone-selector），
 * 返回当前项在列表中的序号与总数；否则返回 null。
 */
export function getListFocusIndex(el: Element): { index: number; total: number } | null {
  for (const attrKey of ["data-com-name", "data-zone-selector"] as const) {
    const itemEl = el.closest(`[${attrKey}]`);
    if (!itemEl) continue;

    const parent = itemEl.parentElement;
    if (!parent) continue;

    const value = itemEl.getAttribute(attrKey);
    if (value == null) continue;

    const siblings = Array.from(parent.children).filter(
      (child) => child.getAttribute(attrKey) === value
    );
    if (siblings.length <= 1) continue;

    const index = siblings.indexOf(itemEl);
    if (index === -1) continue;
    return { index: index + 1, total: siblings.length };
  }
  return null;
}

function safeParseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (_) {
    return undefined;
  }
}

function getDomClassNames(el: Element): string {
  const attrClassNames = el.getAttribute("data-zone-classnames");
  if (attrClassNames?.trim()) return attrClassNames;

  const loc = safeParseJson<DomLoc & { cn?: string[] }>(el.getAttribute("data-loc"));
  if (loc?.cn?.length) return loc.cn.join(",");

  return "无";
}

function getDomCodeLocation(el: Element): string {
  const loc = safeParseJson<DomLoc>(el.getAttribute("data-loc"));
  const jsxFile = loc?.files?.jsx;
  const lessFile = loc?.files?.less;
  const startLine = loc?.codeLine?.start;
  const endLine = loc?.codeLine?.end;

  if (!jsxFile && !lessFile && !startLine && !endLine) return "未知";

  const codeLine =
    startLine && endLine
      ? startLine === endLine
        ? `L${startLine}`
        : `L${startLine} - L${endLine}`
      : startLine
      ? `L${startLine}`
      : endLine
      ? `L${endLine}`
      : "未知行";
  const jsxText = jsxFile ? `位于${jsxFile}的${codeLine}` : `位于未知文件的${codeLine}`;
  const lessText = lessFile ? `，相关的less文件为${lessFile}` : "";

  return `${jsxText}${lessText}`;
}

function buildDomChipInfo(label: string, ele?: Element): string {
  if (!ele) {
    return [
      `- ${label}：`,
      " - 相关类名：未知",
      " - 代码位置：未知",
      " - 该区域到叶子节点的Dom结构摘要：未知",
    ].join("\n");
  }

  return [
    `- ${label}：`,
    ` - 相关类名：${getDomClassNames(ele)}`,
    ` - 代码位置：${getDomCodeLocation(ele)}`,
    " - 该区域到叶子节点的Dom结构摘要：",
    indentText(extractDomSummary(ele), "   "),
  ].join("\n");
}

function indentText(text: string, indent: string): string {
  return text
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
}

/**
 * 根据当前聚焦的 DOM 元素生成完整的选区信息文本（含组件名、列表序号、DOM 摘要），
 * 用于填入 agent 的上下文。
 */
export function buildFocusInfo(el: Element): string {
  const type = el.getAttribute("data-zone-type") ?? "";
  let typeDesc = "区域";
  if (type === "page") {
    typeDesc = "页面";
  } else if (type === "com") {
    typeDesc = "组件";
  } else if (type === "popup") {
    typeDesc = "弹层";
  }
  let selectors: string[] = [];
  try {
    selectors = JSON.parse(el.getAttribute("data-zone-selector") ?? "[]");
  } catch (error) {
    // ignore parse error
  }
  const domSummary = extractDomSummary(el);
  const listInfo = getListFocusIndex(el);
  const listInfoLine = listInfo ? `（第 ${listInfo.index} 项 / 共 ${listInfo.total} 项）` : "";
  const metaLines: string[] = [];
  if (selectors.length > 0) metaLines.push(`类名：${selectors.join(" ")}`);
  metaLines.push(`文件定位：${getDomCodeLocation(el)}`);
  const metaStr = metaLines.length > 0 ? `\n${metaLines.join("\n")}` : "";
  return `<focus-attention>
注意：用户当前聚焦到了一个${typeDesc}${listInfoLine}。上面的需求大概率和这部分聚焦区域有关联，尽量不超出此聚焦区域。
${metaStr}
以下是该区域到子节点的 DOM 结构摘要，用于辅助定位问题：
${domSummary}
</focus-attention>
  `.trim();
}

/**
 * 格式化 dom chip：把占位符替换成 Dom节点N，并追加节点说明。
 * 同一个 HTMLElement 引用会合并为同一个 Dom节点N。
 */
export function formatDomChipMessage({ message, chips }: ChatChipFormatContext): string {
  const eleToLabel = new Map<Element | undefined, string>();
  const labelToInfo = new Map<string, { ele?: Element }>();
  let counter = 1;

  for (const chip of chips) {
    const ele = getChipElement(chip);
    if (!eleToLabel.has(ele)) {
      const label = `Dom节点${counter++}`;
      eleToLabel.set(ele, label);
      labelToInfo.set(label, { ele });
    }
  }

  let resolved = message;
  for (const chip of chips) {
    const ele = getChipElement(chip);
    const label = eleToLabel.get(ele) ?? "Dom节点";
    resolved = resolved.split(`[[chip:${chip.id}]]`).join(label);
  }

  if (labelToInfo.size === 0) return resolved;

  const infoLines = Array.from(labelToInfo).map(([label, { ele }]) => buildDomChipInfo(label, ele));
  return `${resolved}\n\nDom节点说明：\n${infoLines.join("\n")}`;
}

function getChipElement(chip: ChatChipInstance): Element | undefined {
  if (typeof Element === "undefined") return undefined;
  return chip.data?.ele instanceof Element ? chip.data.ele : undefined;
}
