// ─── sender/upload.ts ─────────────────────────────────────────────────────────
// 图片上传工具函数 + 文件 chip 分流/读取逻辑
//
// 文件路由规则：
//   image/*  → attachment（走 sender 的图片附件流程）
//   其他      → file chip（经由 attachProcessors + processFile* 处理）

import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_MB,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
} from "../../../content-limits";

// FILE_CHIP_TYPE 和 FileChipData 已迁移到 agent 包，此处 re-export 保持向后兼容
export { FILE_CHIP_TYPE } from "../../../../../agent/src";
export type { FileChipData } from "../../../../../agent/src";
import type { FileChipData } from "../../../../../agent/src";

export {
  MAX_IMAGE_SIZE_MB,
  MAX_IMAGE_SIZE_BYTES,
  SUPPORTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_ACCEPT,
  SUPPORTED_IMAGE_LABEL,
};

// ─── 图片工具 ─────────────────────────────────────────────────────────────────

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

// ─── 文件路由 ─────────────────────────────────────────────────────────────────

const ACCEPTED_TEXT_FILE_EXTENSIONS = [
  "astro",
  "bash",
  "c",
  "conf",
  "config",
  "cpp",
  "cs",
  "css",
  "csv",
  "cts",
  "cxx",
  "diff",
  "env",
  "graphql",
  "h",
  "hpp",
  "htm",
  "html",
  "ini",
  "java",
  "jl",
  "js",
  "json",
  "json5",
  "jsonl",
  "jsx",
  "less",
  "log",
  "lua",
  "mht",
  "mhtml",
  "md",
  "mdx",
  "mts",
  "php",
  "plist",
  "properties",
  "proto",
  "py",
  "r",
  "rb",
  "rs",
  "sass",
  "scala",
  "scss",
  "sh",
  "sql",
  "svelte",
  "svg",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zsh",
];

export const SUPPORTED_FILE_ACCEPT = [
  SUPPORTED_IMAGE_ACCEPT,
  "text/*",
  "application/json",
  "application/xml",
  "application/x-mhtml",
  "message/rfc822",
  ...ACCEPTED_TEXT_FILE_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

const BLOCKED_FILE_MIME_PREFIXES = [
  "audio/",
  "video/",
  "font/",
];

const BLOCKED_FILE_MIME_TYPES = new Set([
  "application/epub+zip",
  "application/gzip",
  "application/java-archive",
  "application/octet-stream",
  "application/vnd.android.package-archive",
  "application/vnd.apple.installer+xml",
  "application/vnd.ms-cab-compressed",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-bzip",
  "application/x-bzip2",
  "application/x-compress",
  "application/x-cpio",
  "application/x-deb",
  "application/x-dosexec",
  "application/x-executable",
  "application/x-gtar",
  "application/x-gzip",
  "application/x-iso9660-image",
  "application/x-java-archive",
  "application/x-msdownload",
  "application/x-rar-compressed",
  "application/x-rpm",
  "application/x-shockwave-flash",
  "application/x-tar",
  "application/x-xz",
  "application/zip",
  "application/zstd",
]);

const BLOCKED_FILE_EXTENSIONS = new Set([
  "7z",
  "apk",
  "app",
  "avi",
  "bin",
  "bz",
  "bz2",
  "cab",
  "class",
  "cpio",
  "deb",
  "dmg",
  "dll",
  "ear",
  "exe",
  "flac",
  "gz",
  "iso",
  "jar",
  "m4a",
  "m4v",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "mpg",
  "msi",
  "ogg",
  "otf",
  "pkg",
  "rar",
  "rpm",
  "so",
  "swf",
  "tar",
  "tgz",
  "ttc",
  "ttf",
  "war",
  "wav",
  "webm",
  "woff",
  "woff2",
  "xz",
  "zip",
  "zst",
]);

function getBlockedFileReason(file: File): string | null {
  const type = file.type.toLowerCase();
  const ext = getFileExt(file.name);

  if (ext === "svg" || type === "image/svg+xml") {
    return null;
  }

  if (type && BLOCKED_FILE_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return "音视频/字体等二进制文件暂不支持";
  }
  if (type && BLOCKED_FILE_MIME_TYPES.has(type)) {
    return "压缩包/可执行文件等二进制文件暂不支持";
  }
  if (BLOCKED_FILE_EXTENSIONS.has(ext)) {
    return "压缩包、音视频、可执行文件等暂不支持";
  }
  if (type.startsWith("image/") && !isSupportedImageFile(file)) {
    return `图片仅支持${SUPPORTED_IMAGE_LABEL}`;
  }

  return null;
}

/**
 * 根据文件类型判断文件的去向：
 * - 'image' → attachment 流程
 * - 'chip'  → file chip 流程（默认支持非黑名单文件）
 * - 'blocked' → 黑名单文件，调用方跳过
 */
export function resolveFileRoute(
  file: File,
): { target: "image" } | { target: "chip" } | { target: "blocked"; reason: string } {
  const blockedReason = getBlockedFileReason(file);
  if (blockedReason) {
    return { target: "blocked", reason: blockedReason };
  }
  if (isSupportedImageFile(file)) {
    return { target: "image" };
  }
  return { target: "chip" };
}

/** 获取文件扩展名（小写，不含点） */
export function getFileExt(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
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
 * 将 processFile* 返回的 FileContent | FileReference | null 转换为 FileChipData。
 * 返回 null 表示文件已被跳过（上层应不插入 chip）。
 */
export function toFileChipData(
  file: File,
  result: import("../../../content-limits").FileContent | import("../../../content-limits").FileReference | null
): FileChipData | null {
  if (result === null) return null;

  if (result.type === "reference") {
    return {
      kind: "reference",
      fileName: file.name,
      originalSize: file.size,
      referenceText: result.text,
    };
  }

  // FileContent
  return {
    kind: "content",
    fileName: result.fileName,
    content: result.content,
    language: result.language ?? inferLanguage(getFileExt(result.fileName)),
    truncated: false,
    originalSize: file.size,
  };
}
