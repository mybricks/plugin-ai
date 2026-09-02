/**
 * YAML frontmatter 工具函数。
 *
 * 最小化实现（纯正则，无外部依赖），供 skills / sub-agent / additional-directory 共用。
 *
 * 支持格式：
 * ```
 * ---
 * key: value
 * list: [a, b, c]
 * list2: a, b, c
 * nested:
 *   sub: value
 * ---
 * body content
 * ```
 */

// ─── 底层提取 ─────────────────────────────────────────────────────────────────

/**
 * 从 md 文件完整内容中提取 frontmatter 文本和正文。
 * 若不存在 frontmatter，返回 fmText 为空字符串，body 为完整内容。
 */
export function splitFrontmatter(content: string): { fmText: string; body: string } {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fmText: "", body: content };
  return { fmText: m[1]!, body: m[2]!.trimEnd() };
}

/**
 * 从 frontmatter 文本中提取单个字符串字段。
 * 自动去掉首尾引号。
 */
export function getFrontmatterString(fmText: string, field: string): string | null {
  const m = fmText.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!m) return null;
  return m[1]!.trim().replace(/^["']|["']$/g, "");
}

/**
 * 从 frontmatter 文本中提取字符串数组字段。
 *
 * 推荐格式：英文逗号分隔的 `field: a, b, c`。
 * 同时兼容以下格式：
 *   - 内联数组：`field: [a, b, c]`
 *   - 逗号分隔：`field: a, b, c`
 *   - YAML 块列表：`field:\n  - a\n  - b`
 */
export function getFrontmatterStringArray(fmText: string, field: string): string[] | null {
  // 内联数组格式
  const inlineMatch = fmText.match(new RegExp(`^${field}:\\s*\\[([^\\]]+)\\]`, "m"));
  if (inlineMatch) {
    return inlineMatch[1]!
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  // YAML 块列表格式。每个列表项必须紧跟在 field 声明后，避免误读后续字段。
  const lines = fmText.split(/\r?\n/);
  const fieldIndex = lines.findIndex((line) => new RegExp(`^${field}:\\s*$`).test(line));
  if (fieldIndex >= 0) {
    const values: string[] = [];
    for (let index = fieldIndex + 1; index < lines.length; index++) {
      const item = lines[index]!.match(/^\s*-\s+(.+?)\s*$/);
      if (!item) break;
      const value = item[1]!.trim().replace(/^["']|["']$/g, "");
      if (value) values.push(value);
    }
    if (values.length > 0) return values;
  }

  // 逗号分隔格式（值不以 [ 开头）
  const commaMatch = fmText.match(new RegExp(`^${field}:\\s*([^\\[\\n][^\\n]*)$`, "m"));
  if (commaMatch) {
    const values = commaMatch[1]!
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    if (values.length > 0) return values;
  }

  return null;
}
