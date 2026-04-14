import forge from "node-forge";
import { isProduction } from "./env";
import { createCustomRequest as createCustomOpenAIRequest } from "./custom";
import type {
  ExtraHeadersInput,
  OnUploadFn,
  RequestAsStreamFn,
  RequestAsStreamParams,
  TokenUsage,
  ToolCallSpec,
  ToolCallStreamDelta,
} from "./types";

const REQUEST_INFRA_VERSION = "1.1.0";
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
};

export const transfromExtendParams = (extendParams: { aiRole?: string }) => {
  const { aiRole } = extendParams;
  let model = "moonshotai/kimi-k2.5";
  let role = "default";

  if (!aiRole) return { model, role };

  switch (true) {
    case ["image"].includes(aiRole):
      model = "anthropic/claude-sonnet-4.6";
      role = "image";
      break;
    case ["junior"].includes(aiRole):
      model = "moonshotai/kimi-k2.5";
      role = "junior";
      break;
    case ["architect"].includes(aiRole):
      model = "google/gemini-3.1-pro-preview";
      role = "architect";
      break;
    case ["expert"].includes(aiRole):
      model = "anthropic/claude-sonnet-4.6";
      role = "expert";
      break;
    default:
      role = "default";
      break;
  }

  return { model, role };
};

export async function requestAsStreamForDevelopment(params: RequestAsStreamParams) {
  const { messages, emits, aiRole } = params;
  const { cancel, write, complete, error } = emits;
  const extendParams = transfromExtendParams({ aiRole });
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
  extendParams: { role?: string };
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

type ParsedSSEChunk = {
  content?: string;
  thinking?: string;
  usage?: TokenUsage;
  rawToolCallDeltas?: Array<{
    index: number;
    id?: string;
    name?: string;
    argumentsChunk?: string;
  }>;
  finishReason?: string | null;
};

function normalizeUsage(raw: Record<string, any> | undefined): TokenUsage | undefined {
  if (!raw || typeof raw.prompt_tokens !== "number" || typeof raw.completion_tokens !== "number") return undefined;
  const promptDetails = raw.prompt_tokens_details as Record<string, any> | undefined;
  const completionDetails = raw.completion_tokens_details as Record<string, any> | undefined;
  const cachedFromDetails = typeof promptDetails?.cached_tokens === "number" ? promptDetails.cached_tokens : undefined;
  return {
    inputTokens: raw.prompt_tokens,
    outputTokens: raw.completion_tokens,
    totalTokens: typeof raw.total_tokens === "number" ? raw.total_tokens : undefined,
    cachedTokens: typeof raw.cached_tokens === "number" ? raw.cached_tokens : cachedFromDetails,
    textTokens: typeof promptDetails?.text_tokens === "number" ? promptDetails.text_tokens : undefined,
    reasoningTokens: typeof completionDetails?.reasoning_tokens === "number" ? completionDetails.reasoning_tokens : undefined,
    claudeCacheCreation5MTokens: typeof raw.claude_cache_creation_5_m_tokens === "number" ? raw.claude_cache_creation_5_m_tokens : undefined,
    claudeCacheCreation1HTokens: typeof raw.claude_cache_creation_1_h_tokens === "number" ? raw.claude_cache_creation_1_h_tokens : undefined,
    modelMaxTokens: typeof raw.model_max_tokens === "number" ? raw.model_max_tokens : undefined,
  };
}

function parseSSEChunkWithMeta(line: string): ParsedSSEChunk {
  const data = line.replace(/^data:\s*/, "").trim();
  if (data === "" || data === "[DONE]") return {};
  try {
    const json = JSON.parse(data) as {
      usage?: Record<string, any>;
      choices?: Array<{
        delta?: {
          content?: string;
          reasoning_content?: string;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string;
        usage?: Record<string, any>;
      }>;
    };
    const result: ParsedSSEChunk = {};
    const choice = json.choices?.[0];
    const delta = choice?.delta;

    if (delta) {
      if (delta.content) result.content = delta.content;
      if (delta.reasoning_content) result.thinking = delta.reasoning_content;
      if (delta.tool_calls?.length) {
        result.rawToolCallDeltas = delta.tool_calls.map((tc) => ({
          index: tc.index ?? 0,
          id: tc.id,
          name: tc.function?.name,
          argumentsChunk: tc.function?.arguments,
        }));
      }
    }

    if (choice && "finish_reason" in choice) {
      result.finishReason = choice.finish_reason ?? null;
    }

    const rawUsage = json.usage ?? choice?.usage;
    if (rawUsage) {
      const usage = normalizeUsage(rawUsage);
      if (usage) result.usage = usage;
    }

    return result;
  } catch {
    return {};
  }
}

async function doSSEFetch(opts: {
  url: string;
  body: unknown;
  extendParams: { role?: string };
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

  if (!response.ok) {
    const text = await response.text();
    error(new Error(`SSE ${response.status}: ${text || response.statusText}`));
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  type ToolCallAccum = { id: string; name: string; argsRaw: string };
  const toolCallsByIndex: Map<number, ToolCallAccum> = new Map();
  let finishReason: string | null = null;

  const processParsedChunk = (parsed: ParsedSSEChunk) => {
    if (parsed.content) write(parsed.content);
    if (parsed.thinking && onThinking) onThinking(parsed.thinking);
    if (parsed.usage && onUsage) onUsage(parsed.usage);
    if (parsed.finishReason !== undefined) finishReason = parsed.finishReason;
    if (parsed.rawToolCallDeltas) {
      for (const delta of parsed.rawToolCallDeltas) {
        const existing = toolCallsByIndex.get(delta.index);
        if (existing) {
          existing.argsRaw += delta.argumentsChunk ?? "";
          if (onToolCallStream) onToolCallStream({ index: delta.index, argsChunk: delta.argumentsChunk ?? "" });
        } else {
          toolCallsByIndex.set(delta.index, {
            id: delta.id ?? "",
            name: delta.name ?? "",
            argsRaw: delta.argumentsChunk ?? "",
          });
          if (onToolCallStream) {
            onToolCallStream({
              index: delta.index,
              id: delta.id ?? "",
              name: delta.name ?? "",
              argsChunk: delta.argumentsChunk ?? "",
            });
          }
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) processParsedChunk(parseSSEChunkWithMeta(line));
    }
  }
  if (buffer.trim() && buffer.startsWith("data:")) processParsedChunk(parseSSEChunkWithMeta(buffer));

  const hasToolCalls = toolCallsByIndex.size > 0;
  const resolvedFinishReason = finishReason ?? (hasToolCalls ? "tool_calls" : "stop");
  if (onFinishReason) onFinishReason(resolvedFinishReason);

  const shouldTriggerToolCalls = onToolCalls && hasToolCalls && (finishReason === "tool_calls" || finishReason === null || finishReason === undefined);
  if (shouldTriggerToolCalls) {
    const toolCalls: ToolCallSpec[] = [];
    const indices = Array.from(toolCallsByIndex.keys()).sort((a, b) => a - b);
    for (const idx of indices) {
      const tc = toolCallsByIndex.get(idx)!;
      if (!tc.id || !tc.name) continue;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.argsRaw);
      } catch {
        args = {};
      }
      toolCalls.push({ id: tc.id, name: tc.name, args });
    }
    if (toolCalls.length > 0) onToolCalls(toolCalls);
  }

  complete("");
}

export async function requestAsStreamForDevelopmentSSE(params: RequestAsStreamParams) {
  const { messages, emits, aiRole, tools } = params;
  const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;
  const extendParams = transfromExtendParams({ aiRole });
  const body: Record<string, any> = { messages, ...extendParams };
  if (tools?.length) body.tools = tools;

  try {
    const controller = new AbortController();
    await doSSEFetch({
      url: "//ai.mybricks.world/sse-test",
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

export function createKimiCompatibleRequest(config: {
  apiKey: string | (() => string | Promise<string>);
  model?: string;
}): RequestAsStreamFn {
  return createCustomOpenAIRequest({
    provider: () => "openai",
    apiUrl: () => "https://api.moonshot.cn/v1/chat/completions",
    apiKey: () => Promise.resolve(typeof config.apiKey === "function" ? config.apiKey() : config.apiKey),
    model: () => config.model ?? "kimi-k2.5",
  });
}

export function requestAsStreamForProductionSSE(extraHeadersInput?: ExtraHeadersInput): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, aiRole, tools } = params;
    const { cancel, write, complete, error, onUsage, onThinking, onToolCalls, onToolCallStream, onFinishReason } = emits;

    await checkFetchTarget();

    const extraHeaders =
      typeof extraHeadersInput === "function"
        ? await Promise.resolve(extraHeadersInput())
        : extraHeadersInput;

    const extendParams = transfromExtendParams({ aiRole });
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
