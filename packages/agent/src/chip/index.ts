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
 * 发送时由 ChipRegistry.formatUserMessage 自动格式化为 LLM 可读的文本。
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

// ─── ChipRegistry ─────────────────────────────────────────────────────────────

/**
 * Chat chip 注册表。
 *
 * 职责：
 * 1. 管理 chip 类型（register / get / getAll）
 * 2. 提供 wrapFormatUserMessage，将 chip 格式化逻辑包装到外部 formatUserMessage 之前执行，
 *    完全不侵入 Agent 核心代码，通过 meta.chips 约定透传实例数据。
 *
 * 使用方式：
 * ```ts
 * const chipRegistry = new ChipRegistry();
 * chipRegistry.register(domChipDef);
 *
 * const agent = new CodeAgent({
 *   formatUserMessage: chipRegistry.wrapFormatUserMessage(externalFormatUserMessage),
 *   // ...
 * });
 * ```
 */
export class ChipRegistry {
  private _types = new Map<string, ChatChipDef>();

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

  /**
   * 包装 formatUserMessage：在外部 formatUserMessage 执行之前，
   * 先对 meta.chips 做占位符替换，然后把 chips 处理完的 message 传给外部函数。
   *
   * @param externalFormatUserMessage 外部（pluginAI 调用方）传入的 formatUserMessage，可为 undefined
   * @returns 合并后的 formatUserMessage，可直接传给 CodeAgent options
   */
  wrapFormatUserMessage(
  externalFormatUserMessage?: (params: any) => Promise<any> | any
  ): (params: any) => Promise<any> {
    return async (params: any) => {
      // ── Step 1：chip 占位符替换（最先执行）
      const chips = params.meta?.chips as ChatChipInstance[] | undefined;
      let resolvedParams = params;

      if (chips?.length && this._types.size > 0) {
        // 按 type 分组，每种 def.format 只调一次，拿整条 message 做变换
        const typeGroups = new Map<string, ChatChipInstance[]>();
        for (const chip of chips) {
          if (!typeGroups.has(chip.type)) typeGroups.set(chip.type, []);
          typeGroups.get(chip.type)!.push(chip);
        }

        let message = params.message as string;
        for (const [type, groupChips] of Array.from(typeGroups)) {
          const def = this._types.get(type);
          if (def) {
            message = def.format({ message, chips: groupChips });
          }
        }

        if (message !== params.message) {
          resolvedParams = { ...params, message };
        }
      }

      // ── Step 2：外部 formatUserMessage（如果有）
      if (!externalFormatUserMessage) return resolvedParams;
      return externalFormatUserMessage(resolvedParams);
    };
  }
}
