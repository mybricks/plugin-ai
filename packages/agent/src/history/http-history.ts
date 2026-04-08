import type { History, Message } from "../types";

/** 基于 HTTP 接口的消息历史持久化 */
export class HTTPHistory implements History {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: { baseUrl: string; headers?: Record<string, string> }) {
    this.baseUrl = options.baseUrl;
    this.headers = options.headers ?? {};
  }

  private defaultHeaders() {
    return { "Content-Type": "application/json", ...this.headers };
  }

  async load(key: string): Promise<Message[]> {
    const res = await fetch(`${this.baseUrl}?key=${encodeURIComponent(key)}`, {
      headers: this.defaultHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? [];
  }

  async save(key: string, messages: Message[]): Promise<void> {
    await fetch(this.baseUrl, {
      method: "POST",
      headers: this.defaultHeaders(),
      body: JSON.stringify({ key, messages }),
    });
  }

  async clear(key: string): Promise<void> {
    await fetch(`${this.baseUrl}?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: this.defaultHeaders(),
    });
  }
}
