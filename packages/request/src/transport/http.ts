import type { RequestAsStreamEmits } from "../types";

export function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.message.toLowerCase().includes("aborted"))
  );
}

export async function readErrorText(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (!text) return response.statusText || `HTTP ${response.status}`;
    try {
      const data = JSON.parse(text);
      const message = data?.message ?? data?.error?.message ?? data?.error;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      // use the original response text
    }
    return text;
  } catch {
    return response.statusText || `HTTP ${response.status}`;
  }
}

export interface StreamingRequestOptions {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  emits: RequestAsStreamEmits;
  credentials?: RequestCredentials;
  /** 兼容旧请求入口：上报 error 后不继续抛出。默认 true。 */
  rethrow?: boolean;
  readStream: (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    emits: RequestAsStreamEmits,
  ) => Promise<void>;
}

/** 所有直连模型协议共用的 HTTP 流式传输。 */
export async function executeStreamingRequest(
  options: StreamingRequestOptions,
): Promise<void> {
  const controller = new AbortController();
  options.emits.cancel(() => controller.abort());

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch(options.url, {
      signal: controller.signal,
      method: "POST",
      credentials: options.credentials,
      headers: options.headers,
      body: JSON.stringify(options.body),
    });
    if (!response.ok) {
      const detail = await readErrorText(response);
      throw new Error(`API request failed [${response.status}]: ${detail}`);
    }
    if (!response.body) throw new Error("empty response body");

    reader = response.body.getReader();
    await options.readStream(reader, options.emits);
  } catch (error) {
    if (isAbortError(error)) return;
    const normalized = error instanceof Error ? error : new Error(String(error));
    options.emits.error(normalized);
    if (options.rethrow !== false) throw normalized;
  } finally {
    try {
      await reader?.cancel();
    } catch {
      // ignore reader cleanup failures
    }
  }
}

/** 读取不带协议事件的纯文本流，供旧版 MyBricks stream 接口复用。 */
export async function readTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  emits: RequestAsStreamEmits,
): Promise<void> {
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk) emits.write(chunk);
  }
  const tail = decoder.decode();
  if (tail) emits.write(tail);
  emits.complete("");
}
