import type { CompactRecord, History, TurnRecord, VersionFile, VersionRecord } from "../types";

type SessionMessage = {
  id: number;
  role: "user" | "assistant" | "tool_call" | "tool_result" | "stopped";
  text?: string;
  name?: string;
  arguments?: any;
  result?: any;
  callId?: string;
  tag?: string;
  terminal?: boolean;
  attachments?: any[];
};

type SessionMessagesResponse = {
  messages: SessionMessage[];
  hasMore: boolean;
  oldestId: number;
  attachedNames?: string[];
};

/**
 * 基于会话消息接口的历史记录读取实现。
 *
 * 只实现读接口：load / loadTurns 从 /api/v1/sessions/{sessionId}/messages 拉取，
 * 并把服务端消息列表转换为 TurnRecord[] 供 UI 展示和上下文重建。
 *
 * 写接口（append/update/clear/版本快照）故意不实现，因为历史写入仍由本地 IDBHistory 负责。
 */
export class SessionHTTPHistory implements History {
  readonly persistMode = "turn" as const;
  private baseUrl: string;
  private apiKey: string;
  private getSessionId: () => string | undefined;

  constructor(options: {
    baseUrl: string;
    apiKey: string;
    getSessionId?: () => string | undefined;
  }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.getSessionId = options.getSessionId ?? (() => undefined);
  }

  /** 允许在创建对象后重新绑定 sessionId 来源。 */
  setGetSessionId(getter: () => string | undefined): void {
    this.getSessionId = getter;
  }

  private defaultHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async load(_key: string): Promise<TurnRecord[]> {
    const page = await this.fetchMessages();
    return this.messagesToTurns(page.messages);
  }

  async loadTurns(
    _key: string,
    options: { after?: string; before?: string; limit?: number },
  ): Promise<{ turns: TurnRecord[]; hasMore: boolean }> {
    const beforeId = options.before ? Number(options.before) : undefined;
    const afterId = options.after ? Number(options.after) : undefined;
    if ((options.before !== undefined && !Number.isFinite(beforeId)) ||
        (options.after !== undefined && !Number.isFinite(afterId))) {
      return { turns: [], hasMore: false };
    }
    const page = await this.fetchMessages({
      beforeId,
      limit: options.limit ?? 50,
    });
    let turns = this.messagesToTurns(page.messages);
    if (afterId) {
      turns = turns.filter((turn) => Number(turn.id) > afterId);
    }
    return { turns, hasMore: page.hasMore };
  }

  private async fetchMessages(params?: { beforeId?: number; limit?: number }): Promise<SessionMessagesResponse> {
    const sessionId = this.getSessionId();
    if (!sessionId) return { messages: [], hasMore: false, oldestId: 0 };
    const query = new URLSearchParams();
    if (params?.beforeId !== undefined) query.set("beforeId", String(params.beforeId));
    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    const queryString = query.toString();
    const url = `${this.baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages${queryString ? `?${queryString}` : ""}`;
    const res = await fetch(url, { headers: this.defaultHeaders() });
    if (!res.ok) {
      console.warn(`[SessionHTTPHistory] fetch messages failed: ${res.status} ${res.statusText}`);
      return { messages: [], hasMore: false, oldestId: 0 };
    }
    return (await res.json()) as SessionMessagesResponse;
  }

  private messagesToTurns(messages: SessionMessage[]): TurnRecord[] {
    const turns: TurnRecord[] = [];
    let current: TurnRecord | undefined;

    for (const message of messages) {
      if (message.role === "user") {
        if (current) turns.push(current);
        current = {
          id: `session-msg-${message.id}`,
          startTime: Date.now(),
          userText: message.text ?? "",
          userAttachments: message.attachments ?? [],
          iterations: [{
            content: "",
            toolCalls: [],
            startTime: Date.now(),
          }],
          status: "success",
        };
      } else if (message.role === "assistant") {
        if (!current) continue;
        const iter = current.iterations[current.iterations.length - 1];
        if (iter && !("type" in iter)) {
          iter.content = message.text ?? "";
          iter.endTime = Date.now();
        }
      } else if (message.role === "tool_call") {
        if (!current) continue;
        const iter = current.iterations[current.iterations.length - 1];
        if (iter && !("type" in iter)) {
          iter.toolCalls.push({
            callId: message.callId ?? String(message.id),
            name: message.name ?? "",
            args: message.arguments ?? {},
            status: "pending",
            execStartTime: Date.now(),
            execEndTime: 0,
          });
        }
      } else if (message.role === "tool_result") {
        if (!current) continue;
        const iter = current.iterations[current.iterations.length - 1];
        if (iter && !("type" in iter)) {
          const call = iter.toolCalls.find((c) => c.callId === message.callId);
          if (call) {
            const success = message.result !== undefined && message.result !== null && !(message.result instanceof Error);
            call.status = success ? "success" : "error";
            call.result = success ? { output: String(message.result) } : undefined;
            call.error = success ? undefined : String(message.result);
            call.execEndTime = Date.now();
          }
        }
      } else if (message.role === "stopped") {
        if (!current) continue;
        current.status = "abort";
        current.endTime = Date.now();
        const iter = current.iterations[current.iterations.length - 1];
        if (iter && !("type" in iter)) {
          iter.endTime = Date.now();
        }
      }
    }

    if (current) turns.push(current);
    return turns;
  }

  // ── 写接口：本实现只读，写操作交给本地 IDBHistory ──────────────────────────

  async append(_key: string, _record: TurnRecord): Promise<void> {
    // no-op：历史写入仍走本地 IDBHistory
  }

  async update(_key: string, _turnId: string, _patch: Partial<TurnRecord>): Promise<void> {
    // no-op
  }

  async clear(_key: string): Promise<void> {
    // no-op
  }

  async import(_key: string, _turns: TurnRecord[]): Promise<void> {
    // no-op
  }

  async loadCompact(_key: string): Promise<CompactRecord | null> {
    return null;
  }

  async saveCompact(_key: string, _record: CompactRecord): Promise<void> {
    // no-op
  }

  // ── 版本快照：本实现不支持 ──────────────────────────────────────────────────

  async listVersions(_key: string, _params: { pageSize: number; pageNum: number }): Promise<{ total: number; list: VersionRecord[] }> {
    return { total: 0, list: [] };
  }

  async addVersion(_key: string, _record: VersionRecord, _files: VersionFile[]): Promise<void> {
    // no-op
  }

  async getVersion(_versionId: string): Promise<VersionRecord | null> {
    return null;
  }

  async updateVersion(_versionId: string, _patch: Partial<Pick<VersionRecord, "summary">>): Promise<void> {
    // no-op
  }

  async getVersionFiles(_versionId: string): Promise<VersionFile[]> {
    return [];
  }
}
