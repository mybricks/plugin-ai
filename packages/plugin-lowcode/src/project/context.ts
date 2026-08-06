import type { LowCodeDesignerAPI, LowCodeFocusParams } from "../designer";
import { flattenPages } from "./page";
import { formatNumberedLines, getPageSource } from "./source";

function buildFocusSummary(focus?: LowCodeFocusParams): string {
  return focus ? [
    `type: ${focus.type ?? "unknown"}`,
    `pageId: ${focus.pageId ?? ""}`,
    `comId: ${focus.comId ?? ""}`,
    `title: ${focus.title ?? ""}`,
    focus.focusArea ? `focusArea: ${focus.focusArea.title ?? ""} ${focus.focusArea.selector ?? ""}` : "",
  ].filter(Boolean).join("\n") : "当前没有聚焦页面或组件";
}

function buildWorkspaceInfo(api: LowCodeDesignerAPI | undefined, input: any): string {
  const pages = flattenPages(input);
  if (!pages.length) return "暂无页面信息";
  return pages.map((page) => `- title="${page?.title ?? "未命名"}" id="${page?.id ?? ""}" lines=${page?.id ? getPageSource(api, page.id).lines.length : 0}`).join("\n");
}

export function buildLowCodeDesignerContext(api: LowCodeDesignerAPI | undefined, focus?: LowCodeFocusParams): string {
  const allPageInfo = api?.global?.api?.getAllPageInfo?.();
  const pages = flattenPages(allPageInfo);
  const focusPageId = focus?.pageId ?? pages[0]?.id;
  const source = focusPageId ? getPageSource(api, focusPageId) : undefined;
  const focusRecord = focus?.comId ? source?.nodes.find((node) => node.id === focus.comId) : undefined;
  const startLine = focusRecord?.startLine ?? (source?.lines.length ? 1 : undefined);
  const endLine = focusRecord?.endLine ?? source?.lines.length;
  const content = source && startLine && endLine ? formatNumberedLines(source.lines, startLine, endLine, 40) : "无可读取的 Focus DSL。";
  return [
    "# LowCode Designer Context", "", "<workspace-info>",
    "以下页面的 lines 是其按需渲染源码的总逻辑行数；使用 lowcode_grep 定位，再使用 lowcode_read 按 pageId 和行号读取。",
    buildWorkspaceInfo(api, allPageInfo), "</workspace-info>", "", "<focus-info>", buildFocusSummary(focus),
    focusPageId ? `source: page:${focusPageId}` : "", startLine && endLine ? `range: ${startLine}-${endLine}` : "", content, "</focus-info>",
  ].filter(Boolean).join("\n");
}
