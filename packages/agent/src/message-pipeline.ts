import type { AgentOptions, AttachmentContext, CompactRecord, FormatUserMessageParams, Message, TurnMessageSnapshot, TurnRecord } from "./types";
import { attachmentToMessagePart, turnsToMessages } from "./types";
import { computeHandoffTurnIds } from "./handoff";
import { maskMessages, type MaskOptions } from "./mask";
import { optimizeMessages } from "./message-optimization";

interface MessageGroups {
  system: Message[];
  stable: Message[];
  history: Message[];
  current: Message[];
}

interface ComposedMessages {
  system: Message[];
  stable: Message[];
  historyTurns: TurnRecord[];
  maskedTurnIds: ReadonlySet<string>;
  current: Message[];
}

interface RequestMessagesInput {
  options: AgentOptions;
  snapshot: TurnMessageSnapshot;
  compactRecord?: CompactRecord | null;
  params: FormatUserMessageParams;
  tail: Message[];
}

/** 1. 拼接：保留分组和内部来源信息，供后续层使用。 */
function composeMessages({ options, snapshot, params, tail }: RequestMessagesInput): ComposedMessages {
  const userContent: Message["content"] = params.attachments?.length
    ? [{ type: "text", text: params.message }, ...params.attachments.map(attachmentToMessagePart)]
    : params.message;
  return {
    system: options.system ? [{ role: "system", content: options.system }] : [],
    stable: [...snapshot.stableContextMessages],
    historyTurns: snapshot.historyTurns,
    maskedTurnIds: snapshot.maskedTurnIds,
    current: [
      ...(snapshot.attachmentContextMessage ? [snapshot.attachmentContextMessage] : []),
      { role: "user", content: userContent },
      ...tail,
    ],
  };
}

/** 2. 机制：只有这一层允许按 compact、handoff、mask 规则处理历史。 */
function applyHistoryMechanisms(groups: ComposedMessages, options: AgentOptions, compactRecord?: CompactRecord | null): MessageGroups {
  const turns = groups.historyTurns;
  const handoffTurnIds = computeHandoffTurnIds(turns, options.handoff);
  const history = turnsToMessages(turns, compactRecord, handoffTurnIds);
  const maskOptions: MaskOptions = options.mask && typeof options.mask === "object" ? options.mask : {};
  const visibleHistory = options.mask === false ? history : maskMessages(history, turns, maskOptions, groups.maskedTurnIds);
  const compactMessages: Message[] = compactRecord ? [{
    role: "user",
    content: `<system-reminder>\nThe following is a summary of the conversation history that has been compacted:\n${compactRecord.content}\n</system-reminder>`,
  }] : [];
  return { system: groups.system, stable: [...groups.stable, ...compactMessages], history: visibleHistory, current: groups.current };
}

/** 4. 缓存标记：在所有可能改变消息的层之后，定位仍然存在的断点。 */
function markCache(groups: MessageGroups): MessageGroups {
  const markLast = (messages: Message[], onlyUserOrTool = false): Message[] => {
    const last = messages[messages.length - 1];
    if (!last || (onlyUserOrTool && last.role !== "user" && last.role !== "tool")) return messages;
    return [...messages.slice(0, -1), { ...last, cache: true }];
  };
  return {
    system: markLast(groups.system),
    stable: markLast(groups.stable),
    history: markLast(groups.history),
    current: markLast(groups.current, true),
  };
}

/** 5. 数据结构处理：移除内部字段；保留 cache 和 attachments 供请求适配层使用。 */
function stripInternalFields(groups: MessageGroups): Message[] {
  return [...groups.system, ...groups.stable, ...groups.history, ...groups.current]
    .map(({ contextTurnId: _turnId, contextEntries: _entries, isAttachmentContext: _context, errorType: _errorType, ...message }) => message);
}

/**
 * 每次 iter 请求前构建最终消息，依次经过拼接 → 机制 → 优化 → 缓存标记 → 内部字段清理。
 * compact 摘要生成属于请求前的 warmup；此处使用当次请求最新的 compactRecord。
 *
 * 最终消息顺序（各组均可为空，下标随机制和优化结果变化）：
 *   [0]        system（如有）                                              [断点 A]
 *   [1..A]     stableContext：Skill/SubAgent/模式目录、AGENTS.md 等
 *              + compact 摘要（如有，位于 stableContext 之后）              [断点 B]
 *   [B..N]     可见历史：compact 游标后的 turns，经 handoff 和 mask 处理   [断点 B']
 *   [N+1]      本轮 attachmentContext（仅包含优化层决定追加的条目，可为空）
 *   [N+2]      本轮用户消息
 *   [N+3..D]   本轮 tail（assistant/tool 及 hook 追加的消息）               [断点 D]
 *
 * A、B、B' 分别标记非空 system、stable（含 compact）、history 组的末条消息；
 * D 标记 current 组的末条消息，仅当其 role 为 user 或 tool 时设置。
 * 断点在优化之后设置；cache 标记能否生效由具体请求适配器和模型协议决定。
 * 优化层只调整本轮消息，不改写机制层保留下来的历史。
 */
export function buildRequestMessages(input: RequestMessagesInput): { messages: Message[]; attachmentContext: AttachmentContext } {
  // 1. 拼接：按 system、stable、history、current 分组，历史保留为 turns 供机制层展开。
  const composed = composeMessages(input);

  // 2. 机制：应用最新 compact、handoff 和本次执行固定的 mask，得到可见历史。
  const visible = applyHistoryMechanisms(composed, input.options, input.compactRecord);

  // 3. 优化：以可见历史为只读输入，按需筛选本轮消息；不修改历史。
  const optimized = optimizeMessages([...visible.system, ...visible.stable, ...visible.history], visible.current);

  // 4. 缓存标记：对优化后仍然存在的各组消息设置固定断点。
  const marked = markCache({ ...visible, current: optimized.currentMessages });

  // 5. 数据结构处理：合并各组并移除内部字段，保留适配层需要的 cache 和附件。
  return { messages: stripInternalFields(marked), attachmentContext: optimized.attachmentContext };
}
