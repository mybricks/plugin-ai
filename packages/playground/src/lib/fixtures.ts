import type { TurnRecord, ToolCallRecord, TokenUsage } from "@agent/types";

let _idCounter = 1;
const genId = () => `fixture-${Date.now()}-${_idCounter++}`;

// ─── 工具调用记录工厂 ─────────────────────────────────────────────────────────

interface ToolCallInput {
  name: string;
  args?: Record<string, any>;
  result?: string;
  error?: string;
  /** 工具执行耗时 ms，默认 200 */
  durationMs?: number;
}

export function makeToolCall(input: ToolCallInput): ToolCallRecord {
  const now = Date.now();
  const isError = input.error !== undefined;
  return {
    callId: genId(),
    name: input.name,
    args: input.args ?? {},
    status: isError ? "error" : "success",
    result: isError ? undefined : { output: input.result ?? "OK", metadata: {} },
    error: input.error,
    execStartTime: now,
    execEndTime: now + (input.durationMs ?? 200),
  };
}

// ─── 单轮记录工厂 ─────────────────────────────────────────────────────────────

interface TurnInput {
  userText: string;
  /** LLM 最终回复文本（无 iterations 时自动创建一个纯文本 iter） */
  content?: string;
  /** 每次 LLM step 的工具调用（ReAct 迭代） */
  iterations?: Array<{
    content?: string;
    toolCalls?: ToolCallInput[];
    thinkingContent?: string;
    usage?: TokenUsage;
  }>;
  status?: TurnRecord["status"];
  error?: string;
  /** turn 开始时间，默认使用当前时间向前偏移 */
  startTime?: number;
  /** turn 结束时间，默认 startTime + 2000 */
  endTime?: number;
  attachments?: TurnRecord["userAttachments"];
}

export function makeTurn(input: TurnInput): TurnRecord {
  const now = Date.now();
  const startTime = input.startTime ?? now;
  const endTime = input.endTime ?? startTime + 2000;

  const iterations: TurnRecord["iterations"] = (input.iterations ?? []).map((iter, i) => {
    const iterStart = startTime + i * 1000;
    return {
      content: iter.content ?? "",
      thinkingContent: iter.thinkingContent,
      toolCalls: (iter.toolCalls ?? []).map(makeToolCall),
      startTime: iterStart,
      endTime: iterStart + 800,
      ...(iter.usage ? { usage: iter.usage } : {}),
    };
  });

  // 如果没有 iterations 且 content 存在，自动生成一个纯文本迭代
  if (iterations.length === 0 && input.content) {
    iterations.push({
      content: input.content,
      toolCalls: [],
      startTime,
      endTime,
    });
  }

  return {
    id: genId(),
    startTime,
    endTime: input.status === "error" ? undefined : endTime,
    userText: input.userText,
    userFormattedText: input.userText,
    userAttachments: input.attachments ?? [],
    iterations,
    status: input.status ?? "success",
    error: input.error,
  };
}

// ─── 批量工厂 ──────────────────────────────────────────────────────────────────

/**
 * 快速生成 N 轮纯文本对话历史（不含工具调用），方便测试 mask 等场景。
 */
export function makeTextHistory(
  pairs: Array<{ user: string; assistant: string }>,
  /** 首轮开始时间（Unix ms），默认 1 小时前 */
  baseTime?: number
): TurnRecord[] {
  const base = baseTime ?? Date.now() - 60 * 60 * 1000;
  return pairs.map((p, i) =>
    makeTurn({
      userText: p.user,
      content: p.assistant,
      startTime: base + i * 3000,
      endTime: base + i * 3000 + 2000,
    })
  );
}

/**
 * 快速生成带 usage 的 N 轮纯文本对话历史，用于测试 compact token 阈值触发。
 */
export function makeTextHistoryWithUsage(
  pairs: Array<{ user: string; assistant: string; usage?: TokenUsage }>,
  /** 首轮开始时间（Unix ms），默认 1 小时前 */
  baseTime?: number
): TurnRecord[] {
  const base = baseTime ?? Date.now() - 60 * 60 * 1000;
  return pairs.map((p, i) => {
    const turn = makeTurn({
      userText: p.user,
      content: p.assistant,
      startTime: base + i * 3000,
      endTime: base + i * 3000 + 2000,
    });
    if (p.usage) {
      // 给 iteration 添加 usage
      if (turn.iterations.length > 0) {
        (turn.iterations[0] as any).usage = p.usage;
      }
    }
    return turn;
  });
}

/**
 * 快速生成包含工具调用的历史轮次。
 */
export function makeToolHistory(
  turns: Array<{
    user: string;
    assistant: string;
    toolCalls: ToolCallInput[];
  }>,
  baseTime?: number
): TurnRecord[] {
  const base = baseTime ?? Date.now() - 60 * 60 * 1000;
  return turns.map((t, i) =>
    makeTurn({
      userText: t.user,
      content: t.assistant,
      startTime: base + i * 5000,
      endTime: base + i * 5000 + 3000,
      iterations: [
        { toolCalls: t.toolCalls },
        { content: t.assistant },
      ],
    })
  );
}
