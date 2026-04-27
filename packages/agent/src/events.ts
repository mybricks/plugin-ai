import type { TokenUsage, TurnSender } from "./types";

// ─── SSE 风格事件类型 ─────────────────────────────────────────────────────────
//
// 事件分三类：
//   1. turn      —— 一次对话整体状态（start / complete / abort / error），只触发一次
//   2. llm       —— 每次 LLM 调用各触发一次（start → content* → complete），ReAct 多步时每 step 各一组
//   3. tool      —— function call（content / call / result / error）

export type AgentEventMap = {
  // ── 一次对话整体状态（只触发一次）─────────────────────────────────────────

  /**
   * 一次对话开始（用户发送消息时触发，整轮只触发一次）。
   *   - `message`     用户输入的消息文本
   *   - `attachments` 用户上传的附件
   */
  "turn:start": {
    /** 本轮 TurnRecord 的唯一 ID，与 agent.turns 中的 id 对应 */
    turnId: string;
    message: string;
    attachments?: any[];
    meta?: Record<string, any>;
    /** 格式化后的消息文本（含 focus 等注入内容，不同于 message 时才存在） */
    userFormattedText?: string;
    /** 发送者信息（由 formatUserMessage 返回，UI 展示时优先使用） */
    sender?: TurnSender;
  };

  /**
   * 中途失败后从失败点继续（`retry` 且已有 iterations）。
   * 在再次进入 ReAct 前触发；UI 可据此把同一条 turn 从 error 切回 pending，并恢复订阅后续 llm:*。
   */
  "turn:resume": {
    turnId: string;
  };

  /**
   * 一次对话正常结束（整轮只触发一次）。
   */
  "turn:complete": Record<string, never>;

  /**
   * 一次对话被主动取消（用户调用 abort() 或 cancel 信号触发）。
   * 整轮只触发一次。
   */
  "turn:abort": Record<string, never>;

  /**
   * 一次对话出错（网络失败、工具异常等非 abort 错误）。
   * 整轮只触发一次。
   */
  "turn:error": {
    error: any;
  };

  /**
   * Doom loop 警告：检测到连续 N 次完全相同的工具调用（相同 name + args）。
   * 触发后循环将中断并以当前状态 complete。
   *   - `toolName`  重复的工具名
   *   - `args`      重复的参数
   *   - `count`     连续重复次数
   */
  "turn:doom": {
    toolName: string;
    args: any;
    count: number;
  };

  // ── 单次 LLM 调用（每个 step 各触发一组：llm:start → llm:content × N → llm:complete）──

  /**
   * 单次 LLM 请求开始。
   *   - `step`      当前步骤编号（从 1 开始）
   *   - `startTime` LLM 开始响应的时间戳（Unix ms）
   */
  "llm:start": {
    step: number;
    startTime: number;
  };

  /**
   * 单次 LLM 请求正常完成。
   *   - `step`         当前步骤编号
   *   - `finishReason` LLM 本次停止原因（"stop" / "tool_calls" / "length" / "unknown"）
   *   - `usage`        本 step 的 token 消耗
   *   - `done`         true 表示这是整轮最后一次 LLM 完成（无更多 step）
   *   - `endTime`      LLM 结束响应的时间戳（Unix ms）
   */
  "llm:complete": {
    step: number;
    finishReason: string;
    usage?: TokenUsage;
    /** 是否整轮最后一次 LLM 完成（false 表示还有后续 step） */
    done: boolean;
    /** LLM 结束响应的时间戳（Unix ms） */
    endTime: number;
  };

  /**
   * LLM 输出增量（正文 + 思考内容合并为一个事件）。
   * 位于 llm:start 和 llm:complete 之间，每 step 内持续触发。
   *   - `delta`           当前帧正文增量（无正文时为空串）
   *   - `content`         截至当前累积正文
   *   - `thinkingDelta`   当前帧思考内容增量（无思考时为 undefined）
   *   - `thinkingContent` 截至当前累积思考内容（无思考时为 undefined）
   *   - `step`            所属 step 编号
   */
  "llm:content": {
    delta: string;
    content: string;
    thinkingDelta?: string;
    thinkingContent?: string;
    step: number;
  };

  /**
   * LLM 请求重试（网络瞬时故障自动重试时触发）。
   * 仅通知 UI "正在第 X 次重试，共 Y 次"，不影响状态机。
   *   - `step`        当前 LLM 调用的 step 编号
   *   - `attempt`     当前是第几次重试（从 1 开始）
   *   - `maxRetries`  最大重试次数
   */
  "llm:retry": {
    step: number;
    attempt: number;
    maxRetries: number;
  };

  // ── Tool / Function Call ──────────────────────────────────────────────────

  /**
   * 工具 args 流式输出（LLM 输出 tool_calls 片段时逐帧触发）。
   * 早于 tool:call（后者在参数完整解析后触发）。
   * 用于在参数尚未完整时 UI 提前渲染工具卡片（如提取文件名、预览内容）。
   *
   * SSE 语义：delta 为增量片段，content 为截至当前的累积全量。
   * UI 层直接使用 content 渲染，无需自己 append；断线重连时只需最新一帧即可恢复。
   *
   *   - `callId`  工具调用 ID（与后续 tool:call / tool:result / tool:error 一致）
   *   - `name`    工具名称（首帧即有值）
   *   - `delta`   当前帧 arguments 增量原始字符串
   *   - `content` 截至当前 arguments 累积全量原始字符串
   *   - `step`    所属 step 编号
   */
  "tool:args": {
    callId: string;
    name: string;
    delta: string;
    content: string;
    step: number;
  };

  /**
   * 工具调用开始（LLM 输出 function call，参数完整，开始执行）。
   *   - `callId`    唯一标识本次调用，与 tool:result / tool:error 对应
   *   - `name`      工具名称
   *   - `args`      工具参数（已解析为 JSON 对象）
   *   - `step`      所属 step 编号
   *   - `startTime` 工具开始执行的时间戳（Unix ms）
   */
  "tool:call": {
    callId: string;
    name: string;
    title?: string;
    args: any;
    step: number;
    startTime: number;
  };

  /**
   * 工具调用成功返回。
   *   - `callId`   对应 tool:call 的 callId
   *   - `name`     工具名称
   *   - `result`   工具返回结果
   *   - `step`     所属 step 编号
   *   - `endTime`  工具结束执行的时间戳（Unix ms）
   */
  "tool:result": {
    callId: string;
    name: string;
    result: any;
    step: number;
    endTime: number;
  };

  /**
   * 工具调用出错。
   *   - `callId`   对应 tool:call 的 callId
   *   - `name`     工具名称
   *   - `error`    错误信息
   *   - `step`     所属 step 编号
   *   - `endTime`  工具结束执行的时间戳（Unix ms）
   */
  "tool:error": {
    callId: string;
    name: string;
    error: any;
    step: number;
    endTime: number;
  };

  /**
   * 工具执行中的进度更新（工具在执行过程中通过 context.emitProgress() 主动触发）。
   *
   * 语义：覆盖快照，每次 data 为当前完整状态，UI 直接替换上一帧。
   * SSE 友好：断线重连时只需服务端补发最新一帧即可恢复 UI 状态，无需重放历史。
   * data 结构由工具自定义，文本流式输出建议在 data 中携带累积全量而非 delta。
   *
   *   - `callId`  对应 tool:call 的 callId
   *   - `name`    工具名称
   *   - `data`    自定义进度数据（覆盖式，由工具定义结构）
   *   - `step`    所属 step 编号
   */
  "tool:progress": {
    callId: string;
    name: string;
    data: any;
    step: number;
  };

  // ── Warmup iter 事件（对齐 llm:start / llm:content / llm:complete，前缀改为 warmup）──
  //
  // warmup 阶段（如 autoCompact）在 iterations[] 中插入一个 WarmupIter。
  // 事件顺序：warmup:start → warmup:content × N → warmup:complete
  // UI 侧用与普通 LLM iter 相同的 push / update 逻辑管理。

  /**
   * warmup 阶段开始（如 autoCompact 开始执行）。
   *   - `startTime`  开始时间（Unix ms）
   *   - `content`    初始展示文本（如 "启动中..."）
   */
  "warmup:start": {
    startTime: number;
    content: string;
  };

  /**
   * warmup 阶段内容更新（类比 llm:content，streaming 更新展示文本）。
   *   - `content`  当前完整文本（覆盖上一帧，UI 直接替换）
   */
  "warmup:content": {
    content: string;
  };

  /**
   * warmup 阶段结束（类比 llm:complete）。
   *   - `status`   最终状态：success / error
   *   - `content`  最终展示文本
   *   - `endTime`  结束时间（Unix ms）
   */
  "warmup:complete": {
    status: "success" | "error";
    content: string;
    endTime: number;
  };
};

type EventListener<T> = (data: T) => void;

export class AgentEvents {
  private listeners: Partial<{
    [K in keyof AgentEventMap]: Array<EventListener<AgentEventMap[K]>>;
  }> = {};

  on<K extends keyof AgentEventMap>(
    event: K,
    handler: EventListener<AgentEventMap[K]>
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [] as any;
    }
    (this.listeners[event] as any[]).push(handler);
    return () => {
      this.listeners[event] = (this.listeners[event] as any[]).filter(
        (h) => h !== handler
      ) as any;
    };
  }

  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]) {
    (this.listeners[event] ?? []).forEach((h: any) => h(data));
  }

  removeAllListeners() {
    this.listeners = {};
  }
}
