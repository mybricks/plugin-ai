import { ComponentsManager } from "../designer/components-manager";
import type { LowCodeDesignerAPI } from "../designer";
import { getPageOutline } from "./page";
import type { OutlineNode, PageSource, SourceNodeRecord } from "./types";

export function renderValue(value: any): string {
  if (value === undefined) return "";
  try { return JSON.stringify(value); } catch { return String(value); }
}

function header(node: OutlineNode, indent: string): string {
  const id = node.id ? ` id="${node.id}"` : "";
  const title = node.title ? ` title="${node.title}"` : "";
  const namespace = node.def?.namespace ? ` namespace="${ComponentsManager.getAbbreviation(node.def.namespace)}"` : "";
  const layout = node.layout ? ` layout=${renderValue(node.layout)}` : "";
  const style = node.style ? ` style=${renderValue(node.style)}` : "";
  return `${indent}<Com${id}${title}${namespace}${layout}${style}>`;
}

/** 从当前 JSON 临时构造逻辑行，不保存额外 DSL。 */
export function buildPageSource(page: OutlineNode | undefined): PageSource {
  if (!page) return { lines: [], nodes: [] };
  const lines: string[] = [];
  const nodes: SourceNodeRecord[] = [];
  const push = (line: string) => lines.push(line);
  const visit = (node: OutlineNode, level: number, parentId?: string, slotId?: string) => {
    const indent = "  ".repeat(level);
    const startLine = lines.length + 1;
    push(header(node, indent));
    for (const slot of node.slots ?? []) {
      push(`${indent}  <Slot id="${slot.id}"${slot.title ? ` title="${slot.title}"` : ""}${slot.layout ? ` layout=${renderValue(slot.layout)}` : ""}>`);
      for (const child of slot.components ?? []) visit(child, level + 2, node.id, slot.id);
      push(`${indent}  </Slot>`);
    }
    if (!(node.slots?.length) && node.components?.length) for (const child of node.components) visit(child, level + 1, node.id);
    push(`${indent}</Com>`);
    nodes.push({ id: node.id, title: node.title, namespace: node.def?.namespace ? ComponentsManager.getAbbreviation(node.def.namespace) : undefined, parentId, slotId, node, startLine, endLine: lines.length });
  };
  push(`<Page id="${page.id ?? ""}"${page.title ? ` title="${page.title}"` : ""}>`);
  for (const slot of page.slots ?? []) {
    push(`  <Slot id="${slot.id}"${slot.title ? ` title="${slot.title}"` : ""}${slot.layout ? ` layout=${renderValue(slot.layout)}` : ""}>`);
    for (const child of slot.components ?? []) visit(child, 2, page.id, slot.id);
    push("  </Slot>");
  }
  push("</Page>");
  return { lines, nodes };
}

export function getPageSource(api: LowCodeDesignerAPI | undefined, pageId: string): PageSource {
  return buildPageSource(getPageOutline(api, pageId));
}

export function formatNumberedLines(lines: string[], startLine: number, endLine: number, maxLines = Number.POSITIVE_INFINITY): string {
  const selected = lines.slice(startLine - 1, endLine);
  if (selected.length <= maxLines) return selected.map((line, index) => `${startLine + index} | ${line}`).join("\n");
  const headCount = Math.ceil(maxLines / 2);
  const tailCount = Math.floor(maxLines / 2);
  const head = selected.slice(0, headCount).map((line, index) => `${startLine + index} | ${line}`);
  const tailStart = endLine - tailCount + 1;
  const tail = selected.slice(-tailCount).map((line, index) => `${tailStart + index} | ${line}`);
  return [...head, `... ${selected.length - headCount - tailCount} lines omitted ...`, ...tail].join("\n");
}
