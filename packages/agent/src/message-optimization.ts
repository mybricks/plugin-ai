import { attachmentContextToText } from "./types";
import type { AttachmentContext, Message } from "./types";

/**
 * 优化层读取历史，但只能返回新的本轮消息；历史仅由 mask、compact、handoff 等机制处理。
 * 要加入工具防重复等处理，在 messageOptimizers 中按顺序注册新的优化层。
 */
type DeepReadonly<T> = T extends (...args: any[]) => any ? T : T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

export interface MessageOptimizationState {
  historyMessages: readonly DeepReadonly<Message>[];
  currentMessages: Message[];
  attachmentContext: AttachmentContext;
}

type MessageOptimizer = (state: MessageOptimizationState) => Pick<MessageOptimizationState, "currentMessages" | "attachmentContext">;

function charDiffRatio(a: string, b: string): number {
  if (a === b) return 0;
  const maxLen = Math.max(a.length, b.length);
  let prefix = 0;
  const minLen = Math.min(a.length, b.length);
  while (prefix < minLen && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < minLen - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return (maxLen - prefix - suffix) / maxLen;
}

/** 根据实际可见历史，筛选本轮需要携带的 attachmentContext。 */
export const optimizeAttachmentContext: MessageOptimizer = ({ historyMessages, currentMessages }) => {
  const previous = new Map<string, { readonly content: string }>();
  for (const message of historyMessages) {
    for (const [key, entry] of Object.entries(message.contextEntries ?? {})) {
      if (entry?.content) previous.set(key, entry);
    }
  }

  const attachmentContext: AttachmentContext = {};
  const optimized = currentMessages.flatMap((message) => {
    if (!message.isAttachmentContext || !message.contextEntries) return [message];
    for (const [key, entry] of Object.entries(message.contextEntries)) {
      if (!entry?.content) continue;
      const last = previous.get(key);
      const threshold = entry.dedupThreshold;
      if (last && threshold !== "always" &&
          charDiffRatio(last.content, entry.content) <=
            (typeof threshold === "number" ? Math.max(0, Math.min(1, threshold)) : 0)) continue;
      attachmentContext[key] = entry;
    }
    const content = attachmentContextToText(attachmentContext);
    return content ? [{ ...message, content }] : [];
  });
  return { currentMessages: optimized, attachmentContext };
};

const messageOptimizers: readonly MessageOptimizer[] = [optimizeAttachmentContext];

export function optimizeMessages(historyMessages: Message[], currentMessages: Message[]): {
  currentMessages: Message[];
  attachmentContext: AttachmentContext;
} {
  let state: MessageOptimizationState = { historyMessages, currentMessages, attachmentContext: {} };
  for (const optimize of messageOptimizers) {
    state = { ...state, ...optimize(state) };
  }
  return { currentMessages: state.currentMessages, attachmentContext: state.attachmentContext };
}
