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
    message: string;
    attachments?: any[];
    meta?: Record<string, any>;
    /** 格式化后的消息文本（含 focus 等注入内容，不同于 message 时才存在） */
    userFormattedText?: string;
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
    usage?: {
      /** 输入 token 数（prompt tokens） */
      inputTokens?: number;
      /** 输出 token 数（completion tokens） */
      outputTokens?: number;
      /** 总 token 数 */
      totalTokens?: number;
      /** 缓存命中的输入 token 数（部分模型支持） */
      cachedInputTokens?: number;
    };
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

  // ── Tool / Function Call ──────────────────────────────────────────────────

  /**
   * 工具调用流式内容更新（LLM 输出 tool_calls 片段时逐帧触发）。
   * 早于 tool:call（后者在参数完整解析后触发）。
   * 用于在参数尚未完整时展示中间状态（如工具名、路径）。
   *   - `callId`    工具调用 ID（与后续 tool:call / tool:result / tool:error 一致）
   *   - `name`      工具名称（首帧即有值）
   *   - `argsDelta` 当前帧 arguments 片段（增量原始字符串）
   *   - `step`      所属 step 编号
   */
  "tool:content": {
    callId: string;
    name: string;
    argsDelta: string;
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
}
