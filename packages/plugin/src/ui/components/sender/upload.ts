// ─── sender/upload.ts ─────────────────────────────────────────────────────────
// 图片上传工具函数 + 文件 chip 分流/读取逻辑
//
// 文件路由规则：
//   image/*  → attachment（走 sender 的图片附件流程）
//   其他扩展名 → 查找 supportFiles 配置，命中则 → file chip，未命中则忽略

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  SUPPORTED_IMAGE_MIME_TYPES,
  FILE_CHIP_TRUNCATE_BYTES,
  FILE_CHIP_REJECT_BYTES,
} from "../../../content-limits";
import type { SupportFileEntry, SupportFiles } from "../../../content-limits";

// ─── 图片工具 ─────────────────────────────────────────────────────────────────

export {
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGE_SIZE_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
};

export const SUPPORTED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const SUPPORTED_IMAGE_LABEL = "JPG、PNG、WEBP";

export function isSupportedImageFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (SUPPORTED_IMAGE_MIME_TYPES.has(type)) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(name);
}

export const readFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target) {
        resolve(event.target.result as string);
      } else {
        reject(event);
      }
    };
    reader.onerror = (event) => reject(event);
    reader.readAsDataURL(file);
  });
};

export const getImageSize = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(event);
    };
    image.src = url;
  });
};

// ─── 文件 chip 类型标识 ───────────────────────────────────────────────────────

export const FILE_CHIP_TYPE = "file";

// ─── 文件 chip data 结构 ──────────────────────────────────────────────────────

export interface FileChipData {
  /** 文件名（含扩展名），仅文件名部分，如 "index.ts" */
  fileName: string;
  /**
   * 文件路径（可选）。
   * 浏览器拖拽/点击上传时无法获取，为 undefined。
   * 通过 insertChip 编程式插入时（如从文件树引用）可携带，如 "src/utils/index.ts"。
   * format 时有路径则使用路径，否则 fallback 到 fileName。
   */
  filePath?: string;
  /** 文件文本内容（已按阈值截断） */
  content: string;
  /** 推断的语言标识，如 "typescript"，用于 format 时 code fence */
  language: string;
  /** 内容是否被截断 */
  truncated: boolean;
  /** 原始字节数 */
  originalSize: number;
  /** 原始行数（仅在已读取文本时计算） */
  originalLines?: number;
}

// ─── 文件路由 ─────────────────────────────────────────────────────────────────

/**
 * 根据文件类型判断文件的去向：
 * - 'image'   → attachment 流程
 * - 'chip'    → file chip 流程
 * - null      → 不支持，忽略
 */
export function resolveFileRoute(
  file: File,
  supportFiles: SupportFiles
): { target: "image" } | { target: "chip"; ext: string; entry: SupportFileEntry } | { target: null } {
  if (isSupportedImageFile(file)) {
    return { target: "image" };
  }

  const ext = getFileExt(file.name);
  const entry = supportFiles[ext];
  if (entry !== undefined) {
    return { target: "chip", ext, entry };
  }

  return { target: null };
}

/** 获取文件扩展名（小写，不含点） */
export function getFileExt(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

// ─── 文件 chip 大小检查 ───────────────────────────────────────────────────────

export interface FileSizeCheckResult {
  /** 是否通过（不应拒绝） */
  ok: boolean;
  /** 如果不通过，说明原因 */
  reason?: "bytes" | "lines";
}

export class FileRejectError extends Error {
  reason: NonNullable<FileSizeCheckResult["reason"]>;

  constructor(reason: NonNullable<FileSizeCheckResult["reason"]>) {
    super(reason);
    this.name = "FileRejectError";
    this.reason = reason;
  }
}

/**
 * 检查文件是否超过 rejectAt 阈值。
 * 注意：行数检查需要已读取内容，因此 lines 参数为可选。
 */
export function checkFileReject(
  file: File,
  entry: SupportFileEntry,
  lines?: number
): FileSizeCheckResult {
  const rejectBytes = entry.rejectAt?.bytes ?? FILE_CHIP_REJECT_BYTES;
  if (file.size > rejectBytes) {
    return { ok: false, reason: "bytes" };
  }
  const rejectLines = entry.rejectAt?.lines;
  if (rejectLines !== undefined && lines !== undefined && lines > rejectLines) {
    return { ok: false, reason: "lines" };
  }
  return { ok: true };
}

/**
 * 检查文件内容是否超过 truncateAt 阈值，并返回截断后的内容。
 */
export function applyTruncate(
  content: string,
  entry: SupportFileEntry
): { content: string; truncated: boolean } {
  const truncateBytes = entry.truncateAt?.bytes ?? FILE_CHIP_TRUNCATE_BYTES;
  const truncateLines = entry.truncateAt?.lines;

  let result = content;
  let truncated = false;

  // 字节截断
  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  if (encoded.length > truncateBytes) {
    // 按字节截断，再解码（避免切断多字节字符）
    const decoder = new TextDecoder();
    result = decoder.decode(encoded.slice(0, truncateBytes));
    truncated = true;
  }

  // 行数截断（在字节截断基础上再截）
  if (truncateLines !== undefined) {
    const lines = result.split("\n");
    if (lines.length > truncateLines) {
      result = lines.slice(0, truncateLines).join("\n");
      truncated = true;
    }
  }

  return { content: result, truncated };
}

// ─── 语言推断 ─────────────────────────────────────────────────────────────────

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  java: "java",
  go: "go",
  rs: "rust",
  c: "c",
  cpp: "cpp",
  h: "c",
  cs: "csharp",
  css: "css",
  less: "less",
  scss: "scss",
  html: "html",
  xml: "xml",
  svg: "xml",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  md: "markdown",
  mdx: "mdx",
  txt: "",
};

export function inferLanguage(ext: string): string {
  return EXT_TO_LANGUAGE[ext] ?? "";
}

// ─── 读取文件为 FileChipData ──────────────────────────────────────────────────

/**
 * 读取文件文本，应用截断规则，返回 FileChipData。
 * 调用前应已通过 checkFileReject 确认文件不应被拒绝。
 */
export async function readFileAsChipData(file: File, entry: SupportFileEntry): Promise<FileChipData> {
  const rawText = await readFileAsText(file);
  // 前置处理：在截断/行数检查前执行（如 MHTML 深度清理）
  const raw = entry.preProcess ? await entry.preProcess(rawText, file) : rawText;
  const originalLines = raw.split("\n").length;
  const rejectCheck = checkFileReject(file, entry, originalLines);
  if (!rejectCheck.ok) {
    throw new FileRejectError(rejectCheck.reason ?? "lines");
  }

  const { content, truncated } = applyTruncate(raw, entry);
  const ext = getFileExt(file.name);

  return {
    fileName: file.name,
    content,
    language: inferLanguage(ext),
    truncated,
    originalSize: file.size,
    originalLines,
  };
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? "");
    reader.onerror = (e) => reject(e);
    reader.readAsText(file, "utf-8");
  });
}
