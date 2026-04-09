import type { RequestAsStreamFn, ToolDescriptor } from "../../request/src";
import { AgentEvents } from "./events";
import type { Message, History, Tool, TurnRecord, ToolCallRecord } from "./types";
import { turnsToMessages } from "./types";
import { maskMessages, type MaskOptions } from "./mask";

export { AgentEvents };
export type { Message, History, Tool, TurnRecord, ToolCallRecord };
export type { MaskOptions };

// ─── AgentOptions ─────────────────────────────────────────────────────────────

export interface AgentOptions {
  /** 系统 prompt */
  system?: string;
  /**
   * agents.md：项目规范/规则文档。
   *
   * 对标 claude-code 的 CLAUDE.md 机制：
   *   - claude-code 从文件系统遍历加载 CLAUDE.md，通过 prependUserContext 以
   *     第一条 user 消息（包裹在 <system-reminder> 中）注入到每轮对话。
   *   - 此处采用相同方式：agentsMd 不追加到 system prompt，而是作为独立的
   *     user 消息插在历史记录之前，LLM 会将其视为背景上下文而非强制指令。
   *
   * 由 plugin 初始化时由调用方以字符串方式传入。
   */
  agentsMd?: string;
  /**
   * 动态上下文注入（异步）。
   * 每次请求前调用，返回的消息列表会插入到对话历史末尾、用户消息之前。
   */
  getContextMessages?: () => Promise<Message[]>;
  /** 工具列表（plugin 初始化时注册额外工具） */
  tools?: Tool[];
  /** 历史记录实现 */
  history?: History;
  /** 流式请求函数 */
  request: RequestAsStreamFn;
  /** Agent key（用于历史记录隔离，通常取 comId） */
  key?: string;
  /**
   * ReAct 循环最大 step 数（防止无限循环）。
   * 对标 opencode 的 agent.steps，默认 Infinity（不限制）。
   * 每次 LLM 响应 + 工具执行算一个 step。
   */
  maxSteps?: number;
  /**
   * Doom loop 检测阈值：连续多少次相同工具+参数视为死循环，触发 turn:doom 事件。
   * 默认 3，对标 opencode 的 DOOM_LOOP_THRESHOLD。
   * 触发后中断循环，以当前状态 complete。
   */
  doomLoopThreshold?: number;
  /**
   * 历史消息遮蔽配置。
   * 满足轮次或时间条件的历史 turn，其工具调用结果消息会被替换为占位符，
   * 用户附件也会被替换为文字占位符，以减少发给 LLM 的 token 量。
   * 不传则不遮蔽。
   */
  maskOptions?: MaskOptions;
  /**
   * 生命周期 hooks。
   */
  hooks?: {
    /**
     * 大模型发送请求前（用户回车后）的钩子，在 buildMessages 之前调用。
     * 可用于初始化快照、收集日志等准备工作。
     */
    beforeRequest?: (params: { message: string; attachments: any[] }) => Promise<void> | void;
  };
}

export interface RequestAIOptions {
  message: string;
  attachments?: any[];
  [key: string]: any;
}

// ─── 构建消息列表 ──────────────────────────────────────────────────────────────

/**
 * 构建本轮请求的完整 messages 列表：
 *
 * 对标 claude-code 的 prependUserContext 机制：
 *   agentsMd 不注入到 system prompt，而是作为第一条 user 消息，
 *   包裹在 <system-reminder> 标签中，提示 LLM "此上下文可能与任务有关或无关"。
 *   这样 agentsMd 始终位于消息列表最前，且与 system prompt 独立，
 *   便于 prompt cache 复用（system prompt 不因 agentsMd 变化而失效）。
 *
 *   [0]       system message（仅包含内置系统提示词）
 *   [1]       agentsMd user message（仅当 agentsMd 非空时存在）
 *   [2..N]    历史对话（从 TurnRecord[] 重建）
 *   [N+1..M]  动态上下文消息（每轮异步获取）
 *   [last]    本轮用户消息
 */
async function buildMessages(
  options: AgentOptions,
  turns: TurnRecord[],
  params: RequestAIOptions
): Promise<Message[]> {
  const { system, agentsMd, getContextMessages } = options;
  const { message, attachments } = params;

  const systemMessage: Message | null = system
    ? { role: "system", content: system }
    : null;

  // agentsMd 以独立 user 消息注入，对标 claude-code 的 prependUserContext 机制：
  // 包裹在 <system-reminder> 中，告知 LLM 此上下文可能与当前任务相关或无关。
  const agentsMdMessage: Message | null = agentsMd
    ? {
        role: "user",
        content:
          `<system-reminder>\n` +
          `As you answer the user's questions, you can use the following context:\n` +
          `# agents.md\n${agentsMd}\n\n` +
          `IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.\n` +
          `</system-reminder>`,
      }
    : null;

  const rawMessages = [
    ...(systemMessage ? [systemMessage] : []),
    ...(agentsMdMessage ? [agentsMdMessage] : []),
    ...turnsToMessages(turns),
  ];

  const contextMessages: Message[] = getContextMessages
    ? await getContextMessages()
    : [];

  let userContent: Message["content"] = message;
  if (attachments?.length) {
    userContent = [
      { type: "text", text: message },
      ...attachments.map((a: any) => ({
        type: "image_url",
        image_url: { url: a.url ?? a.content },
      })),
    ];
  }
  const userMessage: Message = { role: "user", content: userContent };

  const assembled = [...rawMessages, ...contextMessages, userMessage];

  // 应用遮蔽（仅当配置了 maskOptions）
  if (options.maskOptions) {
    return maskMessages(assembled, turns, options.maskOptions);
  }

  return assembled;
}

// ─── 构建工具描述列表 ──────────────────────────────────────────────────────────

function buildToolDescriptors(tools?: Tool[]): ToolDescriptor[] | undefined {
  return tools?.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

// ─── 单次 LLM 请求结果 ─────────────────────────────────────────────────────────

interface LLMCallResult {
  content: string;
  thinkingContent: string;
  toolCalls: Array<{ id: string; name: string; args: any }>;
  /**
   * LLM 本次停止原因（来自 finish_reason）。
   * - "stop"       正常结束
   * - "tool_calls" 有工具调用需继续
   * - "length"     token 超限
   * - "unknown"    未知 / 模型未返回
   */
  finishReason: string;
  usage?: any;
  aborted: boolean;
}

function callLLM(
  options: AgentOptions,
  messages: Message[],
  signal: AbortSignal,
  rest: Record<string, any>,
  step: number,
  onContent: (delta: string, content: string, thinkingDelta?: string, thinkingContent?: string) => void,
  onToolStreaming: (callId: string, name: string, argsDelta: string) => void
): Promise<LLMCallResult> {
  return new Promise<LLMCallResult>((resolve, reject) => {
    let content = "";
    let thinkingContent = "";
    let toolCalls: Array<{ id: string; name: string; args: any }> = [];
    let finishReason = "unknown";
    let aborted = false;
    // index → { callId, name } 映射（在 callLLM 内维护）
    const indexToCallInfo = new Map<number, { callId: string; name: string }>();

    if (signal.aborted) {
      resolve({ content, thinkingContent, toolCalls, finishReason, aborted: true });
      return;
    }

    const onAbort = () => {
      aborted = true;
      resolve({ content, thinkingContent, toolCalls, finishReason, aborted: true });
    };
    signal.addEventListener("abort", onAbort);

    options.request({
      messages,
      tools: buildToolDescriptors(options.tools),
      emits: {
        write: (chunk: string) => {
          if (aborted) return;
          content += chunk;
          onContent(chunk, content);
        },
        complete: (usage?: any) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted) return;
          resolve({ content, thinkingContent, toolCalls, finishReason, usage, aborted: false });
        },
        error: (e: any) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted) return;
          reject(e);
        },
        cancel: (fn: () => void) => {
          signal.addEventListener("abort", fn);
        },
        onThinking: (chunk: string) => {
          if (aborted) return;
          thinkingContent += chunk;
          onContent("", content, chunk, thinkingContent);
        },
        onToolCalls: (calls) => {
          if (aborted) return;
          toolCalls = calls;
        },
        onToolCallStream: (delta) => {
          if (aborted) return;
          const { index, id, name, argsChunk } = delta;
          if (id && name && !indexToCallInfo.has(index)) {
            // 首帧：记录 callId + name
            indexToCallInfo.set(index, { callId: id, name });
            onToolStreaming(id, name, argsChunk ?? "");
          } else if (argsChunk) {
            // 后续帧：只有 args 增量
            const info = indexToCallInfo.get(index);
            if (info) onToolStreaming(info.callId, info.name, argsChunk);
          }
        },
        onFinishReason: (reason: string) => {
          if (aborted) return;
          finishReason = reason;
        },
      },
      ...rest,
    });
  });
}

// ─── Doom loop 检测辅助 ────────────────────────────────────────────────────────

/**
 * 检查最近 N 次工具调用历史中是否有连续相同的调用。
 * 遍历整个历史（所有 steps），找出针对某个工具的最近连续相同 args 序列长度。
 */
function getDoomLoopCount(
  toolHistory: Array<{ name: string; argsKey: string }>,
  toolName: string,
  argsKey: string
): number {
  let count = 0;
  // 从最新往前找连续匹配
  for (let i = toolHistory.length - 1; i >= 0; i--) {
    const entry = toolHistory[i];
    if (entry.name === toolName && entry.argsKey === argsKey) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class Agent {
  readonly events = new AgentEvents();
  readonly key: string | undefined;
  protected options: AgentOptions;
  /** 历史调用记录（SSE 事件粒度），从 History 加载，每轮 complete/abort/error 后 append */
  protected turns: TurnRecord[] = [];
  private _abortController: AbortController | null = null;

  constructor(options: AgentOptions) {
    this.options = options;
    this.key = options.key;
  }

  /** 加载历史调用记录 */
  async loadHistory(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) {
      this.turns = await history.load(key);
    }
  }

  /** 清除历史 */
  async clearHistory(): Promise<void> {
    const { history, key } = this.options;
    if (history && key) await history.clear(key);
    this.turns = [];
  }

  /** 获取历史调用记录（供 UI 直接使用） */
  getTurns(): TurnRecord[] {
    return this.turns;
  }

  /** 主动取消当前请求，触发 turn:abort */
  abort() {
    this._abortController?.abort();
  }

  /**
   * 发起 AI 请求（ReAct 循环）。
   *
   * 循环终止条件（对标 opencode prompt.ts）：
   *   1. finishReason 不是 "tool_calls" 也不是 "unknown" → 模型主动结束
   *   2. 超出 maxSteps
   *   3. Doom loop 触发（连续 doomLoopThreshold 次完全相同的工具调用）
   *   4. 用户 abort()
   */
  async requestAI(params: RequestAIOptions): Promise<void> {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const { message, attachments, ...rest } = params;
    const { key, history } = this.options;
    const maxSteps = this.options.maxSteps ?? Infinity;
    const doomLoopThreshold = this.options.doomLoopThreshold ?? 3;

    // ── 构建本轮 TurnRecord
    const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const userAttachments = (attachments ?? []).map((a: any) => ({
      type: a.type ?? "image",
      content: a.url ?? a.content ?? "",
    }));

    const turn: TurnRecord = {
      id: turnId,
      startTime: Date.now(),
      userText: message,
      userAttachments,
      content: "",
      thinkingContent: "",
      iterations: [],
      status: "success",
    };

    const stepStartTime = Date.now();
    this.events.emit("turn:start", { message, attachments });
    this.events.emit("llm:start", { step: 1, startTime: stepStartTime });

    // ── 执行 beforeRequest hook（在 buildMessages 之前，确保快照时机正确）
    await this.options.hooks?.beforeRequest?.({ message, attachments: attachments ?? [] });

    let messages = await buildMessages(this.options, this.turns, params);

    const persistTurn = async () => {
      this.turns = [...this.turns, turn];
      if (history && key) {
        await history.append(key, turn).catch(console.error);
      }
    };

    // doom loop 用：扁平化的工具调用序列（跨 step）
    const toolCallHistory: Array<{ name: string; argsKey: string }> = [];

    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await persistTurn();
          this.events.emit("turn:abort", {});
          return;
        }

        // step > 1 时通知新的一次 LLM 调用开始
        let stepLLMStartTime = step === 1 ? stepStartTime : Date.now();
        if (step > 1) {
          stepLLMStartTime = Date.now();
          this.events.emit("llm:start", { step, startTime: stepLLMStartTime });
        }

        // ── 调用 LLM
        let llmResult: LLMCallResult;
        try {
          llmResult = await callLLM(
            this.options,
            messages,
            signal,
            rest,
            step,
            (delta, content, thinkingDelta, thinkingContent) => {
              this.events.emit("llm:content", { delta, content, thinkingDelta, thinkingContent, step });
            },
            (callId, name, argsDelta) => {
              this.events.emit("tool:content", { callId, name, argsDelta, step });
            }
          );
        } catch (e) {
          turn.endTime = Date.now();
          turn.status = "error";
          turn.error = String((e as any)?.message ?? e);
          await persistTurn();
          this.events.emit("turn:error", { error: e });
          throw e;
        }

        if (llmResult.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await persistTurn();
          this.events.emit("turn:abort", {});
          return;
        }

        // ── 记录本次迭代
        const iterToolCallRecords: ToolCallRecord[] = [];
        const iterEndTime = Date.now();
        const currentIter: TurnRecord["iterations"][number] = {
          content: llmResult.content,
          toolCalls: iterToolCallRecords,
          startTime: stepLLMStartTime,
          endTime: iterEndTime,
          ...(llmResult.thinkingContent ? { thinkingContent: llmResult.thinkingContent } : {}),
        };
        turn.iterations.push(currentIter);
        turn.thinkingContent += llmResult.thinkingContent;
        if (llmResult.usage) turn.usage = llmResult.usage;

        // ── 判断是否终止（对标 opencode 的 modelFinished 判断）
        // finishReason 不是 "tool_calls" 也不是 "unknown" → 模型主动结束
        const modelFinished = !["tool_calls", "unknown"].includes(llmResult.finishReason);
        if (modelFinished) {
          turn.content = llmResult.content;
          turn.endTime = iterEndTime;
          turn.status = "success";
          await persistTurn();
          this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: llmResult.usage, done: true, endTime: turn.endTime });
          this.events.emit("turn:complete", {});
          return;
        }

        // ── 有工具调用 → 执行工具
        if (llmResult.toolCalls.length === 0) {
          // finishReason 是 tool_calls 但实际没有解析到工具调用（异常情况）
          // 同样视为结束
          turn.content = llmResult.content;
          turn.endTime = iterEndTime;
          turn.status = "success";
          await persistTurn();
          this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: llmResult.usage, done: true, endTime: turn.endTime });
          this.events.emit("turn:complete", {});
          return;
        }

        // 本 step 有工具调用，通知 llm:complete（done: false，还有后续 step）
        this.events.emit("llm:complete", { step, finishReason: llmResult.finishReason, usage: llmResult.usage, done: false, endTime: iterEndTime });

        // 将 assistant 消息（带 tool_calls）追加到 messages
        const assistantMsg: Message = {
          role: "assistant",
          content: llmResult.content,
          ...(llmResult.thinkingContent ? { reasoning_content: llmResult.thinkingContent } : {}),
          tool_calls: llmResult.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args),
            },
          })),
        };
        messages = [...messages, assistantMsg];

        // 逐个执行工具
        const toolResultMessages: Message[] = [];
        let doomLoopTriggered = false;

        for (let tcIdx = 0; tcIdx < llmResult.toolCalls.length; tcIdx++) {
          const tc = llmResult.toolCalls[tcIdx];
          if (signal.aborted) break;

          // ── Doom loop 检测
          const argsKey = JSON.stringify(tc.args);
          toolCallHistory.push({ name: tc.name, argsKey });
          const doomCount = getDoomLoopCount(toolCallHistory, tc.name, argsKey);
          if (doomCount >= doomLoopThreshold) {
            this.events.emit("turn:doom", { toolName: tc.name, args: tc.args, count: doomCount });
            doomLoopTriggered = true;
            break;
          }

          const execStartTime = Date.now();
          const toolRecord: ToolCallRecord = {
            callId: tc.id,
            name: tc.name,
            args: tc.args,
            status: "success",
            execStartTime,
            execEndTime: 0,
          };
          iterToolCallRecords.push(toolRecord);

          this.events.emit("tool:call", { callId: tc.id, name: tc.name, args: tc.args, step, startTime: execStartTime });

          const tool = this.options.tools?.find((t) => t.name === tc.name);
          let toolResultContent: string;

          if (!tool) {
            const err = new Error(`Tool not found: ${tc.name}`);
            toolRecord.status = "error";
            toolRecord.error = err.message;
            toolRecord.execEndTime = Date.now();
            toolResultContent = `Error: ${err.message}`;
            this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: err, step, endTime: toolRecord.execEndTime });
          } else {
            try {
              // 参数校验
              tool.validate?.(tc.args);
              const result = await tool.execute(tc.args);
              if (signal.aborted) {
                toolRecord.status = "error";
                toolRecord.error = "用户已取消";
                toolRecord.execEndTime = Date.now();
                toolResultContent = `Error: 用户已取消`;
                this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: "用户已取消", step, endTime: toolRecord.execEndTime });
              } else {
                toolRecord.result = result.metadata ?? {};
                toolRecord.execEndTime = Date.now();
                toolResultContent = result.output;
                this.events.emit("tool:result", { callId: tc.id, name: tc.name, result: toolRecord.result, step, endTime: toolRecord.execEndTime });
              }
            } catch (e) {
              toolRecord.status = "error";
              toolRecord.error = signal.aborted ? "用户已取消" : String((e as any)?.message ?? e);
              toolRecord.execEndTime = Date.now();
              toolResultContent = `Error: ${toolRecord.error}`;
              this.events.emit("tool:error", { callId: tc.id, name: tc.name, error: e, step, endTime: toolRecord.execEndTime });
            }
          }

          toolResultMessages.push({
            role: "tool",
            content: toolResultContent,
            tool_call_id: tc.id,
          });
        }

        if (signal.aborted) {
          turn.status = "abort";
          turn.endTime = Date.now();
          await persistTurn();
          this.events.emit("turn:abort", {});
          return;
        }

        // doom loop 触发 → 停止
        if (doomLoopTriggered) {
          const lastIter = turn.iterations[turn.iterations.length - 1];
          turn.content = lastIter?.content ?? "";
          turn.endTime = Date.now();
          turn.status = "success";
          await persistTurn();
          this.events.emit("llm:complete", { step, finishReason: "stop", usage: turn.usage, done: true, endTime: turn.endTime });
          this.events.emit("turn:complete", {});
          return;
        }

        // 将工具结果追加到 messages，进入下一轮迭代
        messages = [...messages, ...toolResultMessages];
      }

      // 超出 maxSteps
      const lastIter = turn.iterations[turn.iterations.length - 1];
      turn.content = lastIter?.content ?? "";
      turn.endTime = Date.now();
      turn.status = "success";
      await persistTurn();
      this.events.emit("llm:complete", { step: maxSteps, finishReason: "length", usage: turn.usage, done: true, endTime: turn.endTime });
      this.events.emit("turn:complete", {});
    } catch (e) {
      if (turn.status !== "abort") {
        turn.endTime = Date.now();
        turn.status = "error";
        turn.error = String((e as any)?.message ?? e);
        await persistTurn();
        this.events.emit("turn:error", { error: e });
      }
      throw e;
    }
  }
}
