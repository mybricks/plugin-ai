import type { Message, TurnRecord } from "./types";

// ─── MaskOptions ──────────────────────────────────────────────────────────────

/**
 * 历史消息遮蔽配置。
 *
 * 遮蔽条件（OR 关系）：
 *   - 距离最新 turn 超过 `maxTurns` 轮
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
   * 距离最新 turn 超过多少轮时触发遮蔽。
   * 例如设为 5，则最近 5 轮不遮蔽，更早的轮次遮蔽。
   * 默认：15
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
  /**
   * Handoff 机制：命中遮蔽条件的 turn，在构建 LLM 消息时将整个 turn 替换为
   * user（原始用户消息） + assistant（turn.handoff 内容）两条消息，
   * 而非保留完整的 ReAct 序列。
   *
   * 启用条件：
   *   - `handoff.enabled` 为 true
   *   - turn 有 `handoff` 字段（由 autoSummary 异步写入）
   *   - turn 命中遮蔽条件（maxTurns / maxAgeMinutes）
   *
   * 若命中条件但 turn 无 handoff 内容，则降级为普通遮蔽（tool 占位符替换）。
   *
   * 默认：不启用
   */
  handoff?: {
    /** 是否启用 handoff 机制，默认 false */
    enabled: boolean;
  };
}

// ─── maskMessages ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_AGE_MINUTES = 60;
const DEFAULT_MIN_CONTENT_LENGTH = 200;
const DEFAULT_TOOL_PLACEHOLDER = "[Old tool result content cleared]";
const DEFAULT_ATTACHMENT_PLACEHOLDER = "[Old attachment cleared]";

/**
 * 对 buildMessages 产出的 Message[] 进行遮蔽处理。
 *
 * 遮蔽策略：
 *   1. 根据 turns 和 maskOptions 计算出哪些 turn 需要遮蔽。
 *   2. 收集需要遮蔽的 tool_call_id 集合（tool 消息）和 user 消息 turn 索引集合。
 *   3. 遍历 messages：
 *      - role==='tool' 且 tool_call_id 在遮蔽集合中，且 content 长度超过阈值 → 替换 content
 *      - role==='user' 且处于遮蔽 turn 中，且 content 是数组（含附件）→ 替换 image_url 为文字占位符
 *
 * @param messages  buildMessages 产出的完整消息列表
 * @param turns     当前已有的 TurnRecord[]（不含本轮，用于判断遮蔽条件）
 * @param options   遮蔽配置
 * @returns         遮蔽后的消息列表（浅拷贝，不修改原数组元素）
 */
export function maskMessages(
  messages: Message[],
  turns: TurnRecord[],
  options: MaskOptions
): Message[] {
  const {
    maxTurns = 15,
    maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
    minContentLength = DEFAULT_MIN_CONTENT_LENGTH,
    toolPlaceholder = DEFAULT_TOOL_PLACEHOLDER,
    attachmentPlaceholder = DEFAULT_ATTACHMENT_PLACEHOLDER,
  } = options;

  if (turns.length === 0) return messages;

  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  // ── 过滤有效轮次（跳过 iterations 为空的轮）────────────────────────────
  // 没有任何 LLM 响应的空轮次不参与遮蔽计算
  const validTurns = turns.filter(t => (t.iterations?.length ?? 0) >= 1);
  const totalTurns = validTurns.length;

  if (totalTurns === 0) return messages;

  // ── 计算遮蔽集合 ─────────────────────────────────────────────────────────

  /** 需要遮蔽的 tool_call_id 集合 */
  const maskedCallIds = new Set<string>();
  /** 需要遮蔽附件的 turn 索引（对应原始 turns 数组的索引）*/
  const maskedTurnIndices = new Set<number>();

  for (let i = 0; i < totalTurns; i++) {
    const turn = validTurns[i];
    if (turn.status !== "success") continue;

    // 距当前最新有效 turn 的轮数（0 = 最新，totalTurns-1 = 最旧）
    const turnsAgo = totalTurns - 1 - i;
    const ageMs = now - (turn.endTime ?? turn.startTime);

    const shouldMask =
      (isFinite(maxTurns) && turnsAgo >= maxTurns) ||
      ageMs > maxAgeMs;

    if (!shouldMask) continue;

    // 找到该 turn 在原始 turns 数组中的索引
    const originalIndex = turns.indexOf(turn);
    maskedTurnIndices.add(originalIndex);

    // 收集该 turn 所有迭代中的 toolCall id
    for (const iter of turn.iterations ?? []) {
      for (const tc of iter.toolCalls ?? []) {
        maskedCallIds.add(tc.callId);
      }
    }
  }

  if (maskedCallIds.size === 0 && maskedTurnIndices.size === 0) {
    return messages;
  }

  // ── Handoff：从遮蔽集合中剔除已由 turnsToMessages 整体替换的 turn ──────────
  // 命中 handoff 的 turn 在 turnsToMessages 里已经被替换为 user+assistant(handoff)，
  // 展开后的 messages 里不再有对应的 tool 消息和 image_url，无需再做遮蔽。
  if (options.handoff?.enabled) {
    const handoffTurnIds = computeHandoffTurnIds(turns, options);
    if (handoffTurnIds.size > 0) {
      // 从 maskedCallIds 中移除已 handoff turn 的 toolCall id
      for (const idx of maskedTurnIndices) {
        const turn = turns[idx];
        if (!handoffTurnIds.has(turn.id)) continue;
        maskedTurnIndices.delete(idx);
        for (const iter of turn.iterations ?? []) {
          for (const tc of iter.toolCalls ?? []) {
            maskedCallIds.delete(tc.callId);
          }
        }
      }
    }
  }

  // ── 需要遮蔽附件时，建立 "该 user 消息在第几个 turn" 的映射 ─────────────
  // turnsToMessages 按 turn 顺序展开，每个 success turn 产出 1 条 user 消息（最前）
  // 我们需要知道 messages 中每条 user 消息对应哪个 turn index，才能判断附件是否遮蔽
  //
  // 策略：遍历 messages，遇到 role==='user' 时用游标匹配 turns（跳过 agentsMd 注入的 user 消息）
  // agentsMd 注入的 user 消息特征：它不对应任何 turn，位于 historyMessages 之前；
  // 而 history user 消息是按 turns 顺序输出的，我们只需跟 turns 里 success 的轮次对齐即可。

  const successTurnIndices: number[] = turns
    .map((t, i) => (!t.retried ? i : -1))
    .filter((i) => i !== -1);

  // 标记 messages 中每条 user 消息对应的 turn index（-1 表示非 history user 消息）
  const userMsgTurnIndex: Map<number, number> = new Map();

  // 找到 history messages 的起始位置：跳过 system + agentsMd user message
  // 方法：先数出 history 中有多少条 user 消息，然后倒推
  // 更简单的方法：正向遍历，前 N 条 user 消息（N = successTurnIndices.length）
  // 对应 history turns，其余 user 消息（agentsMd / contextMessages / currentUser）不对应 turn

  // 收集所有 user 消息在 messages 中的位置
  const userMsgPositions: number[] = [];
  for (let j = 0; j < messages.length; j++) {
    if (messages[j].role === "user") {
      userMsgPositions.push(j);
    }
  }

  // history user 消息数量 = successTurnIndices.length
  // messages 中最后一条 user 消息是当前轮用户输入，倒数 successTurnIndices.length 条之前的是 agentsMd
  // 实际上：messages 布局为：
  //   [system?] [agentsMd user?] [history...] [contextMessages...] [currentUser]
  // history 产生的 user 消息数量恰好等于 successTurnIndices.length
  // 最后一条 user 消息是 currentUser（本轮，不在 turns 中）
  // 中间的 agentsMd user 消息（如果存在）是第一条 user 消息，不对应任何 turn

  // 因此 history user 消息 = userMsgPositions 中，
  //   从 (total - 1 - successTurnIndices.length) 到 (total - 2) 这一段
  // 即：去掉最后 1 条（currentUser），再去掉开头的 agentsMd 条（若有）

  const historyUserCount = successTurnIndices.length;
  // history user 消息在 userMsgPositions 中的起始下标
  // = userMsgPositions.length - 1（去掉currentUser） - historyUserCount
  const historyUserStart = userMsgPositions.length - 1 - historyUserCount;
  // historyUserStart 可能为负（无 agentsMd 时 = -1，意味着从 0 开始）
  // 实际上第一条 user 消息：若 agentsMd 存在则 historyUserStart=0 指向 agentsMd，
  //   history 从 index 1 开始；若无 agentsMd 则从 index 0 开始
  // 最简单：history user 消息就是 userMsgPositions 的第
  //   [userMsgPositions.length - 1 - historyUserCount ... userMsgPositions.length - 2] 段

  for (let k = 0; k < historyUserCount; k++) {
    const posInUserMsgPositions = userMsgPositions.length - 1 - historyUserCount + k;
    if (posInUserMsgPositions >= 0) {
      const msgIdx = userMsgPositions[posInUserMsgPositions];
      userMsgTurnIndex.set(msgIdx, successTurnIndices[k]);
    }
  }

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
  });
}

// ─── computeHandoffTurnIds ────────────────────────────────────────────────────

/**
 * 计算哪些 turn 命中 handoff 条件，返回其 id 集合。
 *
 * 命中条件（同时满足）：
 *   1. handoff.enabled 为 true
 *   2. turn 命中遮蔽条件（maxTurns / maxAgeMinutes）
 *   3. turn 为 success 且未被 retried
 *   4. turn.handoff 有内容（无内容时降级为普通 mask 遮蔽）
 *
 * 供 agent.ts 的 buildMessages 调用，计算结果传给 turnsToMessages。
 */
export function computeHandoffTurnIds(
  turns: TurnRecord[],
  options: MaskOptions
): Set<string> {
  const result = new Set<string>();
  if (!options.handoff?.enabled) return result;

  const {
    maxTurns = 8,
    maxAgeMinutes = DEFAULT_MAX_AGE_MINUTES,
  } = options;

  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  // 过滤有效轮次（跳过 iterations 为空的轮）
  const validTurns = turns.filter(t => (t.iterations?.length ?? 0) >= 2);
  const totalTurns = validTurns.length;

  for (let i = 0; i < totalTurns; i++) {
    const turn = validTurns[i];
    if (turn.status !== "success" || turn.retried) continue;

    const turnsAgo = totalTurns - 1 - i;
    const ageMs = now - (turn.endTime ?? turn.startTime);

    const shouldMask =
      (isFinite(maxTurns) && turnsAgo >= maxTurns) ||
      ageMs > maxAgeMs;

    if (shouldMask && turn.handoff) {
      result.add(turn.id);
    }
  }

  return result;
}
