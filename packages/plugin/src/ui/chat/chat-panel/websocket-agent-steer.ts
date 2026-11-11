import type { TurnRecord } from "../../../../../agent/src";
import type { ChatStreamState, LLMIter } from "./websocket-agent";

/** agent 需要提供给插话通道的能力（通道自身不依赖 WebSocketAgent 类型）。 */
export interface SteerChannelDeps {
  /** 发起 /chat/stream（steer:true）。 */
  openStream(
    body: {
      message: string;
      agentCode?: string;
      sessionId?: string;
      steer: true;
      attachments?: string[];
      variables?: Record<string, any>;
    },
    signal: AbortSignal,
  ): Promise<Response>;
  /** 上传图片类附件到会话文件接口，返回「文件名 → 上传结果」；无附件/不可上传时返回 null。 */
  uploadAttachments(
    attachments: any[],
    signal: AbortSignal,
  ): Promise<Map<string, any> | null>;
  readStream(
    response: Response,
    signal: AbortSignal,
    onEvent: (event: { name: string; data: any }) => boolean,
  ): Promise<boolean>;
  getSessionId(): string | undefined;
  getAgentCode(): string | undefined;
  buildVariables(extra?: Record<string, any>): Record<string, any> | undefined;
  /** 建立插话轮并开好首个 iter（广播 turn:start / llm:start）。 */
  beginTurn(text: string, clientMessageId?: string): ChatStreamState;
  appendDelta(state: ChatStreamState, delta: string): void;
  finishStream(state: ChatStreamState, finalAnswer?: unknown): void;
  /** 关闭 iter（done=true）。 */
  closeIter(iter: LLMIter): void;
  finishTurn(turn: TurnRecord, status: "success" | "abort" | "error", error?: unknown): void;
  /** 在途状态变化后通知 agent 重新计算 running。 */
  notifyRunning(): void;
}

export interface SteerParams {
  message: string;
  attachments?: any[];
  variables?: Record<string, any>;
  /** 调用方为这条消息分配的标识，建轮时随 turn:start 回传，用于 UI 精确对位。 */
  clientMessageId?: string;
}

/**
 * 轮中插话通道（平台原生 steer:true）。
 *
 * 平台对一条 steer 请求有两种结局：
 *  - 赶上了当前轮的工具步骤：正文留在原请求的主流上（steer_delivered），本流只有空 done；
 *  - 没赶上：滚成下一轮（steer_dropped），正文从**本流**返回。
 *
 * 本类负责后者的消费与通用生命周期（在途计数、abort、inboxId 映射）。
 */
export class SteerChannel {
  private inFlight = 0;
  private readonly aborts = new Set<AbortController>();
  /** 平台 inboxId → 客户端消息 id：主流上的 steer_delivered 只有 inboxId，靠它精确配对。 */
  private readonly inboxIds = new Map<number | string, string>();

  constructor(private readonly deps: SteerChannelDeps) {}

  /** 是否有插话在途（agent 用它参与 running 判定，避免本地队列抢跑）。 */
  get busy(): boolean {
    return this.inFlight > 0;
  }

  abortAll(): void {
    for (const controller of Array.from(this.aborts)) controller.abort();
  }

  /** 主流上的 steer_delivered：取出对应的 clientMessageId 并清除映射。 */
  takeClientId(inboxId: unknown): string | undefined {
    if (inboxId == null) return undefined;
    const id = this.inboxIds.get(inboxId as number | string);
    this.inboxIds.delete(inboxId as number | string);
    return id;
  }

  /** 主流上的 steer_dropped：该插话不会再走 delivered，清除映射。 */
  forget(inboxId: unknown): void {
    if (inboxId == null) return;
    this.inboxIds.delete(inboxId as number | string);
  }

  async run(params: SteerParams): Promise<void> {
    const sessionId = this.deps.getSessionId();
    if (!sessionId) throw new Error("A session is required to steer");

    // 从发起请求那一刻起就占用运行态：插话优先于本地队列，
    // 插话没结束前队列里的消息既不能发出、也不能上屏。
    this.inFlight += 1;
    this.deps.notifyRunning();

    const abort = new AbortController();
    this.aborts.add(abort);
    let state: ChatStreamState | undefined;
    let terminal = false;
    try {
      // 附件与普通轮一致：先上传到会话文件接口，再把文件名以 attachments 带进本轮请求。
      const fileResults = await this.deps.uploadAttachments(params.attachments ?? [], abort.signal);
      const fileNames = fileResults ? Array.from(fileResults.keys()) : [];

      const response = await this.deps.openStream(
        {
          message: params.message,
          agentCode: this.deps.getAgentCode(),
          sessionId,
          steer: true,
          variables: this.deps.buildVariables(params.variables),
          ...(fileNames.length > 0 ? { attachments: fileNames } : {}),
        },
        abort.signal,
      );
      terminal = await this.deps.readStream(response, abort.signal, (event) => {
        switch (event.name) {
          case "meta":
          case "done": {
            // 登记 inboxId → clientMessageId，供主流上的 delivered 精确找回本条提交。
            const inboxId = event.data?.steer?.inboxId;
            if (inboxId != null && params.clientMessageId) {
              this.inboxIds.set(inboxId, params.clientMessageId);
            }
            if (event.name === "meta") return false;

            // 没有 delta 但平台一次给了全文时也要建轮，否则只有气泡没有回复。
            const finalAnswer = event.data?.answer;
            if (!state && typeof finalAnswer === "string" && finalAnswer) {
              state = this.deps.beginTurn(params.message, params.clientMessageId);
            }
            if (state) this.deps.finishStream(state, finalAnswer);
            return true;
          }
          case "delta": {
            // 首个正文才建轮：插话被插入当前轮时本流没有任何正文，不产生多余气泡。
            if (!state) state = this.deps.beginTurn(params.message, params.clientMessageId);
            this.deps.appendDelta(
              state,
              typeof event.data === "string" ? event.data : String(event.data ?? ""),
            );
            return false;
          }
          case "stopped":
            if (state) {
              this.deps.closeIter(state.iter);
              this.deps.finishTurn(state.turn, "abort");
            }
            return true;
          case "error":
            console.warn("[WebSocketAgent] steer stream error:", event.data);
            if (state) this.deps.finishTurn(state.turn, "error", event.data?.message);
            return true;
          default:
            return false;
        }
      });
    } finally {
      // 兜底：流异常/无终局事件时，已建出来的插话轮不能停留在 pending。
      if (!terminal && state && !state.turn.endTime) {
        this.deps.finishTurn(state.turn, "abort");
      }
      this.inFlight -= 1;
      this.aborts.delete(abort);
      this.deps.notifyRunning();
      abort.abort();
    }
    if (!state) {
      // 本流没有正文：插话已被插入当前轮（正文在原请求的流上），或该轮已结束无内容。
      console.debug("[WebSocketAgent] steer finished without local turn:", params.message);
    }
  }
}
