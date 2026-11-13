/**
 * 把一个 turn 的 iterations 摊平 + 分组：
 *   - 摊平：按时间顺序展开成 "iter 头部"（文本/warmup/pending 占位）与 "单个工具调用" 两种 part
 *   - 分组：把相邻、未被 iter 头部打断的连续工具调用合并为一个 tool-group block
 *
 * 分组逻辑本身与是否要「视觉上折叠展示」无关（见 tool-call-group.tsx 里的 groupToolCalls 开关），
 * 这里只负责纯粹的数据结构计算，方便独立测试。
 */
import type { MessageRecord } from "../use-session";
import type { ToolCallRecord } from "../../../../../agent/src/types";

export type TurnIteration = MessageRecord["iterations"][number];

export interface IterHeadPart {
  type: "iter-head";
  iter: TurnIteration;
  isLastItem: boolean;
  /**
   * 这个占位头部是不是「工具执行完、模型还没决定下一步」的过渡态——
   * 即紧跟在工具调用后面、还没有新内容（文本/工具）的末尾空 iteration。
   * true 时 groupTurnParts 不会把它渲染成独立的占位块，而是折叠进前一个 tool-group。
   */
  awaitingNext?: boolean;
}

export interface ToolPart {
  type: "tool";
  tool: ToolCallRecord;
}

export type TurnPart = IterHeadPart | ToolPart;

/** 工具完成后、下一轮模型尚未产出内容时的临时状态。 */
export interface AwaitingNextState {
  startTime: number;
  endTime?: number;
}

export interface ToolGroupBlock {
  kind: "tool-group";
  /** 以组内第一个工具的 callId 作为 key，组内追加新工具时不会变化，保证 React key 稳定。 */
  key: string;
  tools: ToolCallRecord[];
  /**
   * 组内工具都已执行完，但 turn 仍在 pending、模型还没决定下一步（可能继续调用工具，
   * 也可能开始输出文本）。它不构成工具聚合的分界；展示层会在工具组后临时展示
   * 「模型响应中」，直到真正出现新内容。若下一轮只产生工具调用，该状态会消失，
   * 新工具仍会追加进当前聚合组。
   */
  awaitingNext?: AwaitingNextState;
}

export interface IterHeadBlock {
  kind: "iter-head";
  key: string;
  part: IterHeadPart;
}

export type TurnBlock = ToolGroupBlock | IterHeadBlock;

function isWarmupIteration(iter: TurnIteration): boolean {
  return "type" in iter && (iter as any).type === "warmup";
}

/** 判断某个 iter 是否需要渲染「头部」（文本 / 当前思考 / warmup / 规划中占位），没有则不产生 iter-head part。 */
function hasIterHead(iter: TurnIteration, isLastItem: boolean, isTurnPending: boolean): boolean {
  if (isWarmupIteration(iter)) return true;
  if ((iter as any).content) return true;
  // 思考只在当前仍流式输出的 iter 中展示；完成后不保留历史卡片，也不打断后续工具聚合。
  if ((iter as any).thinkingContent && iter.endTime === undefined && isTurnPending && isLastItem) return true;
  if (iter.toolCalls.length === 0 && isTurnPending && isLastItem) return true;
  return false;
}

/** 判断是否是「工具执行完、模型还没决定下一步」这种末尾空占位（见 IterHeadPart.awaitingNext 注释）。 */
function isAwaitingNextPlaceholder(iter: TurnIteration, isLastItem: boolean, isTurnPending: boolean): boolean {
  return !isWarmupIteration(iter)
    && !(iter as any).content
    && !(iter as any).thinkingContent
    && iter.toolCalls.length === 0
    && isTurnPending
    && isLastItem;
}

/** 把一个 turn 的 iterations 摊平为 Part 序列：某个 iter 的头部先于它自己的 toolCalls。 */
export function flattenTurnParts(iterations: TurnIteration[], isTurnPending: boolean): TurnPart[] {
  const parts: TurnPart[] = [];
  iterations.forEach((iter, index) => {
    const isLastItem = index === iterations.length - 1;
    if (hasIterHead(iter, isLastItem, isTurnPending)) {
      parts.push({ type: "iter-head", iter, isLastItem, awaitingNext: isAwaitingNextPlaceholder(iter, isLastItem, isTurnPending) });
    }
    if (!isWarmupIteration(iter)) {
      for (const tool of iter.toolCalls) {
        parts.push({ type: "tool", tool });
      }
    }
  });
  return parts;
}

/**
 * 把连续的 tool part 合并为 tool-group block；iter-head part 各自独立成 block。
 *
 * `mergeAwaitingNext` 只属于分组折叠展示：关闭 groupToolCalls 时，末尾的
 * 「模型响应中」占位必须保留为 iter-head，维持逐条渲染的原有行为与计时。
 */
export function groupTurnParts(parts: TurnPart[], mergeAwaitingNext = false): TurnBlock[] {
  const blocks: TurnBlock[] = [];
  for (const part of parts) {
    if (part.type === "tool") {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "tool-group") {
        last.tools.push(part.tool);
      } else {
        blocks.push({ kind: "tool-group", key: `tg-${part.tool.callId}`, tools: [part.tool] });
      }
    } else {
      const last = blocks[blocks.length - 1];
      if (mergeAwaitingNext && part.awaitingNext && last?.kind === "tool-group") {
        // 紧跟在工具调用后面的"等待下一步"占位：不单独成块，因此下一轮如果只产生
        // 工具调用，仍会与当前工具组聚合；但保留其时间信息，供展示层临时提示模型响应中。
        last.awaitingNext = { startTime: part.iter.startTime, endTime: part.iter.endTime };
      } else {
        blocks.push({ kind: "iter-head", key: `ih-${part.iter.iterId}`, part });
      }
    }
  }
  return blocks;
}
