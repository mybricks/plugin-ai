// ─── attach-processor.ts ─────────────────────────────────────────────────────
//
// 附件处理核心逻辑：
//   applyAttachProcessors  — 执行用户自定义前置处理器（first-match）
//   processFileDefault     — 默认文件处理（Agent 环境，400K 截断 / 800K 拒绝）
//   processFileInSandbox   — 沙箱文件处理（CodeAgent 环境，普通小文件内联，指定扩展名/大文件写 .tmp 引用）

import { message as antdMessage } from "antd";
import type { AttachProcessor, LinkAttachment, FileContent, FileReference } from "../../../content-limits";
import { FILE_CHIP_TRUNCATE_BYTES, FILE_CHIP_REJECT_BYTES } from "../../../content-limits";
import { cleanMhtml } from "../../../utils/clean-mhtml";
import type { Sandbox } from "../../../../../agent/src";
import { inferLanguage, getFileExt } from "./upload";

// ─── 前置处理器 ───────────────────────────────────────────────────────────────

/**
 * 对单个 File 应用前置处理器列表（first-match）。
 * 命中则执行 process，错误时弹提示并返回 null（调用方跳过该文件）。
 * 无命中时返回原始 file。
 */
export async function applyFileProcessors(
  file: File,
  processors: AttachProcessor[]
): Promise<File | FileContent | FileReference | void | null> {
  const proc = processors.find(
    (p): p is Extract<AttachProcessor, { type: "file" }> =>
      p.type === "file" && p.match.test(file.name)
  );
  if (!proc) return file;

  try {
    return await proc.process(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    antdMessage.error(`处理「${file.name}」失败：${msg}`);
    return null;
  }
}

/**
 * 对单个 LinkAttachment 应用前置处理器列表（first-match）。
 * 命中则执行 process，错误时弹提示并返回 null（调用方跳过该链接）。
 * 无命中时返回原始 link。
 */
export async function applyLinkProcessors(
  link: LinkAttachment,
  processors: AttachProcessor[]
): Promise<LinkAttachment | null> {
  const proc = processors.find(
    (p): p is Extract<AttachProcessor, { type: "link" }> =>
      p.type === "link" && p.match.test(link.url)
  );
  if (!proc) return link;

  try {
    return await proc.process(link);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    antdMessage.error(`处理链接「${link.url}」失败：${msg}`);
    return null;
  }
}

// ─── 内置 MHTML 处理 ──────────────────────────────────────────────────────────

/**
 * MHTML 是特例：原始文件通常包含 MIME 边界、base64 资源等大量模型不可读内容，
 * 所以不套用普通文件 chip 的 400KB/800KB 阈值，而是先 cleanMhtml，再按清理后的文本截断。
 */
/** MHTML 文件最大原始大小（30MB），超过则拒绝 */
const MHTML_REJECT_BYTES = 30 * 1024 * 1024;
/** MHTML 清理后截断目标（2MB） */
const MHTML_TRUNCATE_BYTES = 2 * 1024 * 1024;

function isMhtml(fileName: string): boolean {
  return /\.mht(ml)?$/i.test(fileName);
}

async function processMhtmlFile(file: File): Promise<{ content: string; truncated: boolean }> {
  const raw = await file.text();
  const cleaned = cleanMhtml(raw);

  const encoder = new TextEncoder();
  const encoded = encoder.encode(cleaned);
  if (encoded.length <= MHTML_TRUNCATE_BYTES) {
    return { content: cleaned, truncated: false };
  }

  const decoder = new TextDecoder();
  return {
    content: decoder.decode(encoded.slice(0, MHTML_TRUNCATE_BYTES)),
    truncated: true,
  };
}

// ─── 通用文本读取 + 截断 ──────────────────────────────────────────────────────

async function readFileWithTruncate(
  file: File,
  truncateBytes = FILE_CHIP_TRUNCATE_BYTES
): Promise<{ content: string; truncated: boolean; originalLines: number }> {
  const raw = await file.text();
  const originalLines = raw.split("\n").length;

  const encoder = new TextEncoder();
  const encoded = encoder.encode(raw);
  if (encoded.length <= truncateBytes) {
    return { content: raw, truncated: false, originalLines };
  }

  const decoder = new TextDecoder();
  return {
    content: decoder.decode(encoded.slice(0, truncateBytes)),
    truncated: true,
    originalLines,
  };
}

async function writeFileReference(file: File, sandbox: Sandbox): Promise<FileReference | null> {
  try {
    const text = await file.text();
    const fsPath = `${SANDBOX_TEMP_DIR}/${file.name}`;
    await sandbox.updateFiles([{ path: fsPath, content: text }]);
    return {
      type: "reference",
      text: `[${file.name}](${fsPath})`,
    };
  } catch (err) {
    antdMessage.error(`写入沙箱失败：${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

const REFERENCE_PREFERRED_EXTENSIONS = new Set([
  "csv",
  "jsonl",
  "ldjson",
  "lock",
  "log",
  "ndjson",
  "tsv",
]);

const REFERENCE_PREFERRED_FILE_NAMES = new Set([
  "bun.lock",
  "composer.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock",
]);

function shouldPreferSandboxReference(file: File): boolean {
  const ext = getFileExt(file.name);
  const lowerName = file.name.toLowerCase();
  if (REFERENCE_PREFERRED_EXTENSIONS.has(ext)) return true;
  if (REFERENCE_PREFERRED_FILE_NAMES.has(lowerName)) return true;
  if (/(\.|-)(log|trace|dump|report)\./i.test(file.name)) return true;
  return false;
}

// ─── processFileDefault（Agent 环境） ─────────────────────────────────────────

/**
 * 默认文件处理（无 sandbox 的 Agent 环境）：
 * - 超过 FILE_CHIP_REJECT_BYTES（默认 800KB）：拒绝，返回 null
 * - 超过 FILE_CHIP_TRUNCATE_BYTES（默认 400KB）：截断后内联
 * - 其余：完整内联
 *
 * MHTML 文件使用特例逻辑：先 cleanMhtml，再按清理后的文本大小截断。
 */
export async function processFileDefault(
  file: File
): Promise<FileContent | null> {
  // MHTML 原始大小不代表最终文本大小，因此使用独立限制，不走普通文件阈值。
  if (isMhtml(file.name)) {
    if (file.size > MHTML_REJECT_BYTES) {
      antdMessage.info(`文件「${file.name}」超过大小限制（${Math.round(MHTML_REJECT_BYTES / 1024 / 1024)}MB），已跳过`);
      return null;
    }
    const { content, truncated } = await processMhtmlFile(file);
    const lineCount = content.split("\n").length;
    return {
      type: "content",
      fileName: file.name,
      content: truncated ? `${content}\n...(内容已截断，仅展示前 ${lineCount} 行)` : content,
      language: "html",
    };
  }

  if (file.size > FILE_CHIP_REJECT_BYTES) {
    antdMessage.info(`文件「${file.name}」超过大小限制（${Math.round(FILE_CHIP_REJECT_BYTES / 1024)}KB），已跳过`);
    return null;
  }

  const { content, truncated, originalLines } = await readFileWithTruncate(file);
  const ext = getFileExt(file.name);
  const finalContent = truncated
    ? `${content}\n...(内容已截断，仅展示前 ${originalLines} 行)`
    : content;

  return {
    type: "content",
    fileName: file.name,
    content: finalContent,
    language: inferLanguage(ext),
  };
}

// ─── processFileInSandbox（CodeAgent 环境） ────────────────────────────────────

/** 临时上传目录 */
const SANDBOX_TEMP_DIR = ".tmp/uploads";

/**
 * 沙箱文件处理（CodeAgent 环境）：
 * - MHTML：特例处理，先 cleanMhtml；原始文件 ≤30MB，清理后 ≤2MB 内联，>2MB 截断后内联
 * - 超过 FILE_CHIP_REJECT_BYTES（默认 800KB）：写入 sandbox 临时目录，返回 FileReference
 * - 小于阈值但更适合按需读取的文件（如 log / csv / jsonl / lockfile）：
 *   写入 sandbox 临时目录，返回 FileReference
 * - 其余普通文本/代码文件：完整内联；超过 FILE_CHIP_TRUNCATE_BYTES（默认 400KB）则截断后内联
 *
 * 写入临时目录的路径格式：.tmp/uploads/<fileName>
 */
export async function processFileInSandbox(
  file: File,
  sandbox: Sandbox
): Promise<FileContent | FileReference | null> {
  // MHTML 原始大小不代表最终文本大小，因此使用独立限制，不走普通文件阈值。
  if (isMhtml(file.name)) {
    if (file.size > MHTML_REJECT_BYTES) {
      antdMessage.info(`文件「${file.name}」超过大小限制（${Math.round(MHTML_REJECT_BYTES / 1024 / 1024)}MB），已跳过`);
      return null;
    }
    const { content, truncated } = await processMhtmlFile(file);
    const lineCount = content.split("\n").length;
    return {
      type: "content",
      fileName: file.name,
      content: truncated ? `${content}\n...(内容已截断，仅展示前 ${lineCount} 行)` : content,
      language: "html",
    };
  }

  // 超过拒绝阈值 → 写入 sandbox 临时目录，返回引用
  if (file.size > FILE_CHIP_REJECT_BYTES) {
    return writeFileReference(file, sandbox);
  }

  // 400KB 以下默认内联；指定扩展名/文件名倾向写入 sandbox 后按需读取。
  const { content, truncated, originalLines } = await readFileWithTruncate(file);
  if (!truncated && shouldPreferSandboxReference(file)) {
    return writeFileReference(file, sandbox);
  }

  const ext = getFileExt(file.name);
  const finalContent = truncated
    ? `${content}\n...(内容已截断，仅展示前 ${originalLines} 行)`
    : content;

  return {
    type: "content",
    fileName: file.name,
    content: finalContent,
    language: inferLanguage(ext),
  };
}
