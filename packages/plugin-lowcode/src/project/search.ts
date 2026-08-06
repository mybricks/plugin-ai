import type { LowCodeDesignerAPI } from "../designer";
import { findPageInfoById, flattenPages } from "./page";
import { formatNumberedLines, getPageSource, renderValue } from "./source";
import type { LowCodeGrepFilters, LowCodeGrepParams, LowCodeReadParams, SourceNodeRecord } from "./types";

function stringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : renderValue(value);
}

function flattenObject(value: any, path = "", result: Array<{ path: string; value: unknown }> = []): Array<{ path: string; value: unknown }> {
  if (value === null || value === undefined) return result;
  if (typeof value !== "object" || Array.isArray(value)) {
    result.push({ path, value });
    return result;
  }
  for (const [key, child] of Object.entries(value)) flattenObject(child, path ? `${path}/${key}` : key, result);
  return result;
}

function matchesText(value: string, query: string): boolean {
  try { return new RegExp(query, "i").test(value); } catch { return value.toLocaleLowerCase().includes(query.toLocaleLowerCase()); }
}

function matchesFilters(record: SourceNodeRecord, filters: LowCodeGrepFilters = {}): boolean {
  const { node } = record;
  const namespaces = filters.namespace === undefined ? undefined : Array.isArray(filters.namespace) ? filters.namespace : [filters.namespace];
  if (namespaces && !namespaces.includes(record.namespace ?? "")) return false;
  if (filters.title && !matchesText(record.title ?? "", filters.title)) return false;
  if (filters.parentId && record.parentId !== filters.parentId) return false;
  if (filters.slotId && record.slotId !== filters.slotId) return false;
  if (filters.position && node.style?.position !== filters.position && node.layout?.position !== filters.position) return false;
  const configEntries = flattenObject(node.data);
  if (filters.configPath && !configEntries.some((entry) => matchesText(entry.path, filters.configPath!))) return false;
  if (filters.configValue !== undefined && !configEntries.some((entry) => stringify(entry.value) === String(filters.configValue))) return false;
  if (filters.text && !matchesText([record.title, record.namespace, stringify(node.data), stringify(node.style), stringify(node.layout)].filter(Boolean).join("\n"), filters.text)) return false;
  return true;
}

function searchText(record: SourceNodeRecord): string {
  const { node } = record;
  return [record.id, record.title, record.namespace, stringify(node.data), stringify(node.style), stringify(node.layout)].filter(Boolean).join("\n");
}

/** 基于当前 JSON 即时搜索，不维护独立的页面 DSL 或全文索引。 */
export function grepLowCodeContext(api: LowCodeDesignerAPI | undefined, params: LowCodeGrepParams): string {
  const allPageInfo = api?.global?.api?.getAllPageInfo?.();
  const pages = params.pageId ? [findPageInfoById(allPageInfo, params.pageId)].filter(Boolean) : flattenPages(allPageInfo);
  if (!pages.length) return params.pageId ? `未找到页面 id=${params.pageId}。` : "暂无可检索页面。";
  const query = params.query?.trim();
  const before = Math.max(0, Math.floor(params.before ?? 1));
  const after = Math.max(0, Math.floor(params.after ?? 1));
  const limit = Math.min(50, Math.max(1, Math.floor(params.limit ?? 10)));
  const matches: Array<{ page: any; record: SourceNodeRecord; lines: string[] }> = [];
  for (const page of pages) {
    if (!page?.id) continue;
    const source = getPageSource(api, page.id);
    for (const record of source.nodes) {
      if (!matchesFilters(record, params.filters) || (query && !matchesText(searchText(record), query))) continue;
      matches.push({ page, record, lines: source.lines });
      if (matches.length >= limit) break;
    }
    if (matches.length >= limit) break;
  }
  if (!matches.length) return "未找到匹配的低代码节点。";
  return ["# LowCode Grep Results", ...matches.map(({ page, record, lines }) => {
    const start = Math.max(1, record.startLine - before);
    const end = Math.min(lines.length, record.endLine + after);
    return ["", `pageId=${page.id} title=${page.title ?? "未命名"} lines=${record.startLine}-${record.endLine}`, `id=${record.id ?? ""} title=${record.title ?? ""} namespace=${record.namespace ?? ""}`, formatNumberedLines(lines, start, end, 30)].join("\n");
  })].join("\n");
}

export function readLowCodeContext(api: LowCodeDesignerAPI | undefined, params: LowCodeReadParams): string {
  const pageId = params.pageId?.trim();
  if (!pageId) return "请提供 pageId。";
  const source = getPageSource(api, pageId);
  if (!source.lines.length) return `未读取到页面 id=${pageId} 的 outline。`;
  const startLine = Math.max(1, Math.floor(params.startLine));
  const endLine = Math.min(source.lines.length, Math.floor(params.endLine));
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine > endLine) return `无效行号范围。该页面可读取范围为 1-${source.lines.length}。`;
  return ["# LowCode Read", `pageId=${pageId} lines=${startLine}-${endLine} totalLines=${source.lines.length}`, "", formatNumberedLines(source.lines, startLine, endLine)].join("\n");
}
