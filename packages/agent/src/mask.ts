import type { Message, TurnRecord } from "./types";
import { getTurnMode } from "./utils/core";

// ─── MaskOptions ──────────────────────────────────────────────────────────────

/**
 * 历史消息遮蔽配置。
 *
 * 遮蔽条件（OR 关系）：
 *   - 超过 `maxTurns` 的历史轮次每积累 4 轮，批量遮蔽最旧的一批
 *   - turn 结束时间距今超过 `maxAgeMinutes` 分钟
 *
 * 满足任一条件的 turn，其所有工具调用结果消息（role==='tool'）都会被替换为占位符，
 * 用户附件（image_url）也会被替换为文字占位符。
 *
 * 遮蔽跳过条件：
 *   - tool 消息的 content 长度 ≤ `minContentLength`（短确认消息，遮蔽意义不大）
 */
export interface MaskOptions {
  /**
   * 至少保留多少轮最近的历史不因轮数条件被遮蔽。
   * 默认：4；设为 0 时立即遮蔽所有有效历史轮次。
   */
  maxTurns?: number;
  /**
   * turn 结束时间距今超过多少分钟时触发遮蔽。
   * 默认：60 分钟
   */
  maxAgeMinutes?: number;
  /**
   * tool 消息 content 长度低于此值时跳过遮蔽（保留短确认消息）。
   * 默认：200 字符
   */
  minContentLength?: number;
  /**
   * 工具调用结果的占位符文本。
   * 默认："[Old tool result content cleared]"
   */
  toolPlaceholder?: string;
  /**
   * 用户附件（图片等）的占位符文本。
   * 默认："[Old attachment cleared]"
   */
  attachmentPlaceholder?: string;
}

/**
 * @deprecated Ask / Plan turn 已整体跳过 mask，不再需要单独的附件保护集合；
 * 保留此函数及原注释，以兼容既有调用方。
 *
 * 计算需要豁免附件遮蔽的 turn id 集合（保护集合）。
 *
 * 当前保护策略：
 *   - 尾部连续 plan 轮保护：从 turns 尾部往前，跳过连续的 plan 模式 turn，
 *     这些 turn 的用户附件（image_url）不参与遮蔽，直到切回 build 后才正常计入。
 *     原因：plan 多轮后首次切入 build 时，历史里仍可能有图片需要视觉模型处理。
 *
 * 未来可在此函数中追加更多保护策略（如特殊 meta 标记等）。
 *
 * tool 消息不受此保护，照常遮蔽。
 */
export function buildProtectedAttachmentTurnIds(turns: TurnRecord[]): Set<string> {
  const result = new Set<string>();
  for (let i = turns.length - 1; i >= 0; i--) {
    if (getTurnMode(turns[i]) === "plan") {
      result.add(turns[i].id);
    } else {
      break;
    }
  }
  return result;
}

// ─── maskMessages ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_AGE_MINUTES = 60;
const DEFAULT_TURN_BATCH_SIZE = 4;
const DEFAULT_MIN_CONTENT_LENGTH = 200;
const DEFAULT_TOOL_PLACEHOLDER = "[Old tool result content cleared]";
const DEFAULT_ATTACHMENT_PLACEHOLDER = "[Old attachment cleared]";

export function computeMaskedTurnIds(
  turns: TurnRecord[],
  options: MaskOptions = {},
): Set<string> {
  const result = new Set<string>();
  if (turns.length === 0) return result;

  const { maxTurns = 4, maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES } = options;
  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  // Ask / Plan 是工作记忆，直到 compact 生成摘要前均不参与 mask，也不推进轮数边界。
  // 取消轮同样不参与；只统计可遮蔽的成功 Build 轮。
  const validTurns = turns.filter(t =>
    !t.retried && !t.deleted && t.status === "success" &&
    (t.iterations?.length ?? 0) >= 1 &&
    getTurnMode(t) !== "ask" && getTurnMode(t) !== "plan"
  );
  const totalTurns = validTurns.length;
  if (totalTurns === 0) return result;
  const retainedTurns = Math.max(0, Math.ceil(maxTurns));
  const eligibleTurns = Math.max(0, totalTurns - retainedTurns);
  const maskedByTurnsCount = maxTurns <= 0
    ? totalTurns
    : Number.isFinite(maxTurns)
      ? Math.floor(eligibleTurns / DEFAULT_TURN_BATCH_SIZE) * DEFAULT_TURN_BATCH_SIZE
      : 0;

  for (let i = 0; i < totalTurns; i++) {
    const turn = validTurns[i];

    const ageMs = now - (turn.endTime ?? turn.startTime);

    const shouldMask =
      i < maskedByTurnsCount ||
      ageMs > maxAgeMs;

    if (!shouldMask) continue;

    result.add(turn.id);
  }

  return result;
}

/**
 * 对 buildMessages 产出的 Message[] 进行遮蔽处理。
 *
 * 遮蔽策略：
 *   1. 使用本次 turn 执行开始时计算的 turn ID 集合。
 *   2. 收集需要遮蔽的 tool_call_id 集合（tool 消息）和 user 消息 turn 索引集合。
 *   3. 遍历 messages：
 *      - role==='tool' 且 tool_call_id 在遮蔽集合中，且 content 长度超过阈值 → 替换 content
 *      - role==='user' && isAttachmentContext 且处于遮蔽 turn 中 → 不再携带
 *      - role==='user' 且处于遮蔽 turn 中，且 content 是数组（含附件）→ 替换 image_url 为文字占位符
 *
 * @param messages              buildMessages 产出的完整消息列表
 * @param turns                 当前已有的 TurnRecord[]（不含本轮，用于判断遮蔽条件）
 * @param options               遮蔽配置
 * @param maskedTurnIdSet       本次 turn 执行开始时计算的遮蔽集合
 * @returns                     遮蔽后的消息列表（浅拷贝，不修改原数组元素）
 */
export function maskMessages(
  messages: Message[],
  turns: TurnRecord[],
  options: MaskOptions,
  maskedTurnIdSet: ReadonlySet<string>,
): Message[] {
  const {
    minContentLength = DEFAULT_MIN_CONTENT_LENGTH,
    toolPlaceholder = DEFAULT_TOOL_PLACEHOLDER,
    attachmentPlaceholder = DEFAULT_ATTACHMENT_PLACEHOLDER,
  } = options;

  if (turns.length === 0) return messages;

  if (maskedTurnIdSet.size === 0) return messages;

  // ── 计算遮蔽集合 ─────────────────────────────────────────────────────────

  /** 需要遮蔽的 tool_call_id 集合 */
  const maskedCallIds = new Set<string>();
  /** 需要遮蔽附件/attachmentContext 的 turn 索引（对应原始 turns 数组的索引）*/
  const maskedTurnIndices = new Set<number>();

  for (let i = 0; i < turns.length; i++) {
    if (!maskedTurnIdSet.has(turns[i].id)) continue;
    maskedTurnIndices.add(i);
    for (const iter of turns[i].iterations ?? []) {
      for (const tc of iter.toolCalls ?? []) {
        maskedCallIds.add(tc.callId);
      }
    }
  }

  // 按 turn ID 精确定位历史用户消息和 attachmentContext。
  const userMsgTurnIndex = new Map<number, number>();
  const attachmentContextMsgTurnIndex = new Map<number, number>();
  const turnIndices = new Map(turns.map((turn, index) => [turn.id, index]));
  messages.forEach((message, index) => {
    if (message.role !== "user" || !message.contextTurnId) return;
    const turnIndex = turnIndices.get(message.contextTurnId);
    if (turnIndex === undefined) return;
    (message.isAttachmentContext ? attachmentContextMsgTurnIndex : userMsgTurnIndex).set(index, turnIndex);
  });

  // ── 遍历 messages 执行遮蔽 ───────────────────────────────────────────────

  return messages.map((msg, idx) => {
    // 遮蔽 tool 消息内容
    if (
      msg.role === "tool" &&
      msg.tool_call_id &&
      maskedCallIds.has(msg.tool_call_id)
    ) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (content.length > minContentLength) {
        return { ...msg, content: toolPlaceholder };
      }
    }

    // 遮蔽用户附件
    if (msg.role === "user" && Array.isArray(msg.content)) {
      const turnIdx = userMsgTurnIndex.get(idx);
      if (turnIdx !== undefined && maskedTurnIndices.has(turnIdx)) {
        // 替换 image_url 类型为文字占位符，保留 text 部分
        const newContent = msg.content.flatMap((part: any) => {
          if (part.type === "image_url") {
            return [{ type: "text", text: attachmentPlaceholder }];
          }
          return [part];
        });
        return { ...msg, content: newContent };
      }
    }

    return msg;
  }).filter((msg, idx) => {
    if (msg.role !== "user" || !msg.isAttachmentContext) return true;
    const turnIdx = attachmentContextMsgTurnIndex.get(idx);
    return turnIdx === undefined || !maskedTurnIndices.has(turnIdx);
  });
}
