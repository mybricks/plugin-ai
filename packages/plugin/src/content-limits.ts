// ─── Plugin UI 层内容大小限制 ─────────────────────────────────────────────────
//
// 此文件集中管理 plugin/ui 层的所有内容大小/长度限制常量与类型。
// Agent 内部（tool result 等）的限制请见 packages/agent/src/content-limits.ts。

import { cleanMhtml } from "./utils/clean-mhtml";

// ─── 图片上传限制 ─────────────────────────────────────────────────────────────

/** 图片附件上传的最大文件大小（MB） */
export const MAX_IMAGE_SIZE_MB = 3.5;

/** 图片附件上传的最大文件大小（bytes） */
export const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/** 支持的图片 MIME 类型集合 */
export const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 图片文件 input accept 属性值 */
export const SUPPORTED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

/** 图片格式显示名称（用于错误提示） */
export const SUPPORTED_IMAGE_LABEL = "JPG、PNG、WEBP";

// ─── 文件 Chip 限制 ───────────────────────────────────────────────────────────

/**
 * 文件 chip 内容截断阈值（bytes）。
 * 超过此值时，文件内容将被截断，chip 数据中标记 truncated=true。
 * 默认 400KB。
 */
export const FILE_CHIP_TRUNCATE_BYTES = 400 * 1024;

/**
 * 文件 chip 上传拒绝阈值（bytes）。
 * 超过此值时，文件无法被拖入或点击选择。
 * 默认 800KB。
 */
export const FILE_CHIP_REJECT_BYTES = 800 * 1024;

// ─── SupportFiles 类型定义 ────────────────────────────────────────────────────

/**
 * 单个文件类型的上传限制配置。
 * truncateAt 和 rejectAt 各有 bytes（字节数）和 lines（行数）两个维度，
 * 任一维度率先触发时生效。
 */
export interface SupportFileEntry {
  /**
   * 截断阈值。超过时内容被截断，chip 标记 truncated=true。
   * 不填则使用 FILE_CHIP_TRUNCATE_BYTES / 不限行数。
   */
  truncateAt?: {
    bytes?: number;
    lines?: number;
  };
  /**
   * 拒绝阈值。超过时文件无法进入输入框。
   * 不填则使用 FILE_CHIP_REJECT_BYTES / 不限行数。
   */
  rejectAt?: {
    bytes?: number;
    lines?: number;
  };
  /**
   * 同类文件（相同扩展名）的累计总字节数上限。
   * 超过时拒绝新增该类型文件。不填则不限。
   */
  totalBytesLimit?: number;
  /**
   * 文件内容前置处理函数。
   * 在内容截断之前调用，可对原始文本做清理/转换（如 MHTML 深度精简）。
   * 返回处理后的字符串，作为后续截断和 chip 内容的输入。
   * @param content 原始文本内容
   * @param file    原始 File 对象（可用于读取文件名、大小等元信息）
   */
  preProcess?: (content: string, file: File) => string | Promise<string>;
}

/**
 * 文件上传支持配置。
 * key 为不含点的文件扩展名（小写），如 "ts"、"json"、"md"。
 *
 * @example
 * const supportFiles: SupportFiles = {
 *   ...DEFAULT_SUPPORT_FILES,
 *   ts: { rejectAt: { bytes: 100 * 1024 } },
 *   sql: { rejectAt: { bytes: 50 * 1024 }, totalBytesLimit: 100 * 1024 },
 * };
 */
export type SupportFiles = Record<string, SupportFileEntry>;

/**
 * 默认文件上传支持配置（开箱即用）。
 * 覆盖所有常见可读取为文本的文件格式，均使用全局默认阈值。
 * 图片（image/*）始终走 attachment 流程，无需在此声明。
 */
export const DEFAULT_SUPPORT_FILES: SupportFiles = {
  // 纯文本
  txt: {},
  log: {},
  // 文档
  md: {},
  mdx: {},
  rst: {},
  // Web
  html: {},
  htm: {},
  css: {},
  less: {},
  scss: {},
  sass: {},
  // JavaScript / TypeScript
  js: {},
  jsx: {},
  mjs: {},
  cjs: {},
  ts: {},
  tsx: {},
  mts: {},
  cts: {},
  // 后端语言
  py: {},
  java: {},
  go: {},
  rs: {},
  c: {},
  cpp: {},
  cc: {},
  cxx: {},
  h: {},
  hpp: {},
  cs: {},
  rb: {},
  php: {},
  swift: {},
  kt: {},
  scala: {},
  r: {},
  lua: {},
  // 配置 / 数据
  json: {},
  jsonc: {},
  json5: {},
  yaml: {},
  yml: {},
  toml: {},
  xml: {},
  ini: {},
  conf: {},
  env: {},
  // 脚本
  sh: {},
  bash: {},
  zsh: {},
  fish: {},
  ps1: {},
  // 数据库
  sql: {},
  // 其他代码
  svg: {},
  graphql: {},
  gql: {},
  proto: {},
  tf: {},
  vim: {},
  diff: {},
  patch: {},
  // MHTML 网页存档（.mhtml / .mht），上传前深度清理以大幅压缩体积
  mhtml: {
    preProcess: (content) => cleanMhtml(content),
    rejectAt: { bytes: 30 * 1024 * 1024 },   // 原始文件最大 30MB
    truncateAt: { bytes: 2 * 1024 * 1024 },   // 清理后截到 2MB
  },
  mht: {
    preProcess: (content) => cleanMhtml(content),
    rejectAt: { bytes: 30 * 1024 * 1024 },
    truncateAt: { bytes: 2 * 1024 * 1024 },
  },
};
