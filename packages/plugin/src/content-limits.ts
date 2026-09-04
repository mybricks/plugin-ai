// ─── Plugin UI 层内容大小限制 ─────────────────────────────────────────────────
//
// 此文件集中管理 plugin/ui 层的所有内容大小/长度限制常量与类型。
// Agent 内部（tool result 等）的限制请见 packages/agent/src/content-limits.ts。

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

// ─── 文件 Chip 默认阈值 ───────────────────────────────────────────────────────

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

// ─── preProcess 出参类型 ──────────────────────────────────────────────────────

/**
 * preProcess / processFileInSandbox / processFileDefault 返回：文件内容内联型。
 * format 时将文件内容以 <file> 代码块追加到消息尾部，LLM 直接阅读。
 */
export interface FileContent {
  type: "content";
  /**
   * 文件名（含扩展名）。
   * 用于 format 时的 name 属性，以及 chip UI 展示。
   * 可与原始文件名不同（如 data.xlsx 解析后以 data.csv 呈现）。
   */
  fileName: string;
  /** 嵌入消息的文本内容（已解析、已清理） */
  content: string;
  /** 推断语言，用于 code fence；不填则无 fence */
  language?: string;
}

/**
 * preProcess / processFileInSandbox / processFileDefault 返回：文件引用型。
 * format 时将消息中的 chip 占位符原地替换为 text，不在尾部追加任何内容。
 * 适合文件已由调用方写入 FS / 上传 CDN 的场景，text 可以是 Markdown 链接。
 *
 * @example
 * return {
 *   type: "reference",
 *   text: `[${file.name}](uploads/${file.name}.csv)`,
 * };
 */
export interface FileReference {
  type: "reference";
  /** 直接替换 chip 占位符 [[chip:id]] 的文本，支持 Markdown */
  text: string;
}

// ─── LinkAttachment ───────────────────────────────────────────────────────────

/**
 * 链接附件（粘贴 URL 时构造）。与 File 平级，作为 AttachProcessor 的入参。
 */
export interface LinkAttachment {
  type: "link";
  /** 链接地址 */
  url: string;
  /** 链接标题（可选，如从页面 <title> 解析） */
  title?: string;
  /** 内容类型提示，如 "text/html"、"application/pdf" */
  mimeType?: string;
  /** 原始大小（若已知，如 Content-Length） */
  size?: number;
}

// ─── AttachProcessor ─────────────────────────────────────────────────────────

/**
 * 附件前置处理器。
 * 在主处理流程（processFileInSandbox / processFileDefault）之前执行，
 * 可对文件或链接做转换（如 mhtml 清理、认证注入等）。
 *
 * - type: "file"  → match 测试文件名，process 接收 File，返回转换后的 File / FileContent / FileReference
 * - type: "link"  → match 测试完整 URL，process 接收 LinkAttachment，返回转换后的 LinkAttachment
 *
 * 多个处理器时按顺序匹配，命中第一个即执行，不继续匹配后续处理器。
 * process 内部可 throw Error，框架会捕获并以 message.error 弹出提示。
 *
 * @example
 * // 文件处理器：清理 mhtml，继续交给内置主处理器
 * {
 *   type: "file",
 *   match: /\.mhtml?$/i,
 *   process: async (file) => {
 *     const text = cleanMhtml(await file.text());
 *     return new File([text], file.name, { type: "text/plain" });
 *   }
 * }
 *
 * // 文件处理器：上传到 CDN，直接返回引用
 * {
 *   type: "file",
 *   match: /\.csv$/i,
 *   process: async (file) => ({
 *     type: "reference",
 *     text: `[${file.name}](https://cdn.example.com/${file.name})`,
 *   })
 * }
 *
 * // 链接处理器：内网文档注入认证头
 * {
 *   type: "link",
 *   match: /^https:\/\/docs\.corp\.example\.com/,
 *   process: async (link) => ({ ...link, url: link.url + "?token=xxx" })
 * }
 */
export type AttachProcessor =
  | {
      type: "file";
      /** 匹配文件名（含扩展名），如 /\.xlsx$/i */
      match: RegExp;
      /**
       * 文件转换函数。
       * 入参为原始 File。
       * 返回 File 时继续交给内置主处理器；
       * 返回 FileContent 时表示已转换为文本内容，发送前仍会按内置策略决定内联或写入引用；
       * 返回 FileReference 时直接作为最终引用文本；
       * 不返回时由调用方自行处置文件，不会添加 file chip。
       * 可 throw Error，框架弹错误提示。
       */
      process: (file: File) => Promise<File | FileContent | FileReference | void>;
    }
  | {
      type: "link";
      /** 匹配完整 URL，如 /^https:\/\/docs\.corp\./ 或 /\.html(\?|$)/i */
      match: RegExp;
      /**
       * 链接转换函数。
       * 入参为 LinkAttachment，出参为转换后的 LinkAttachment（不消费）。
       * 可 throw Error，框架弹错误提示。
       */
      process: (link: LinkAttachment) => Promise<LinkAttachment>;
    };
