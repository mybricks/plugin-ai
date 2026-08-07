// ─── Chat Chip 类型定义 ──────────────────────────────────────────────────────

/**
 * 发送消息时携带的 chip 实例（存入 meta.chips）。
 * 对应 message 字符串中的 [[chip:id]] 占位符。
 */
export interface ChatChipInstance {
  /** 唯一 id，对应 message 中的占位符 [[chip:id]] */
  id: string;
  /** chip 类型，对应注册的 ChatChipDef.type */
  type: string;
  /** chip 显示文字（UI fallback 用） */
  label: string;
  /** 业务数据（传给 render/format） */
  data?: any;
}

/**
 * Chat chip 格式化上下文，传给 ChatChipDef.format。
 */
export interface ChatChipFormatContext {
  /** 当前消息文本（含所有 [[chip:id]] 占位符） */
  message: string;
  /** 本条消息携带的所有 chip 实例（同 type 的全部） */
  chips: ChatChipInstance[];
}

/**
 * Chat chip 类型定义。
 * 注册到 ChipRegistry 后，可在输入框中插入该类型的 chip，
 * 发送时由 Agent 通过 ChipRegistry 自动格式化为 LLM 可读的文本。
 */
export interface ChatChipDef {
  /** chip 类型标识（唯一），对应 ChatChipInstance.type */
  type: string;
  /**
   * UI 渲染函数（可选）。
   * 返回 JSX 则直接渲染；返回 { color?: string; content: string } 则使用默认 chip 样式。
   * 不传时使用默认图标 + label 样式。
   * 注意：agent 包不感知返回值类型，UI 层自行处理。
   */
  render?: (data: any) => any;
  /**
   * 格式化函数。
   * 入参：{ message, chips }（message 含所有 [[chip:id]] 占位符，chips 为本 type 的全量实例）。
   * 出参：最终发给 LLM 的完整消息字符串。
   * 可自行去重、合并引用说明，或对 message 做任意变换。
   */
  format: (context: ChatChipFormatContext) => string;
}

// ─── 内置文件 chip ────────────────────────────────────────────────────────────

/** 内置文件 chip 的类型标识 */
export const FILE_CHIP_TYPE = "file";

/**
 * 文件 chip 的数据结构（存入 ChatChipInstance.data）。
 * 由 Sender 上传文件时填充，format 时展开为 <file> 代码块或引用文本。
 */
interface BaseFileChipData {
  /** 文件名（含扩展名），仅文件名部分，如 "index.ts" */
  fileName: string;
  /** 原始字节数 */
  originalSize: number;
}

export interface FileContentChipData extends BaseFileChipData {
  kind: "content";
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
  /** 原始行数（仅在已读取文本时计算） */
  originalLines?: number;
}

export interface FileReferenceChipData extends BaseFileChipData {
  kind: "reference";
  /** 原地替换 chip 占位符的引用文本，支持 Markdown */
  referenceText: string;
}

export type FileChipData = FileContentChipData | FileReferenceChipData;

/**
 * 内置文件 chip 类型定义。
 * format 模式：行内占位符替换为简短引用（「文件名」），详细文件内容追加到消息末尾。
 */
export const fileChipDef: ChatChipDef = {
  type: FILE_CHIP_TYPE,
  format({ message, chips }) {
    let resolved = message;
    const fileBlocks: string[] = [];

    for (const chip of chips) {
      const data = chip.data as FileChipData | undefined;
      if (!data) continue;

      if (data.kind === "reference") {
        // FileReference 模式：原地替换占位符，不追加尾部块
        resolved = resolved.replace(`[[chip:${chip.id}]]`, data.referenceText);
      } else {
        // FileContent 模式：占位符替换为简短引用，内容追加到尾部
        const nameAttr = data.filePath ?? data.fileName;
        resolved = resolved.replace(`[[chip:${chip.id}]]`, `@${data.fileName}`);
        const lineCount = data.content.split("\n").length;
        const langFence = data.language ? `\`\`\`${data.language}` : "```";

        // 截断说明放在标签外作为正文提示，模型更容易注意到
        const header = data.truncated
          ? `<file name="${nameAttr}">（内容过长已截断，仅展示前 ${lineCount} 行）`
          : `<file name="${nameAttr}">`;

        fileBlocks.push(
          `${header}\n${langFence}\n${data.content}\n\`\`\`\n</file>`
        );
      }
    }

    if (fileBlocks.length > 0) {
      resolved = `${resolved}\n\n以下是上方通过 @文件名 引用的文件内容：\n${fileBlocks.join("\n\n")}`;
    }

    return resolved;
  },
};

// ─── ChipRegistry ─────────────────────────────────────────────────────────────

/**
 * Chat chip 注册表。
 *
 * 职责：
 * 1. 管理 chip 类型（register / get / getAll）
 * 2. 提供 formatRequestParams，将 meta.chips 中的占位符格式化为 LLM 可读文本。
 *
 * 使用方式：
 * ```ts
 * const chipRegistry = new ChipRegistry();
 * chipRegistry.register(domChipDef);
 * const formattedParams = chipRegistry.formatRequestParams(requestParams);
 * ```
 *
 * 内置 chip 类型（无需手动注册）：
 * - `file`（FILE_CHIP_TYPE）：文件 chip，对应 Sender 上传的文本/代码文件
 */
export class ChipRegistry {
  private _types = new Map<string, ChatChipDef>();

  constructor() {
    // 预注册内置 chip 类型（外部 register 同 type 可覆盖）
    this._types.set(fileChipDef.type, fileChipDef);
  }

  /** 注册一个 chip 类型（重复注册会覆盖） */
  register(def: ChatChipDef): void {
    this._types.set(def.type, def);
  }

  /** 查询指定 type 的 chip 定义 */
  get(type: string): ChatChipDef | undefined {
    return this._types.get(type);
  }

  /** 获取所有已注册的 chip 类型列表 */
  getAll(): ChatChipDef[] {
    return Array.from(this._types.values());
  }

  /** 判断给定 chips 中是否存在会被实际格式化的项（type 已注册）。 */
  hasFormattableChips(chips?: ChatChipInstance[]): boolean {
    if (!chips?.length || this._types.size === 0) return false;
    return chips.some((chip) => this._types.has(chip.type));
  }

  /**
   * 格式化 request params：先按 chip type 分组调用 def.format，再返回新的 params。
   * 不修改原对象；如果 message 没有变化，返回原 params 引用。
   */
  formatRequestParams<T extends { message: string; meta?: Record<string, any> }>(params: T): T {
    const chips = params.meta?.chips as ChatChipInstance[] | undefined;
    if (!chips?.length || this._types.size === 0) return params;

    const typeGroups = new Map<string, ChatChipInstance[]>();
    for (const chip of chips) {
      if (!typeGroups.has(chip.type)) typeGroups.set(chip.type, []);
      typeGroups.get(chip.type)!.push(chip);
    }

    let message = params.message;
    for (const [type, groupChips] of Array.from(typeGroups)) {
      const def = this._types.get(type);
      if (def) {
        message = def.format({ message, chips: groupChips });
      }
    }

    return message === params.message ? params : { ...params, message };
  }
}
