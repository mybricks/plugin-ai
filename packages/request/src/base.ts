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
  // [FetchTarget.Center]: "//ai.mybricks.world/sse",
  [FetchTarget.Center]: "//localhost:4000/sse",
};

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
  const body = { messages, ...extendParams };

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
    const payload = { messages, ...extendParams };
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
    const text = await response.text();
    error(new Error(`SSE ${response.status}: ${text || response.statusText}`));
    return;
  }

  const reader = response.body!.getReader();
  await readSSEStream({ reader, write, complete, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason });
}

export async function requestAsStreamForDevelopmentSSE(params: RequestAsStreamParams) {
  const { messages, emits, aiRole, tools, turnId } = params;
  const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;
  const extendParams = transfromExtendParams({ aiRole, turnId });
  const body: Record<string, any> = { messages, ...extendParams };
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
    const payload: Record<string, any> = { messages, ...extendParams };
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
