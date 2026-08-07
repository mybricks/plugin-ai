/** 设计器 mock 与调试场景使用的 action 文本解析器。 */
import { jsonrepair } from "jsonrepair";

export function extractActionsContent(content: string): string {
  const blocks = Array.from(content.matchAll(/```(?:actions\.json|json)?\s*\n([\s\S]*?)```/g));
  if (!blocks.length) return content;
  return blocks[blocks.length - 1]?.[1] ?? content;
}

function parseJsonValue(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return JSON.parse(jsonrepair(value));
  }
}

export function parseLineActions(content: string): any[] {
  const raw = extractActionsContent(content).trim();
  if (!raw) return [];

  try {
    const parsed = parseJsonValue(raw);
    if (Array.isArray(parsed) && parsed.every((item) => Array.isArray(item) || typeof item === "object")) {
      return Array.isArray(parsed[0]) && typeof parsed[0][0] !== "string" ? parsed.flat() : parsed;
    }
  } catch {}

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseJsonValue(line));
}

function extractStreamingActionsContent(content: string): { text: string; closed: boolean } {
  const fenceMatch = content.match(/```(?:actions\.json|json)?\s*\n/);
  if (!fenceMatch || fenceMatch.index === undefined) {
    return { text: content, closed: false };
  }

  const start = fenceMatch.index + fenceMatch[0].length;
  const rest = content.slice(start);
  const closeIndex = rest.indexOf("```");
  if (closeIndex >= 0) {
    return { text: rest.slice(0, closeIndex), closed: true };
  }
  return { text: rest, closed: false };
}

export function parseCompleteStreamingLineActions(content: string): any[] {
  const { text, closed } = extractStreamingActionsContent(content);
  const lines = text.split(/\r?\n/);
  const completeLines = closed ? lines : lines.slice(0, -1);

  const actions: any[] = [];
  completeLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("[") || line.startsWith("{"))
    .forEach((line) => {
      try {
        actions.push(JSON.parse(line));
      } catch {}
    });

  return actions;
}
