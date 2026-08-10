/**
 * 从流式输出的不完整 JSON 字符串中提取可用于工具卡片预览的字段。
 * 这只是 UI 临时状态，不用于构建 Agent 的持久化 ToolCallRecord。
 */
export function tryParsePartialArgs(raw: string): Record<string, any> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // 继续做部分提取。
  }

  const result: Record<string, any> = {};
  const pathMatch = raw.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (pathMatch) result.path = pathMatch[1];

  extractPartialStringField(raw, "content", result);
  extractPartialStringField(raw, "old_str", result);
  extractPartialStringField(raw, "new_str", result);

  const filesKeyIdx = raw.indexOf('"files"');
  if (filesKeyIdx !== -1) {
    const arrStart = raw.indexOf("[", filesKeyIdx);
    if (arrStart !== -1) {
      result.files = extractPartialObjectArray(raw.slice(arrStart), ["path", "content"]);
    }
  }

  const editsKeyIdx = raw.indexOf('"edits"');
  if (editsKeyIdx !== -1) {
    const arrStart = raw.indexOf("[", editsKeyIdx);
    if (arrStart !== -1) {
      result.edits = extractPartialObjectArray(raw.slice(arrStart), ["path", "old_str", "new_str"]);
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractPartialStringField(raw: string, field: string, result: Record<string, any>) {
  const fieldIdx = raw.indexOf(`"${field}"`);
  if (fieldIdx === -1) return;

  const colonIdx = raw.indexOf(":", fieldIdx);
  if (colonIdx === -1) return;

  const value = raw.slice(colonIdx + 1).trimStart();
  if (!value.startsWith('"')) return;

  const inner = value.slice(1);
  const closeIdx = findUnescapedQuote(inner);
  result[field] = closeIdx === -1 ? inner : inner.slice(0, closeIdx);
}

function findUnescapedQuote(s: string): number {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '"') continue;
    let backslashes = 0;
    let j = i - 1;
    while (j >= 0 && s[j] === "\\") { backslashes++; j--; }
    if (backslashes % 2 === 0) return i;
  }
  return -1;
}

function extractPartialObjectArray(arrStr: string, fields: string[]): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  let depth = 0;
  let objStart = -1;

  for (let i = 0; i < arrStr.length; i++) {
    const ch = arrStr[i];
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          const parsed = JSON.parse(arrStr.slice(objStart, i + 1));
          if (parsed && typeof parsed === "object") items.push(parsed);
        } catch {
          // 忽略无法解析的片段。
        }
        objStart = -1;
      }
    }
  }

  if (objStart !== -1) {
    const partial = tryParsePartialArgs(arrStr.slice(objStart));
    if (partial) {
      const item = Object.fromEntries(
        fields.filter((field) => partial[field] !== undefined).map((field) => [field, partial[field]])
      );
      if (Object.keys(item).length > 0) items.push(item);
    }
  }

  return items;
}
