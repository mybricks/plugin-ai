import { domInfoI18n as copy } from "./dom-info.i18n";
import type { ChatChipFormatContext, ChatChipInstance } from "../../../agent/src";
import { createChatChipId } from "./chip-id";
import { lang } from "../i18n";

export { createChatChipId };

export const DOM_CHIP_TYPE = "dom";

/** 单段文本在 DOM 摘要中的最大字符数 */
const DOM_SUMMARY_SINGLE_TEXT_MAX = 20;
/** 选区 DOM 摘要总最大字符数，超出时裁剪中间部分 */
const DOM_SUMMARY_TOTAL_MAX = 300;
const DOM_SUMMARY_MAX_CHILDREN = 8;
const REPEAT_CONTEXT_MAX_DEPTH = 10;
const REPEAT_CONTEXT_MAX_SIBLINGS = 200;
const DOM_SUMMARY_CLASS_MAX = 3;

const DOM_SUMMARY_SKIP_CHILDREN_TAGS = new Set(["svg"]);
const DOM_SUMMARY_SKIP_TAGS = new Set([
  "defs",
  "desc",
  "filter",
  "foreignobject",
  "g",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "pattern",
  "radialgradient",
  "script",
  "style",
  "symbol",
  "template",
  "title",
  "use",
]);
const DOM_SUMMARY_SKIP_SVG_DRAWING_TAGS = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "stop",
]);
const DOM_SUMMARY_NON_PAGE_CODE_ATTRS = ["data-mybricks-tip"];

interface DomLoc {
  codeLine?: { start?: number; end?: number };
  files?: { jsx?: string; less?: string };
}

interface RepeatSignature {
  key: string;
  reason: string;
}

interface RepeatAncestorContext {
  node: Element;
  index?: number;
  total: number;
  signature?: RepeatSignature;
  skipped?: boolean;
}

export function createDomChip(focus?: AiServiceFocusParams): ChatChipInstance {
  return {
    id: createChatChipId(),
    type: DOM_CHIP_TYPE,
    // 注意用 || 而非 ??：宿主可能传空字符串 title，?? 不会回退默认文案。
    label: focus?.focusArea?.title || focus?.title || lang.chat.focusElement(),
    data: { ele: focus?.focusArea?.ele },
  };
}

export function matchDefaultDomFocusContent(input: { message: string; chips: ChatChipInstance[] }): boolean {
  const match = input.message.match(/^(?:对于\[\[chip:([^\]]+)\]\]|(?:For \[\[chip:([^\]]+)\]\]|About \[\[chip:([^\]]+)\]\]:))$/);
  if (!match) return false;

  const chip = input.chips.find((item) => item.id === (match[1] ?? match[2] ?? match[3]));
  return chip?.type === DOM_CHIP_TYPE;
}

function shouldSkipDomSummaryChildren(node: Element): boolean {
  return DOM_SUMMARY_SKIP_CHILDREN_TAGS.has(node.tagName.toLowerCase());
}

function shouldSkipDomSummaryNode(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  return (
    DOM_SUMMARY_NON_PAGE_CODE_ATTRS.some((attr) => node.hasAttribute(attr)) ||
    DOM_SUMMARY_SKIP_TAGS.has(tag) ||
    (node.namespaceURI === "http://www.w3.org/2000/svg" && DOM_SUMMARY_SKIP_SVG_DRAWING_TAGS.has(tag))
  );
}

function splitClassNames(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDomSummaryClassNames(node: Element): string {
  const selectorClassNames = safeParseJson<string[]>(node.getAttribute("data-zone-selector"));
  if (Array.isArray(selectorClassNames) && selectorClassNames.length) {
    return selectorClassNames.filter(Boolean).slice(0, DOM_SUMMARY_CLASS_MAX).join(" ");
  }

  const zoneClassNames = node.getAttribute("data-zone-classnames");
  if (zoneClassNames?.trim()) {
    return splitClassNames(zoneClassNames).slice(0, DOM_SUMMARY_CLASS_MAX).join(" ");
  }

  const loc = getOwnDomLoc<DomLoc & { cn?: string[] }>(node);
  if (loc?.cn?.length) {
    return loc.cn.filter(Boolean).slice(0, DOM_SUMMARY_CLASS_MAX).join(" ");
  }

  return "";
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
  if (shouldSkipDomSummaryNode(el)) return copy.noSummary();

  const singleTextMax = options?.singleTextMax ?? DOM_SUMMARY_SINGLE_TEXT_MAX;
  const totalMax = options?.totalMax ?? DOM_SUMMARY_TOTAL_MAX;
  const lines: string[] = [];

  function walk(node: Element, indent: number) {
    if (shouldSkipDomSummaryNode(node)) return;

    const tag = node.tagName.toLowerCase();
    const text = Array.from(node.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, singleTextMax);
    const cls = getDomSummaryClassNames(node);
    const comName = node.getAttribute("data-com-name") || "";
    const parts: string[] = [tag];
    if (cls) parts.push(` class: ${cls}`);
    if (comName) parts.push(copy.component(comName));
    if (text) parts.push(copy.text(text));
    const desc = parts.join("");
    lines.push("  ".repeat(indent) + desc);
    if (indent < 3 && !shouldSkipDomSummaryChildren(node)) {
      const visibleChildren = Array.from(node.children).filter((child) => !shouldSkipDomSummaryNode(child));
      visibleChildren
        .slice(0, DOM_SUMMARY_MAX_CHILDREN)
        .forEach((child) => walk(child, indent + 1));
      if (visibleChildren.length > DOM_SUMMARY_MAX_CHILDREN) {
        lines.push("  ".repeat(indent + 1) + `... ${visibleChildren.length - DOM_SUMMARY_MAX_CHILDREN} more children`);
      }
    }
  }

  walk(el, 0);
  let result = lines.join("\n");
  if (result.length <= totalMax) return result;
  const half = Math.floor((totalMax - 30) / 2);
  result =
    result.slice(0, half) + `\n... [${copy.omitted()}] ...\n` + result.slice(result.length - half);
  return result;
}

function safeParseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (_) {
    return undefined;
  }
}

function getOwnDomLoc<T extends DomLoc>(el: Element): T | undefined {
  return safeParseJson<T>(el.getAttribute("data-loc"));
}

function getClosestDomLoc<T extends DomLoc>(el: Element): T | undefined {
  let current: Element | null = el;
  while (current) {
    const loc = safeParseJson<T>(current.getAttribute("data-loc"));
    if (loc) return loc;
    current = current.parentElement;
  }
  return undefined;
}

export function getElementCodeLocation(el?: Element): string {
  if (!el) return copy.unknown();

  const loc = getClosestDomLoc<DomLoc>(el);
  if (!loc) return copy.unknown();

  const jsxFile = loc.files?.jsx;
  const startLine = loc.codeLine?.start;
  const endLine = loc.codeLine?.end;

  if (!jsxFile && !startLine) return copy.unknown();

  const lineDesc =
    startLine && endLine && endLine !== startLine
      ? `L${startLine}-L${endLine}`
      : startLine
      ? `L${startLine}`
      : copy.unknownLine();

  return jsxFile ? `${jsxFile} ${lineDesc}` : lineDesc;
}

function formatCodeLoc(loc: DomLoc): string | null {
  const jsxFile = loc.files?.jsx;
  const startLine = loc.codeLine?.start;
  const endLine = loc.codeLine?.end;
  if (!jsxFile || !startLine) return null;
  if (endLine && endLine !== startLine) return `${jsxFile}:L${startLine}-L${endLine}`;
  return `${jsxFile}:L${startLine}`;
}

function normalizeZoneSelectorValue(value: string | null): string {
  if (!value) return "";
  const parsed = safeParseJson<string[]>(value);
  if (Array.isArray(parsed)) return parsed.filter(Boolean).join(" ");
  return value.trim();
}

function getRepeatSignature(el: Element, cache: WeakMap<Element, RepeatSignature | null>): RepeatSignature | null {
  if (cache.has(el)) return cache.get(el) ?? null;

  const loc = getOwnDomLoc<DomLoc>(el);
  const locText = loc ? formatCodeLoc(loc) : null;
  if (locText) {
    const signature = {
      key: `loc:${locText}`,
      reason: copy.sameLocation(locText),
    };
    cache.set(el, signature);
    return signature;
  }

  const comName = el.getAttribute("data-com-name")?.trim() ?? "";
  const zoneSelector = normalizeZoneSelectorValue(el.getAttribute("data-zone-selector"));

  if (comName && zoneSelector) {
    const signature = {
      key: `com+selector:${comName}:${zoneSelector}`,
      reason: copy.sameComponentSelector(comName, zoneSelector),
    };
    cache.set(el, signature);
    return signature;
  }

  if (zoneSelector) {
    const signature = {
      key: `selector:${zoneSelector}`,
      reason: copy.sameSelector(zoneSelector),
    };
    cache.set(el, signature);
    return signature;
  }

  if (comName) {
    const signature = {
      key: `com:${comName}`,
      reason: copy.sameComponent(comName),
    };
    cache.set(el, signature);
    return signature;
  }

  cache.set(el, null);
  return null;
}

function findNearestSignatureAnchor(
  el: Element,
  cache: WeakMap<Element, RepeatSignature | null>
): { el: Element; signature: RepeatSignature } | null {
  let node: Element | null = el;
  while (node) {
    if (node.getAttribute("data-zone-type") === "page") break;
    const signature = getRepeatSignature(node, cache);
    if (signature) return { el: node, signature };
    node = node.parentElement;
  }
  return null;
}

function getElementPath(root: Element, target: Element): number[] | null {
  const path: number[] = [];
  let node: Element | null = target;

  while (node && node !== root) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.children, node);
    if (index < 0) return null;
    path.unshift(index);
    node = parent;
  }

  return node === root ? path : null;
}

function getElementByPath(root: Element, path: number[]): Element | null {
  let node: Element | null = root;
  for (const index of path) {
    const child: Element | undefined = node.children[index];
    if (!isDomElement(child)) return null;
    node = child;
  }
  return node;
}

function detectRepeatCandidate(
  candidate: Element,
  anchorEl: Element,
  anchorSignature: RepeatSignature,
  cache: WeakMap<Element, RepeatSignature | null>
): RepeatAncestorContext | null {
  const parent = candidate.parentElement;
  if (!parent) return null;

  const anchorPath = getElementPath(candidate, anchorEl);
  if (!anchorPath) return null;

  const children = Array.from(parent.children);

  if (children.length > REPEAT_CONTEXT_MAX_SIBLINGS) {
    return {
      node: candidate,
      total: children.length,
      signature: anchorSignature,
      skipped: true,
    };
  }

  const sameTemplateSiblings = children.filter((child) => {
    const siblingAnchor = child === candidate ? anchorEl : getElementByPath(child, anchorPath);
    return !!siblingAnchor && getRepeatSignature(siblingAnchor, cache)?.key === anchorSignature.key;
  });

  if (sameTemplateSiblings.length <= 1) return null;

  const index = sameTemplateSiblings.indexOf(candidate);
  if (index === -1) return null;

  return {
    node: candidate,
    index: index + 1,
    total: sameTemplateSiblings.length,
    signature: anchorSignature,
  };
}

function collectRepeatAncestorContexts(el: Element): RepeatAncestorContext[] {
  const contexts: RepeatAncestorContext[] = [];
  const signatureCache = new WeakMap<Element, RepeatSignature | null>();
  const anchor = findNearestSignatureAnchor(el, signatureCache);
  if (!anchor) return [];

  let node: Element | null = anchor.el;
  let depth = 0;

  while (node && depth < REPEAT_CONTEXT_MAX_DEPTH) {
    if (node.getAttribute("data-zone-type") === "page") break;

    const context = detectRepeatCandidate(node, anchor.el, anchor.signature, signatureCache);
    if (context) contexts.push(context);

    node = node.parentElement;
    depth += 1;
  }

  return contexts.reverse();
}

function formatRepeatContexts(contexts: RepeatAncestorContext[], indent = " - "): string[] {
  if (!contexts.length) return [];

  const lines: string[] = [];

  contexts.forEach((context, index) => {
    const loopLabel = copy.loop(index + 1, contexts.length);
    const signature = context.signature;
    const reason = signature ? copy.reason(signature.reason) : "";

    if (context.skipped) {
      lines.push(`${indent}${copy.skipped(loopLabel, context.total, REPEAT_CONTEXT_MAX_SIBLINGS, reason)}`);
      return;
    }

    if (context.index) {
      lines.push(`${indent}${copy.item(loopLabel, context.index, context.total, reason)}`);
    } else {
      lines.push(`${indent}${copy.possibleLoop(loopLabel, reason)}`);
    }
  });

  lines.push(`${indent}${copy.loopCaution()}`);
  return lines;
}

export function formatElementRepeatContextLines(el: Element, indent = " - "): string[] {
  return formatRepeatContexts(collectRepeatAncestorContexts(el), indent);
}

export interface ElementRepeatContextInfo {
  lines: string[];
  hasRepeatContext: boolean;
  block: string;
}

export function buildElementRepeatContextInfo(el?: Element): ElementRepeatContextInfo {
  const lines = el ? formatElementRepeatContextLines(el, `- `) : [];
  const hasRepeatContext = lines.length > 0;
  const block = hasRepeatContext
    ? [`- ${copy.repeatTitle()}`, ...lines.map((line) => `  ${line}`)].join("\n")
    : `- ${copy.noRepeat()}`;

  return { lines, hasRepeatContext, block };
}

function getDomClassNames(el: Element): string {
  const attrClassNames = el.getAttribute("data-zone-classnames");
  if (attrClassNames?.trim()) return attrClassNames;

  const loc = getClosestDomLoc<DomLoc & { cn?: string[] }>(el);
  if (loc?.cn?.length) return loc.cn.join(",");

  return copy.none();
}

function getDomCodeLocation(el: Element): string {
  const loc = getClosestDomLoc<DomLoc>(el);
  const jsxFile = loc?.files?.jsx;
  const lessFile = loc?.files?.less;
  const startLine = loc?.codeLine?.start;
  const endLine = loc?.codeLine?.end;

  if (!jsxFile && !lessFile && !startLine && !endLine) return copy.unknown();

  const codeLine =
    startLine && endLine
      ? startLine === endLine
        ? `L${startLine}`
        : `L${startLine} - L${endLine}`
      : startLine
      ? `L${startLine}`
      : endLine
      ? `L${endLine}`
      : copy.unknownLine();
  const jsxText = copy.location(jsxFile, codeLine);
  const lessText = lessFile ? copy.less(lessFile) : "";

  return `${jsxText}${lessText}`;
}

function buildDomChipInfo(label: string, params: { ele?: Element; displayName?: string; info?: string }): string {
  const { ele, displayName, info } = params;

  // 展示名与条目标签相同时不重复写，保持模型文本精简（还原侧会回退到条目标签）。
  // 注意：该行格式被 agent 侧 restoreDisplayUserMessage 的解析正则依赖，勿随意改动。
  const displayNameLine = displayName && displayName !== label ? [` - 节点展示名： ${displayName}`] : [];

  if (info) {
    // 兼容旧版只包含子条目的 info，以及首行包含当前节点描述的新格式。
    const infoText = /^\s*-\s/.test(info) ? `- @${label}：\n${info}` : `- @${label}：${info}`;
    return [infoText, ...displayNameLine].join("\n");
  }

  if (!ele) {
    return [
      `- @${label}：${copy.unknown()}`,
      ...displayNameLine,
      `  - ${copy.summaryTitle()}${copy.unknown()}`,
      `  - ${copy.codeTitle()}${copy.unknown()}`,
    ].join("\n");
  }

  const repeatContextLines = formatRepeatContexts(collectRepeatAncestorContexts(ele));
  const summary = extractDomSummary(ele);
  return [
    `- @${label}：${summary.split("\n")[0]}`,
    ...displayNameLine,
    `  - ${copy.summaryTitle()}`,
    indentText(summary, "    "),
    `  - ${copy.codeTitle()}${getDomCodeLocation(ele)}`,
    ...repeatContextLines.map((line) => ` ${line}`),
  ].join("\n");
}

export function indentText(text: string, indent: string): string {
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
  const typeDesc = copy.focusType(type);
  // let selectors: string[] = [];
  // try {
  //   selectors = JSON.parse(el.getAttribute("data-zone-selector") ?? "[]");
  // } catch (error) {
  //   // ignore parse error
  // }
  const domSummary = extractDomSummary(el);
  const metaLines: string[] = [];
  // if (selectors.length > 0) metaLines.push(`类名：${selectors.join(" ")}`);
  metaLines.push(copy.focusCode(getDomCodeLocation(el)));
  metaLines.push(...formatRepeatContexts(collectRepeatAncestorContexts(el), ""));
  const metaStr = metaLines.length > 0 ? `\n${metaLines.join("\n")}` : "";
  return `<focus-attention>
${copy.focusAttention(typeDesc)}
${metaStr}
${copy.focusSummary()}
${domSummary}
</focus-attention>
  `.trim();
}

/**
 * 格式化 dom chip：把占位符替换成 @Dom节点N（zone 元素用 zone label），并追加节点说明。
 * 同一个 HTMLElement 引用会合并为同一个标签。
 *
 * 输入框 chip.label 不参与行内替换，只写入条目内的「节点展示名」行：
 * 服务端会话只保存组装文本，刷新后 restoreDisplayUserMessage 从该行
 * 还原 chip 展示文案，模型侧文案保持不变。
 */
export function formatDomChipMessage({ message, chips }: ChatChipFormatContext): string {
  const eleToLabel = new Map<Element | undefined, string>();
  const labelToInfo = new Map<string, { ele?: Element; displayName?: string; info?: string }>();
  let counter = 1;
  const zoneChipMap = new Map()

  for (const chip of chips) {
    const ele = getChipElement(chip);
    if (!eleToLabel.has(ele)) {
      let zoneChip

      try {
        const dataZoneChip = ele?.getAttribute("data-zone-chip")
        if (dataZoneChip) {
          zoneChip = JSON.parse(dataZoneChip)
        }
      } catch {}

      if (zoneChip) {
        const { type } = zoneChip
        if (!zoneChipMap.has(type)) {
          zoneChipMap.set(type, new Set([zoneChip]))
        } else {
          zoneChipMap.get(type).add(zoneChip)
        }
      }

      const label = (zoneChip?.label || "").trim() || copy.node(counter++);
      // 展示名回退链：chip.label（输入框文案）→ zone label；都没有时不写展示名行。
      const displayName = chip.label?.trim() || (zoneChip?.label || "").trim() || undefined;
      eleToLabel.set(ele, label);
      labelToInfo.set(label, {
        ele,
        ...(displayName ? { displayName } : {}),
        ...(chip.data?.info ? { info: chip.data.info as string } : {}),
      });
    }
  }

  let resolved = message;
  for (const chip of chips) {
    const ele = getChipElement(chip);
    const label = eleToLabel.get(ele) ?? copy.node();
    // 行内占位符替换为 @节点名，让被引用实体在正文中一眼可辨，与文件 chip 的 @文件名 保持一致
    resolved = resolved.split(`[[chip:${chip.id}]]`).join(` @${label} `);
  }
  resolved = normalizeDomChipSpacing(resolved);

  // Dom 节点说明用语义标签包裹，与正文显式分层，避免被当成待排查的任务。
  const domInfo = labelToInfo.size === 0 ? '' : `\n\n<referenced-dom-nodes note="${copy.note()}">\n${
    Array.from(labelToInfo).map(([label, { ele, displayName, info }]) => {
      return buildDomChipInfo(label, { ele, displayName, info })
    }).join("\n")
  }\n</referenced-dom-nodes>`

  const zoneChipInfo = zoneChipMap.size === 0 ? '' : Array.from(zoneChipMap).map(([type, chipSet]) => {
    return `\n\n<referenced-nodes type="${type}" note="${copy.zoneNote(type)}">\n${Array.from(chipSet).map(({ info }: any) => {
      return info
    }).join("\n")}\n</referenced-nodes>`
  }).join('')

  // 注意：<user_query> 的包裹由 agent.ts 在 chip format 之前统一处理，此处只负责 @ 替换与
  // 追加实体说明块，追加的块会落在 </user_query> 之外，成为与正文平级的兄弟节点。
  return `${resolved}${domInfo}${zoneChipInfo}`
}

function normalizeDomChipSpacing(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/ +([，。！？；：,.!?;:])/g, "$1")
    .replace(/([（([{]) +/g, "$1")
    .trim();
}

function getChipElement(chip: ChatChipInstance): Element | undefined {
  const ele = chip.data?.ele;
  return isDomElement(ele) ? ele : undefined;
}

/**
 * `instanceof Element` 只能在同一个 Window 中生效，使用元素所属的
 * window，确保 iframe 中创建的 chip 元素也能通过判断。
 */
function isDomElement(value: unknown): value is Element {
  if (!value || typeof value !== "object") return false;

  const ownerDocument = (value as { ownerDocument?: Document }).ownerDocument;
  const ElementConstructor = ownerDocument?.defaultView?.Element;
  return typeof ElementConstructor === "function" && value instanceof ElementConstructor;
}
