export type DisabledMessage =
  | string
  | {
      type: "info" | "warn";
      content: string;
    };

export type DisabledRequestHandler = (message: DisabledMessage) => void;

export interface DisabledHandlerOptions {
  getDisabled: () => boolean;
  onDisabledRequest?: DisabledRequestHandler;
}

/**
 * 统一管理 plugin 的 disabled 状态与用户侧提示。
 *
 * 调用方自行决定是否中断业务：先调用 isDisabled()，再按需调用 message()。
 */
export class DisabledHandler {
  constructor(private readonly options: DisabledHandlerOptions) {}

  isDisabled(): boolean {
    return this.options.getDisabled();
  }

  message(message: DisabledMessage): void {
    const normalized = normalizeDisabledMessage(message);

    if (this.options.onDisabledRequest) {
      try {
        this.options.onDisabledRequest(message);
        return;
      } catch (error) {
        console.warn("[plugin-ai] onDisabledRequest failed", error);
      }
    }

    const messageApi =
      typeof window === "undefined"
        ? undefined
        : (window as any).antd?.message;

    if (messageApi) {
      if (normalized.type === "info") {
        messageApi.info?.(normalized.content);
      } else {
        messageApi.warning?.(normalized.content);
      }
      return;
    }

    if (normalized.type === "info") {
      console.info("[plugin-ai] disabled request:", normalized.content);
    } else {
      console.warn("[plugin-ai] disabled request:", normalized.content);
    }
  }
}

function normalizeDisabledMessage(message: DisabledMessage): {
  type: "info" | "warn";
  content: string;
} {
  if (typeof message === "string") {
    return { type: "warn", content: message };
  }
  return message;
}
