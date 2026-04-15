import { READ_TOOL_NAME } from "../read";


/**
 * 基于 oldStr / newStr 的文本替换工具，用于文件内容片段的匹配与修改。
 *
 * ## 匹配策略（多策略链，按顺序尝试，命中即替换）
 *
 * 1. **exact**（精确）
 *    - 用 content.includes(find) 判断是否作为子串出现。
 *    - 要求字节级完全一致（空格、缩进、换行均不可差）。
 *
 * 2. **lineTrimmed**（行 trim）
 *    - 将 content 与 find 按行切分，逐行比较 trim 后的结果。
 *    - 每行去掉首尾空白后相等即视为匹配，行内缩进、行尾空格可不同。
 *
 * 3. **whitespaceNormalized**（空格归一化）
 *    - 连续空白压成单个空格再 trim，对缩进、换行、多余空格不敏感。
 *
 * 4. **中文引号归一化**（chineseQuoteNormalized）
 *    - 将 content 中的中文弯引号 " " 归一化为英文引号 " 后重走策略链。
 *    - 适用于文件含中文引号、AI 生成 oldStr 含英文引号的场景。
 */

export type Replacer = (content: string, find: string) => string[];

// ─── 内置策略 ─────────────────────────────────────────────────────────────────

function simpleReplacer(content: string, find: string): string[] {
  if (find === "" || !content.includes(find)) return [];
  return [find];
}

function lineTrimmedReplacer(content: string, find: string): string[] {
  const originalLines = content.split("\n");
  const searchLines = find.split("\n");
  if (searchLines[searchLines.length - 1] === "") searchLines.pop();

  const out: string[] = [];
  for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (originalLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      let start = 0;
      for (let k = 0; k < i; k++) start += originalLines[k].length + 1;
      let end = start;
      for (let k = 0; k < searchLines.length; k++) {
        end += originalLines[i + k].length + (k < searchLines.length - 1 ? 1 : 0);
      }
      out.push(content.substring(start, end));
    }
  }
  return out;
}

function whitespaceNormalizedReplacer(content: string, find: string): string[] {
  const normalize = (t: string) => t.replace(/\s+/g, " ").trim();
  const normalizedFind = normalize(find);
  const out: string[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (normalize(lines[i]) === normalizedFind) {
      out.push(lines[i]);
    }
  }
  const findLines = find.split("\n");
  if (findLines.length > 1) {
    for (let i = 0; i <= lines.length - findLines.length; i++) {
      const block = lines.slice(i, i + findLines.length).join("\n");
      if (normalize(block) === normalizedFind) out.push(block);
    }
  }
  return out;
}

function normalizeChineseQuotes(text: string): string {
  return text.replace(/[\u201C\u201D]/g, '"');
}

function runReplacersOnNormalizedContent(
  content: string,
  find: string,
  replacers: Array<{ name: string; fn: Replacer }>
): Array<{ name: string; match: string }> {
  const normalizedContent = normalizeChineseQuotes(content);
  const normalizedFind = normalizeChineseQuotes(find);
  if (normalizedContent === content) return [];

  const results: Array<{ name: string; match: string }> = [];
  for (const { name, fn } of replacers) {
    const matches = fn(normalizedContent, normalizedFind);
    for (const normalizedMatch of matches) {
      const idx = normalizedContent.indexOf(normalizedMatch);
      if (idx === -1) continue;
      results.push({ name, match: content.substring(idx, idx + normalizedMatch.length) });
    }
  }
  return results;
}

function detectChinesePunctuation(text: string): string[] {
  const chineseQuotes = new Set(["\u201C", "\u201D"]);
  const found = new Set<string>();
  for (const char of text) {
    if (chineseQuotes.has(char)) found.add(char);
  }
  return Array.from(found);
}

// ─── 策略注册 ─────────────────────────────────────────────────────────────────

const BUILTIN_REPLACERS: Array<{ name: string; fn: Replacer }> = [
  { name: "exact", fn: simpleReplacer },
  { name: "lineTrimmed", fn: lineTrimmedReplacer },
  { name: "whitespaceNormalized", fn: whitespaceNormalizedReplacer },
];

const EXTRA_REPLACERS: Array<{ name: string; fn: Replacer }> = [];

/** 注册额外匹配策略（如依赖三方库的模糊匹配），在内置策略之后尝试。 */
export function registerReplacer(name: string, fn: Replacer): void {
  EXTRA_REPLACERS.push({ name, fn });
}

function getAllReplacers(): Array<{ name: string; fn: Replacer }> {
  return [...BUILTIN_REPLACERS, ...EXTRA_REPLACERS];
}

// ─── 结果类型 ─────────────────────────────────────────────────────────────────

export interface ReplaceResult {
  ok: boolean;
  newContent?: string;
  strategy?: string;
  error?: "NOT_FOUND" | "MULTIPLE_MATCH" | "NO_CHANGE";
  message?: string;
}

export interface ReplaceResultItem {
  ok: boolean;
  strategy?: string;
  error?: "NOT_FOUND" | "MULTIPLE_MATCH" | "NO_CHANGE";
  message?: string;
}

export interface MultiReplaceResult {
  ok: boolean;
  newContent?: string;
  results: ReplaceResultItem[];
}

// ─── 核心替换 ─────────────────────────────────────────────────────────────────

/**
 * 单次替换：在文件内容中根据 oldStr / newStr 做一次替换/新增/删除。
 * - oldStr 非空 且 newStr 非空 → 替换
 * - oldStr 为空 且 newStr 非空 → 整段内容设为 newStr（整文件写入）
 * - oldStr 非空 且 newStr 为空 → 删除
 */
export function replaceInContent(content: string, oldStr: string, newStr: string, replaceAll = false): ReplaceResult {
  if (oldStr === newStr) {
    return {
      ok: false,
      error: "NO_CHANGE",
      message: "old_str 与 new_str 相同，修改失败。",
    };
  }

  // 整文件写入
  if (oldStr === "") {
    return { ok: true, newContent: newStr, strategy: "insert" };
  }

  let foundMultiple = false;

  const tryMatches = (candidates: Array<{ name: string; match: string }>) => {
    for (const { name, match: search } of candidates) {
      const index = content.indexOf(search);
      if (index === -1) continue;
      const lastIndex = content.lastIndexOf(search);
      if (!replaceAll && index !== lastIndex) {
        foundMultiple = true;
        continue;
      }
      const newContent = replaceAll
        ? content.split(search).join(newStr)
        : content.substring(0, index) + newStr + content.substring(index + search.length);
      return { ok: true as const, newContent, strategy: name };
    }
    return null;
  };

  // 常规策略链
  const regularCandidates = getAllReplacers().flatMap(({ name, fn }) =>
    fn(content, oldStr).map((match) => ({ name, match }))
  );
  const regularResult = tryMatches(regularCandidates);
  if (regularResult) return regularResult;

  // 中文引号归一化后重走策略链
  const normalizedCandidates = runReplacersOnNormalizedContent(content, oldStr, getAllReplacers())
    .map(({ name, match }) => ({ name: `chineseQuoteNormalized(${name})`, match }));
  const normalizedResult = tryMatches(normalizedCandidates);
  if (normalizedResult) return normalizedResult;

  if (foundMultiple) {
    return {
      ok: false,
      error: "MULTIPLE_MATCH",
      message: "old_str 在文件中出现多次，请提供更多上下文使匹配唯一",
    };
  }

  const chinesePunctuation = detectChinesePunctuation(content);
  if (chinesePunctuation.length > 0) {
    const punctuationList = chinesePunctuation.join(" ");
    return {
      ok: false,
      error: "NOT_FOUND",
      message: `未在文件中找到 old_str。检测到源文件中包含中文全角符号：${punctuationList}，注意检查引号类型是否一致。`,
    };
  }

  return {
    ok: false,
    error: "NOT_FOUND",
    message: "未在文件中找到 old_str，请确认内容与当前文件一致（包括缩进）。",
  };
}

/**
 * 多次替换：按顺序对 content 执行多组 oldStr/newStr；任一步失败则中止，不写回。
 */
export function multiReplaceInContent(
  content: string,
  operations: Array<{ oldStr: string; newStr: string }>
): MultiReplaceResult {
  const results: ReplaceResultItem[] = [];
  let current = content;

  for (const { oldStr, newStr } of operations) {
    const result = replaceInContent(current, oldStr, newStr);
    results.push({ ok: result.ok, strategy: result.strategy, error: result.error, message: result.message });
    if (!result.ok || result.newContent === undefined) {
      return { ok: false, results };
    }
    current = result.newContent;
  }

  return { ok: true, newContent: current, results };
}
