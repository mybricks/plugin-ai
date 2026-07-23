import markdownit from "markdown-it";
import { DEFAULT_PLAN_DIR } from "../../../../../agent/src/mode-manager";

const md = markdownit();

export function isPlanFilePath(path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  return normalized.startsWith(DEFAULT_PLAN_DIR);
}

export function extractPlanDateFolder(path: string): string | null {
  const match = path.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1]! : null;
}

export function parsePlanContent(content: string): {
  title: string | null;
  desc: string | null;
  status: string | null;
  body: string;
} {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { title: null, desc: null, status: null, body: content };
  const fmText = m[1]!;
  const body = m[2]!.trimStart();
  const titleMatch = fmText.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = fmText.match(/^desc:\s*["']?(.+?)["']?\s*$/m);
  const statusMatch = fmText.match(/^status:\s*["']?(.+?)["']?\s*$/m);
  return {
    title: titleMatch ? titleMatch[1]!.trim() : null,
    desc: descMatch ? descMatch[1]!.trim() : null,
    status: statusMatch ? statusMatch[1]!.trim() : null,
    body,
  };
}

export function renderPlanMarkdownHtml(body: string): string {
  return md.render(body);
}
