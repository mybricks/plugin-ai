import forge from "node-forge";
import { isProduction } from "./env";
import { createCustomRequest as createCustomOpenAIRequest } from "./custom";
import { readSSEStream } from "./sse-parser";
import type {
  ExtraHeadersInput,
  OnUploadFn,
  RequestAsStreamFn,
  RequestAsStreamParams,
  TokenUsage,
  ToolCallSpec,
  ToolCallStreamDelta,
} from "./types";

const REQUEST_INFRA_VERSION = "1.1.2";
const _u = [50, 46, 46, 42, 41, 96, 117, 117, 57, 62, 52, 60, 51, 54, 63, 116, 57, 53, 40, 42, 116, 49, 47, 59, 51, 41, 50, 53, 47, 116, 57, 53, 55, 117, 49, 57, 117, 60, 51, 54, 63, 41, 117, 59, 117, 60, 59, 52, 61, 32, 50, 53, 47, 117, 40, 63, 43, 47, 63, 41, 46, 119, 51, 52, 60, 40, 59, 117];
const _k = 0x5a;

function getRequestInfraConfigUrl(): string {
  return String.fromCharCode(..._u.map((x) => x ^ _k)) + REQUEST_INFRA_VERSION + "/config.json";
}

let cachedRequestInfraFn: RequestAsStreamFn | null | undefined = undefined;

export async function loadRequestInfraFromCDN(): Promise<RequestAsStreamFn | null> {
  if (cachedRequestInfraFn !== undefined) return cachedRequestInfraFn;
  const configUrl = getRequestInfraConfigUrl();
  if (!configUrl.trim()) {
    cachedRequestInfraFn = null;
    return null;
  }
  try {
    const res = await fetch(toAbsoluteHttpsUrl(configUrl));
    if (!res.ok) {
      cachedRequestInfraFn = null;
      return null;
    }
    const config = (await res.json()) as { url?: string };
    const jsRelative = config?.url;
    if (!jsRelative || typeof jsRelative !== "string") {
      cachedRequestInfraFn = null;
      return null;
    }
    const baseUrl = configUrl.replace(/\/[^/]*$/, "/");
    const scriptUrl = jsRelative.startsWith("http") ? jsRelative : baseUrl + jsRelative;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load request-infra: ${scriptUrl}`));
      document.head.appendChild(script);
    });
    const cdzdNS = (window as any).cdzd;
    const fn =
      (cdzdNS && typeof cdzdNS.requestAsStreamInfra === "function"
        ? cdzdNS.requestAsStreamInfra
        : (window as any).requestAsStreamInfra) ?? null;
    if (typeof fn !== "function") {
      cachedRequestInfraFn = null;
      return null;
    }
    cachedRequestInfraFn = fn as RequestAsStreamFn;
    return cachedRequestInfraFn;
  } catch {
    cachedRequestInfraFn = null;
    return null;
  }
}

export function toAbsoluteHttpsUrl(url: string): string {
  if (typeof window === "undefined" || !window.location?.protocol) return url;
  const p = window.location.protocol;
  if (p === "http:" || p === "https:") return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return "https://" + window.location.host + url;
  return url;
}

function generateRandomKey(length: number) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function getAiEncryptData(data: unknown) {
  if (!isProduction()) return data;
  const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1ITWRl6ePMu7Fhusup2d
FEz/hCRTE5mUIeGIjtezG5g8ewBdTaR2FRxtTFONYTaaSR6yFXm9k74tkS1/i0Z8
7eIV130XydOn4zFhk2sOkG46mQ+lZwJkyVwvMaAOCnHluTIaPMPMV3sYpp3cWspl
2H++R5/kOGVm6EG9HivrimQEKDDJLg9owbfWO2kSEM9ZpUHUt29msYq+lDtBrivG
oodvC8p5H4a/jXKvLtPRGO09ZO3xk1ktS8isc376Ec9L9Zo8wSwaj5Z/Pg7nd7Sa
tqj5BEj3YH8rSr1dg77ZMMH1lsuzdA0NHmRGYEvWnUoD6dMqjJjufNwAw9D47DQH
lwIDAQAB
-----END PUBLIC KEY-----`;

  const AESKey = generateRandomKey(16);
  const cipher = forge.cipher.createCipher("AES-CBC", AESKey);
  cipher.start({ iv: AESKey });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(JSON.stringify(data))));
  cipher.finish();
  const encryptedData = forge.util.encode64(cipher.output.getBytes());
  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY);
  const encryptedAESKey = forge.util.encode64(publicKey.encrypt(AESKey));
  return { chatContent: encryptedData, chatKey: encryptedAESKey };
}

const logger = {
  info(message: string) {
    console.log("%c%s%c %s", "background-color: #fa6400; color: #ffffff;padding: 0px 6px", "AI-SDK", "color: #ffffff", message);
  },
};

enum FetchTarget {
  CustomApp = "CustomApp",
  Platform = "Platform",
  Center = "Center",
}

let fetchTaget: FetchTarget;

async function checkFetchTarget(): Promise<FetchTarget> {
  if (fetchTaget) return Promise.resolve(fetchTaget);

  const hasAICustomApp = await fetch(toAbsoluteHttpsUrl("/api/ai-service/check-config"))
    .then((res) => res.json())
    .then((data: any) => data?.code === 1)
    .catch(() => false);

  if (hasAICustomApp) {
    logger.info("使用自定义服务");
    return (fetchTaget = FetchTarget.CustomApp);
  }

  const hasPlatformToken = await fetch(toAbsoluteHttpsUrl("/api/assistant/status"))
    .then((res) => res.json())
    .then((data: any) => data?.code === 1)
    .catch(() => false);

  if (hasPlatformToken) {
    logger.info("使用平台服务");
    return (fetchTaget = FetchTarget.Platform);
  }

  logger.info("使用AI服务");
  return (fetchTaget = FetchTarget.Center);
}

const STREAM_URL_BY_TARGET: Record<FetchTarget, string> = {
  [FetchTarget.CustomApp]: "/api/ai-service/stream",
  [FetchTarget.Platform]: "/api/assistant/stream",
  [FetchTarget.Center]: "//ai.mybricks.world/stream-with-tools",
};

const STREAM_SSE_URL_BY_TARGET: Record<FetchTarget, string> = {
  [FetchTarget.CustomApp]: "/api/ai-service/sse",
  [FetchTarget.Platform]: "/api/assistant/sse",
  [FetchTarget.Center]: "//ai.mybricks.world/sse",
  // [FetchTarget.Center]: "//localhost:4000/sse",
};

/**
 * 发送给 LLM 前清理 messages 中的内部扩展字段（status、errorType、cache 等），
 * 这些字段仅供 agent 内部使用，不是标准 OpenAI / Anthropic 消息格式的一部分。
 */
export function sanitizeMessages(messages: any[]): any[] {
  return messages.map((msg) => {
    // 移除不应发送到 API 的内部字段：
    // - status / errorType：工具调用状态，供内部感知用
    // - cache：prompt cache 标记，已在发送前转换为对应格式
    // - attachments：tool result 附件，已在 preprocessMessagesForModel 中处理，无需裸发
    const { status, errorType, cache, attachments: _attachments, ...rest } = msg;
    return rest;
  });
}

type AttachmentInputKey = "image" | "pdf";
type MessageAttachment = {
  type?: string;
  content?: string;
  url?: string;
  filename?: string;
  title?: string;
  mime?: string;
  mediaType?: string;
};
type ModelCapabilityLike = { input?: { image?: boolean; pdf?: boolean }; toolResultMedia?: boolean };

/**
 * 将附件类型或 MIME 映射到 ModelCapabilities.input 的字段名。
 * 返回 undefined 表示无需做当前能力判断。
 */
function attachmentTypeToInputKey(type?: string): AttachmentInputKey | undefined {
  if (!type) return undefined;
  if (type === "image" || type.startsWith("image/")) return "image";
  if (type === "pdf" || type === "application/pdf") return "pdf";
  return undefined;
}

function getDataUrlMime(value?: string): string | undefined {
  if (!value?.startsWith("data:")) return undefined;
  return value.split(";")[0].replace("data:", "") || undefined;
}

function isHttpUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value);
}

function inferMimeFromUrl(value?: string): string | undefined {
  if (!value || !isHttpUrl(value)) return undefined;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif)$/.test(pathname)) return "image";
    if (/\.pdf$/.test(pathname)) return "application/pdf";
  } catch {
    return undefined;
  }
  return undefined;
}

function getAttachmentResource(attachment: MessageAttachment): string {
  return attachment.url ?? attachment.content ?? "";
}

function getAttachmentInputKey(attachment: MessageAttachment): AttachmentInputKey | undefined {
  const resource = getAttachmentResource(attachment);
  return (
    attachmentTypeToInputKey(attachment.type) ??
    attachmentTypeToInputKey(attachment.mime) ??
    attachmentTypeToInputKey(attachment.mediaType) ??
    attachmentTypeToInputKey(getDataUrlMime(resource)) ??
    attachmentTypeToInputKey(inferMimeFromUrl(resource))
  );
}

function isSupportedInput(inputKey: AttachmentInputKey | undefined, capabilities?: ModelCapabilityLike): boolean {
  if (!inputKey) return true;
  return capabilities?.input?.[inputKey] ?? true;
}

function unsupportedInputText(inputKey: AttachmentInputKey, filename?: string): any {
  const name = filename ? `"${filename}"` : inputKey;
  return {
    type: "text",
    text: `ERROR: Cannot read ${name} (this model does not support ${inputKey} input). Inform the user.`,
  };
}

function messagePartToInputKey(part: any): AttachmentInputKey | undefined {
  if (part.type === "image" || part.type === "image_url") {
    const rawMime = getDataUrlMime(part.image_url?.url ?? part.url ?? part.content);
    const urlMime = inferMimeFromUrl(part.image_url?.url ?? part.url ?? part.content);
    return attachmentTypeToInputKey(part.semanticType ?? rawMime ?? urlMime ?? "image");
  }
  if (part.type === "file") {
    const rawMime = getDataUrlMime(part.file?.file_data ?? part.file?.url ?? part.content);
    return attachmentTypeToInputKey(part.semanticType ?? part.mime ?? part.mediaType ?? rawMime);
  }
  return undefined;
}

function messagePartFilename(part: any): string | undefined {
  return part.filename ?? part.file?.filename;
}

export function attachmentToMessagePart(attachment: MessageAttachment): any {
  const content = getAttachmentResource(attachment);
  const filename = attachment.filename ?? attachment.title;
  const inputKey = getAttachmentInputKey(attachment);

  if (inputKey === "image") {
    return {
      type: "image_url" as const,
      image_url: { url: content, detail: "auto" },
    };
  }

  if (inputKey === "pdf") {
    if (isHttpUrl(content)) {
      return {
        type: "text" as const,
        text: `Attached PDF URL${filename ? ` (${filename})` : ""}: ${content}`,
      };
    }

    return {
      type: "file" as const,
      file: {
        filename: filename ?? "attachment.pdf",
        file_data: content,
      },
      semanticType: "pdf",
    };
  }

  if (isHttpUrl(content)) {
    return {
      type: "text" as const,
      text: `Attached file URL${filename ? ` (${filename})` : ""}: ${content}`,
    };
  }

  return {
    type: "file" as const,
    file: {
      filename: filename ?? "attachment",
      file_data: content,
    },
  };
}

function attachmentToSupportedMessagePart(attachment: MessageAttachment, capabilities?: ModelCapabilityLike): any {
  const filename = attachment.filename ?? attachment.title;
  const inputKey = getAttachmentInputKey(attachment);

  if (!isSupportedInput(inputKey, capabilities)) {
    return unsupportedInputText(inputKey!, filename);
  }

  return attachmentToMessagePart(attachment);
}

/**
 * 对发送给 LLM 的 messages 做多模态预处理（在 sanitizeMessages 之前调用）。
 *
 * 处理两类附件：
 *
 * 1. role=user 消息中的 image_url / file part（用户上传的图片、PDF）：
 *    - capabilities.input[modality]=true → 直接透传
 *    - capabilities.input[modality]=false → 替换为 ERROR 文本提示，告知 LLM 不支持
 *    - 图片 URL 和 data URL 都走 image_url.url
 *    - PDF/文件按 Chat Completions 的 file part 发送：filename + file_data
 *
 * 2. role=tool 消息中的 attachments 字段（工具执行产出的图片、PDF）：
 *    - attachments 内部格式支持 content/url，content 可为 data URL 或普通 URL
 *    - capabilities.toolResultMedia=true → 内嵌到 content 数组末尾
 *    - capabilities.toolResultMedia=false → 从 tool result 移出，在紧随其后注入合成 user 消息：
 *        { role: "user", content: [{ type: "text", text: "Attached file(s) from tool result:" }, ...mediaParts] }
 *
 * capabilities 不传时视为全支持，但仍会把 tool attachments 转成可发送的 content parts。
 *
 * @param messages 原始 messages（sanitize 之前）
 * @param capabilities 当前 model 的 ModelCapabilities；不传 = 全支持
 */
export function preprocessMessagesForModel(
  messages: any[],
  capabilities?: ModelCapabilityLike
): any[] {
  const result: any[] = [];
  let pendingMediaParts: any[] = [];

  for (const msg of messages) {
    // ── role=user：先把之前收集的 pending 附件注入，再过滤不支持的 file part ──────
    if (msg.role === "user") {
      if (pendingMediaParts.length > 0) {
        result.push({
          role: "user",
          content: [
            { type: "text", text: "Attached file(s) from tool result:" },
            ...pendingMediaParts,
          ],
        });
        pendingMediaParts = [];
      }

      const content = msg.content;
      if (!Array.isArray(content)) {
        result.push(msg);
        continue;
      }

      const filtered = content.map((part: any) => {
        if (part.type !== "image_url" && part.type !== "file" && part.type !== "image") {
          return part;
        }
        const inputKey = messagePartToInputKey(part);
        if (!inputKey) return part;

        if (isSupportedInput(inputKey, capabilities)) return part;

        return unsupportedInputText(inputKey, messagePartFilename(part));
      });

      result.push({ ...msg, content: filtered });
      continue;
    }

    // ── role=tool：处理 attachments 字段 ─────────────────────────────────────
    // attachments 格式：{ type: string; content?: string; url?: string; filename?: string }
    // 与 requestAI attachments / TurnRecord.userAttachments 对齐
    if (msg.role === "tool" && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
      const mediaAttachments: MessageAttachment[] =
        msg.attachments.filter((a: any) =>
          a?.content || a?.url
        );

      if (!mediaAttachments.length) {
        result.push(msg);
        continue;
      }

      const supportsToolResultMedia = capabilities?.toolResultMedia ?? true;

      const mediaParts = mediaAttachments.map((a) => attachmentToSupportedMessagePart(a, capabilities));

      if (supportsToolResultMedia) {
        // 内嵌到 tool result content 末尾
        const baseContent = typeof msg.content === "string"
          ? [{ type: "text", text: msg.content }]
          : Array.isArray(msg.content)
            ? msg.content
            : [{ type: "text", text: String(msg.content) }];
        const { attachments: _removed, ...rest } = msg;
        result.push({ ...rest, content: [...baseContent, ...mediaParts] });
      } else {
        // 不支持内嵌：收集到 pending，tool result 只发纯文本
        pendingMediaParts.push(...mediaParts);
        const { attachments: _removed, ...rest } = msg;
        result.push(rest);
      }
      continue;
    }

    result.push(msg);
  }

  // messages 末尾还有未注入的 pending 附件
  if (pendingMediaParts.length > 0) {
    result.push({
      role: "user",
      content: [
        { type: "text", text: "Attached file(s) from tool result:" },
        ...pendingMediaParts,
      ],
    });
  }

  return result;
}

export const transfromExtendParams = (extendParams: { aiRole?: string; turnId?: string }) => {
  const { aiRole, turnId } = extendParams;
  let model = "moonshotai/kimi-k2.6";
  let role = "default";

  if (!aiRole) return { model, role, turnId };

  switch (true) {
    case ["image"].includes(aiRole):
      model = "moonshotai/kimi-k2.6";
      // model = "anthropic/claude-sonnet-4.6";
      role = "image";
      break;
    case ["junior"].includes(aiRole):
      model = "moonshotai/kimi-k2.6";
      role = "junior";
      break;
    case ["architect"].includes(aiRole):
      model = "moonshotai/kimi-k2.6";
      // model = "google/gemini-3.1-pro-preview";
      role = "architect";
      break;
    case ["expert"].includes(aiRole):
      model = "moonshotai/kimi-k2.6";
      // model = "anthropic/claude-sonnet-4.6";
      role = "expert";
      break;
    default:
      role = "default";
      break;
  }

  return { model, role, turnId };
};

export async function requestAsStreamForDevelopment(params: RequestAsStreamParams) {
  const { messages, emits, aiRole, turnId } = params;
  const { cancel, write, complete, error } = emits;
  const extendParams = transfromExtendParams({ aiRole, turnId });
  const body = { messages: sanitizeMessages(preprocessMessagesForModel(messages)), ...extendParams };

  try {
    const controller = new AbortController();
    await doStreamFetch({
      url: "//ai.mybricks.world/stream-test",
      body,
      extendParams,
      controller,
      cancel,
      write,
      complete,
      error,
    });
  } catch (ex) {
    error(ex as any);
  }
}

export function requestAsStreamForProduction(extraHeadersInput?: ExtraHeadersInput): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, aiRole } = params;
    const { cancel, write, complete, error } = emits;

    await checkFetchTarget();

    const extraHeaders =
      typeof extraHeadersInput === "function"
        ? await Promise.resolve(extraHeadersInput())
        : extraHeadersInput;

    const extendParams = transfromExtendParams({ aiRole });
    const payload = { messages: sanitizeMessages(preprocessMessagesForModel(messages)), ...extendParams };
    const streamUrl = STREAM_URL_BY_TARGET[fetchTaget] ?? STREAM_URL_BY_TARGET[FetchTarget.Center];
    const body = getAiEncryptData(payload);

    try {
      const controller = new AbortController();
      await doStreamFetch({
        url: streamUrl,
        body,
        extendParams,
        controller,
        cancel,
        write,
        complete,
        error,
        extraHeaders,
      });
    } catch (ex) {
      error(ex as any);
    }
  };
}

async function doStreamFetch(opts: {
  url: string;
  body: unknown;
  extendParams: { role?: string; turnId?: string };
  controller: AbortController;
  cancel: (fn: () => void) => void;
  write: (chunk: string) => void;
  complete: (v: string) => void;
  error: (e: any) => void;
  extraHeaders?: Record<string, string>;
}) {
  const { url, body, extendParams, controller, cancel, write, complete, extraHeaders } = opts;

  const response = await fetch(toAbsoluteHttpsUrl(url), {
    signal: controller.signal,
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(extendParams.role ? { "M-Request-Role": extendParams.role } : {}),
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  cancel(() => controller.abort());

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    write(decoder.decode(value, { stream: true }));
  }

  complete("");
}

/** 从当前页面 URL 的 query 参数中读取 id 作为 fileId */
function getFileIdFromUrl(): string | undefined {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id") || undefined;
  } catch {
    return undefined;
  }
}

async function readResponseErrorMessage(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (text) {
      try {
        const data = JSON.parse(text);
        const message = data?.message ?? data?.error?.message ?? data?.error;
        if (typeof message === "string" && message.trim()) {
          return message.trim();
        }
      } catch {
        // ignore
      }
      return text;
    }
  } catch {
    // ignore
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function doSSEFetch(opts: {
  url: string;
  body: unknown;
  extendParams: { role?: string; turnId?: string };
  controller: AbortController;
  cancel: (fn: () => void) => void;
  write: (chunk: string) => void;
  complete: (v: string) => void;
  error: (e: any) => void;
  extraHeaders?: Record<string, string>;
  onUsage?: (usage: TokenUsage) => void;
  onThinking?: (chunk: string) => void;
  onToolCalls?: (toolCalls: ToolCallSpec[]) => void;
  onToolCallStream?: (delta: ToolCallStreamDelta) => void;
  onFinishReason?: (reason: string) => void;
}) {
  const { url, body, extendParams, controller, cancel, write, complete, error, extraHeaders, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = opts;

  const fileId = getFileIdFromUrl();

  const response = await fetch(toAbsoluteHttpsUrl(url), {
    signal: controller.signal,
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(extendParams.role ? { "M-Request-Role": extendParams.role } : {}),
      ...(extendParams.turnId ? { "m-request-turn": extendParams.turnId } : {}),
      ...(fileId ? { "m-request-fileId": fileId } : {}),
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  cancel(() => controller.abort());

  if (!response.ok) {
    const message = await readResponseErrorMessage(response);
    error(new Error(message));
    return;
  }

  const reader = response.body!.getReader();
  await readSSEStream({ reader, write, complete, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason });
}

export async function requestAsStreamForDevelopmentSSE(params: RequestAsStreamParams) {
  const { messages, emits, aiRole, tools, turnId } = params;
  const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;
  const extendParams = transfromExtendParams({ aiRole, turnId });
  const body: Record<string, any> = { messages: sanitizeMessages(preprocessMessagesForModel(messages)), ...extendParams };
  if (tools?.length) body.tools = tools;

  try {
    const controller = new AbortController();
    await doSSEFetch({
      url: "//ai.mybricks.world/sse-test",
      // url: "//localhost:4000/sse-test",
      body,
      extendParams,
      controller,
      cancel,
      write,
      complete,
      error,
      onUsage,
      onThinking,
      onToolCalls,
      onToolCallStream,
      onFinishReason,
    });
  } catch (ex) {
    error(ex as any);
  }
}

export function requestAsStreamForProductionSSE(extraHeadersInput?: ExtraHeadersInput): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, aiRole, tools, turnId } = params;
    const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;

    await checkFetchTarget();

    const extraHeaders =
      typeof extraHeadersInput === "function"
        ? await Promise.resolve(extraHeadersInput())
        : extraHeadersInput;

    const extendParams = transfromExtendParams({ aiRole, turnId });
    const payload: Record<string, any> = { messages: sanitizeMessages(preprocessMessagesForModel(messages)), ...extendParams };
    if (tools?.length) payload.tools = tools;
    const sseUrl = STREAM_SSE_URL_BY_TARGET[fetchTaget] ?? STREAM_SSE_URL_BY_TARGET[FetchTarget.Center];
    const body = getAiEncryptData(payload);

    try {
      const controller = new AbortController();
      await doSSEFetch({
        url: sseUrl,
        body,
        extendParams,
        controller,
        cancel,
        write,
        complete,
        error,
        extraHeaders,
        onUsage,
        onThinking,
        onToolCalls,
        onToolCallStream,
        onFinishReason,
      });
    } catch (ex) {
      error(ex as any);
    }
  };
}

export async function checkInfraAvailable(): Promise<boolean> {
  const fn = await loadRequestInfraFromCDN();
  return fn !== null;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createInfraAIOnUpload(): OnUploadFn {
  return async (file: File): Promise<string> => {
    const fn = (window as any).requestOnUploadInfra;
    if (typeof fn === "function") return fn(file);
    return readFileAsBase64(file);
  };
}

export function createOnUpload(): OnUploadFn {
  return async (file: File): Promise<string> => {
    if (!isProduction()) {
      const fn = (window as any).requestOnUploadInfra;
      if (typeof fn === "function") return fn(file);
    }
    return readFileAsBase64(file);
  };
}
