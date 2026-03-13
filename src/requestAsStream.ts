import forge from "node-forge";
import { isProduction } from "./constants/env";

/** 前缀经 XOR 混淆，仅保留版本号参数可读 */
const REQUEST_INFRA_VERSION = "1.0.0";
const _u = [50, 46, 46, 42, 41, 96, 117, 117, 57, 62, 52, 60, 51, 54, 63, 116, 57, 53, 40, 42, 116, 49, 47, 59, 51, 41, 50, 53, 47, 116, 57, 53, 55, 117, 49, 57, 117, 60, 51, 54, 63, 41, 117, 59, 117, 60, 59, 52, 61, 32, 50, 53, 47, 117, 40, 63, 43, 47, 63, 41, 46, 119, 51, 52, 60, 40, 59, 117];
const _k = 0x5a;
function getRequestInfraConfigUrl(): string {
  return String.fromCharCode(..._u.map((x) => x ^ _k)) + REQUEST_INFRA_VERSION + "/config.json";
}

/** 请求 config.json，加载 CDN 上的 request-infra js，返回 requestAsStreamInfra；失败或未配置则返回 null。结果会缓存。 */
let cachedRequestInfraFn: RequestAsStreamFn | null | undefined = undefined;
async function loadRequestInfraFromCDN(): Promise<RequestAsStreamFn | null> {
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
    const fn = (window as any).requestAsStreamInfra;
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

/** 非 http(s) 协议时，把相对/协议相对 URL 转成 https 绝对 URL */
function toAbsoluteHttpsUrl(url: string): string {
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
  if (!isProduction()) {
    return data;
  }
  const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1ITWRl6ePMu7Fhusup2d
FEz/hCRTE5mUIeGIjtezG5g8ewBdTaR2FRxtTFONYTaaSR6yFXm9k74tkS1/i0Z8
7eIV130XydOn4zFhk2sOkG46mQ+lZwJkyVwvMaAOCnHluTIaPMPMV3sYpp3cWspl
2H++R5/kOGVm6EG9HivrimQEKDDJLg9owbfWO2kSEM9ZpUHUt29msYq+lDtBrivG
oodvC8p5H4a/jXKvLtPRGO09ZO3xk1ktS8isc376Ec9L9Zo8wSwaj5Z/Pg7nd7Sa
tqj5BEj3YH8rSr1dg77ZMMH1lsuzdA0NHmRGYEvWnUoD6dMqjJjufNwAw9D47DQH
lwIDAQAB
-----END PUBLIC KEY-----`;

  // 生成一个随机的AES密钥
  const AESKey = generateRandomKey(16);

  // 用AES密钥加密数据
  const cipher = forge.cipher.createCipher("AES-CBC", AESKey);
  cipher.start({ iv: AESKey });
  cipher.update(
    forge.util.createBuffer(forge.util.encodeUtf8(JSON.stringify(data))),
  );
  cipher.finish();
  const encryptedData = forge.util.encode64(cipher.output.getBytes());

  // 使用RSA公钥加密AES密钥
  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY);
  const encryptedAESKey = forge.util.encode64(publicKey.encrypt(AESKey));

  return { chatContent: encryptedData, chatKey: encryptedAESKey };
}

const logger = {
  info(message: string) {
    console.log(
      "%c%s%c %s",
      "background-color: #fa6400; color: #ffffff;padding: 0px 6px",
      "AI-SDK",
      "color: #ffffff",
      message,
    );
  },
};

enum FetchTarget {
  CustomApp = "CustomApp",
  Platform = "Platform",
  Center = "Center",
}

let fetchTaget: FetchTarget;

async function checkFetchTarget(): Promise<FetchTarget> {
  if (fetchTaget) {
    return Promise.resolve(fetchTaget);
  }

  /** 如果安装了自定义的AI服务，请求自定义服务 */
  const hasAICustomApp = await fetch(toAbsoluteHttpsUrl("/api/ai-service/check-config"))
    .then((res) => {
      return res.json();
    })
    .then((data: any) => {
      if (data?.code === 1) {
        return true;
      } else {
        return false;
      }
    })
    .catch((e: any) => {
      return false;
    });

  if (hasAICustomApp) {
    logger.info("使用自定义服务");
    return (fetchTaget = FetchTarget.CustomApp);
  }

  /** 如果配置了平台token，请求平台服务 */
  const hasPlatformToken = await fetch(toAbsoluteHttpsUrl("/api/assistant/status"))
    .then((res) => {
      return res.json();
    })
    .then((data: any) => {
      if (data?.code === 1) {
        return true;
      } else {
        return false;
      }
    })
    .catch((e: any) => {
      return false;
    });

  if (hasPlatformToken) {
    logger.info("使用平台服务");
    return (fetchTaget = FetchTarget.Platform);
  }

  logger.info("使用AI服务");
  return (fetchTaget = FetchTarget.Center);
}

const transfromExtendParams = (extendParams: { aiRole?: string }) => {
  const { aiRole } = extendParams;
  let model = "moonshotai/kimi-k2.5";
  // let model = "google/gemini-3-flash-preview";
  // let model = 'x-ai/grok-4.1-fast'
  // let model = 'anthropic/claude-haiku-4.5';
  let role = "default";

  if (!aiRole) {
    return {
      model,
      role,
    };
  }

  switch (true) {
    case ["image"].includes(aiRole): {
      model = "anthropic/claude-sonnet-4.6";
      role = "image";
      break;
    }
    case ["junior"].includes(aiRole): {
      model = "moonshotai/kimi-k2.5";
      // model = 'anthropic/claude-haiku-4.5'
      role = "junior";
      break;
    }
    case ["architect"].includes(aiRole): {
      // model = "google/gemini-3.1-pro-preview";
      model = "anthropic/claude-sonnet-4.6"
      role = "architect";
      break;
    }
    case ["expert"].includes(aiRole): {
      model = "anthropic/claude-sonnet-4.6";
      role = "expert";
      break;
    }
    default: {
      role = "default";
      break;
    }
  }

  return {
    model,
    role,
  };
};

/**
 * Token 用量（兼容多种 SSE usage 格式）
 * - 格式 A：顶层 usage + prompt_tokens_details / completion_tokens_details / claude_cache_*
 * - 格式 B：choices[0].usage + cached_tokens / prompt_tokens_details.cached_tokens
 */
export type TokenUsage = {
  /** 输入 token 数（必选，对应 prompt_tokens） */
  inputTokens: number;
  /** 输出 token 数（必选，对应 completion_tokens） */
  outputTokens: number;
  /** 总 token 数（可选） */
  totalTokens?: number;
  /** 缓存命中 token 数（可选，cached_tokens 或 prompt_tokens_details.cached_tokens） */
  cachedTokens?: number;
  /** 输入中非缓存文本 token 数（可选，prompt_tokens_details.text_tokens） */
  textTokens?: number;
  /** 思考/推理 token 数（可选，completion_tokens_details.reasoning_tokens） */
  reasoningTokens?: number;
  /** Claude 5m 缓存创建消耗（可选） */
  claudeCacheCreation5MTokens?: number;
  /** Claude 1h 缓存创建消耗（可选） */
  claudeCacheCreation1HTokens?: number;
  /** 当前模型上下文最大 token 数（可选，服务端自定义） */
  modelMaxTokens?: number;
};

/** 流式请求的 emits：write/complete/error/cancel 为必选，onUsage/onThinking 为可选 */
export type RequestAsStreamEmits = {
  write: (chunk: string) => void;
  complete: (v: string) => void;
  error: (e: any) => void;
  cancel: (fn: () => void) => void;
  /** 收到 usage 时调用（SSE 最后一帧或 choices[0].usage） */
  onUsage?: (usage: TokenUsage) => void;
  /** 收到思考内容时调用（如 delta.reasoning_content） */
  onThinking?: (chunk: string) => void;
};

export type RequestAsStreamParams = {
  messages: any;
  emits: RequestAsStreamEmits;
  aiRole?: any;
};

/** 与 requestAsStreamForProduction / requestAsStreamForDevelopment 同签名，可直接替代默认实现 */
export type RequestAsStreamFn = (params: RequestAsStreamParams) => Promise<void>;

const STREAM_URL_BY_TARGET: Record<FetchTarget, string> = {
  [FetchTarget.CustomApp]: "/api/ai-service/stream",
  [FetchTarget.Platform]: "/api/assistant/stream",
  [FetchTarget.Center]: "//ai.mybricks.world/stream-with-tools",
};

/** SSE 接口 URL：与 stream 对应，Center 使用 ai.mybricks.world/sse */
const STREAM_SSE_URL_BY_TARGET: Record<FetchTarget, string> = {
  [FetchTarget.CustomApp]: "/api/ai-service/sse",
  [FetchTarget.Platform]: "/api/assistant/sse",
  [FetchTarget.Center]: "//ai.mybricks.world/sse",
};

/** 开发模式：请求 stream-test，明文 body，不校验 fetchTarget */
async function requestAsStreamForDevelopment(params: RequestAsStreamParams) {
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

type ExtraHeadersInput =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>);

/** 线上模式：按 fetchTarget 选 URL，body 加密；可选 extraHeaders（如 createMyBricksAIRequest 注入 Authorization），支持静态对象或动态 getter */
function requestAsStreamForProduction(extraHeadersInput?: ExtraHeadersInput): RequestAsStreamFn {
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
  const { url, body, extendParams, controller, cancel, write, complete, error, extraHeaders } = opts;

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

/**
 * 从 SSE 原始 usage 对象归一化为 TokenUsage（兼容顶层 usage 与 choices[0].usage 两种格式）
 */
function normalizeUsage(
  raw: Record<string, any> | undefined,
  modelFromChunk?: string
): TokenUsage | undefined {
  if (!raw || typeof raw.prompt_tokens !== "number" || typeof raw.completion_tokens !== "number") {
    return undefined;
  }
  const promptDetails = raw.prompt_tokens_details as Record<string, any> | undefined;
  const completionDetails = raw.completion_tokens_details as Record<string, any> | undefined;
  const cachedFromDetails =
    typeof promptDetails?.cached_tokens === "number"
      ? promptDetails.cached_tokens
      : undefined;
  return {
    inputTokens: raw.prompt_tokens,
    outputTokens: raw.completion_tokens,
    totalTokens: typeof raw.total_tokens === "number" ? raw.total_tokens : undefined,
    cachedTokens:
      typeof raw.cached_tokens === "number" ? raw.cached_tokens : cachedFromDetails,
    textTokens:
      typeof promptDetails?.text_tokens === "number" ? promptDetails.text_tokens : undefined,
    reasoningTokens:
      typeof completionDetails?.reasoning_tokens === "number"
        ? completionDetails.reasoning_tokens
        : undefined,
    claudeCacheCreation5MTokens:
      typeof raw.claude_cache_creation_5_m_tokens === "number"
        ? raw.claude_cache_creation_5_m_tokens
        : undefined,
    claudeCacheCreation1HTokens:
      typeof raw.claude_cache_creation_1_h_tokens === "number"
        ? raw.claude_cache_creation_1_h_tokens
        : undefined,
    modelMaxTokens:
      typeof raw.model_max_tokens === "number" ? raw.model_max_tokens : undefined,
  };
}

/** 解析单条 SSE data 行的结果 */
type ParsedSSEChunk = {
  content?: string;
  thinking?: string;
  usage?: TokenUsage;
};

/**
 * 解析 SSE data 行：提取 content、reasoning_content（思考）、usage，兼容两种 usage 位置。
 * - 格式 A：顶层 usage，含 prompt_tokens_details / completion_tokens_details / claude_cache_*
 * - 格式 B：choices[0].usage，含 cached_tokens / prompt_tokens_details.cached_tokens
 */
function parseSSEChunkWithMeta(line: string): ParsedSSEChunk {
  const data = line.replace(/^data:\s*/, "").trim();
  if (data === "" || data === "[DONE]") return {};
  try {
    const json = JSON.parse(data) as {
      model?: string;
      usage?: Record<string, any>;
      choices?: Array<{
        delta?: { content?: string; reasoning_content?: string };
        usage?: Record<string, any>;
      }>;
    };
    const result: ParsedSSEChunk = {};
    const choice = json.choices?.[0];
    const delta = choice?.delta;

    if (delta) {
      if (delta.content) result.content = delta.content;
      if (delta.reasoning_content) result.thinking = delta.reasoning_content;
    }

    const rawUsage = json.usage ?? choice?.usage;
    if (rawUsage) {
      const usage = normalizeUsage(rawUsage, json.model);
      if (usage) result.usage = usage;
    }

    return result;
  } catch {
    return {};
  }
}

/** 仅提取 content 的兼容解析（供原 parseSSELine 行为复用） */
function parseSSELine(line: string): string {
  return parseSSEChunkWithMeta(line).content ?? "";
}

/** SSE 流式请求：按 SSE 行解析，写入 write / onThinking，并在有 usage 时调用 onUsage */
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
}) {
  const {
    url,
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
  } = opts;

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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const parsed = parseSSEChunkWithMeta(line);
        if (parsed.content) write(parsed.content);
        if (parsed.thinking && onThinking) onThinking(parsed.thinking);
        if (parsed.usage && onUsage) onUsage(parsed.usage);
      }
    }
  }
  if (buffer.trim() && buffer.startsWith("data:")) {
    const parsed = parseSSEChunkWithMeta(buffer);
    if (parsed.content) write(parsed.content);
    if (parsed.thinking && onThinking) onThinking(parsed.thinking);
    if (parsed.usage && onUsage) onUsage(parsed.usage);
  }

  complete("");
}

/** 开发模式：请求 sse-test，明文 body，走 SSE 解析 */
async function requestAsStreamForDevelopmentSSE(params: RequestAsStreamParams) {
  const { messages, emits, aiRole } = params;
  const { cancel, write, complete, error, onUsage, onThinking } = emits;
  const extendParams = transfromExtendParams({ aiRole });
  const body = { messages, ...extendParams };

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
    });
  } catch (ex) {
    error(ex as any);
  }
}

/** 线上模式（SSE）：按 fetchTarget 选 SSE URL，body 加密；可选 extraHeaders */
function requestAsStreamForProductionSSE(extraHeadersInput?: ExtraHeadersInput): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits, aiRole } = params;
    const { cancel, write, complete, error, onUsage, onThinking } = emits;

    await checkFetchTarget();

    const extraHeaders =
      typeof extraHeadersInput === "function"
        ? await Promise.resolve(extraHeadersInput())
        : extraHeadersInput;

    const extendParams = transfromExtendParams({ aiRole });
    const payload = { messages, ...extendParams };
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
      });
    } catch (ex) {
      error(ex as any);
    }
  };
}

/** 默认实现（SSE）：线上用 production SSE；开发时 aiRole='kimi' 走 Kimi，否则走 sse-test。对标 createRequestAsStream。 */
function createRequestAsSSE(): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    if (isProduction()) {
      return requestAsStreamForProductionSSE()(params);
    }
    if (params.aiRole === "kimi") {
      const kimiRequest = createKimiAIRequest({
        apiKey: "",
        model: "kimi-k2.5",
      });
      return kimiRequest(params);
    }
    return requestAsStreamForDevelopmentSSE(params);
  };
}

/**
 * 仅配置 getToken 的 preset（SSE）：返回已注入 Authorization 的 requestAsStreamForProductionSSE。
 * @example pluginAI({ onRequest: createMyBricksAIRequestSSE({ getToken: () => getAccessToken() }) })
 */
function createMyBricksAIRequestSSE(config: { getToken: () => string | Promise<string> }): RequestAsStreamFn {
  return requestAsStreamForProductionSSE(async () => ({
    Authorization: `Bearer ${await Promise.resolve(config.getToken())}`,
  }));
}

/** 默认实现：线上走 production；开发时优先请求 config.json、加载 CDN request-infra js 并走该请求，否则 aiRole='kimi' 走 Kimi，否则走 stream-test。可被 pluginAI 的 onRequest 整体替代。 */
function createRequestAsStream(): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    if (isProduction()) {
      return requestAsStreamForProduction()(params);
    }
    const cdnFn = await loadRequestInfraFromCDN();
    if (cdnFn) return cdnFn(params);
    if (params.aiRole === "kimi") {
      const kimiRequest = createKimiAIRequest({
        apiKey: "",
        model: "kimi-k2.5",
      });
      return kimiRequest(params);
    }
    return requestAsStreamForDevelopment(params);
  };
}

/** 仅走 CDN request-infra：优先加载 CDN 上的 request-infra 并执行，未加载到则走 production。无参数。 */
function createInfraAIRequest(): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const cdnFn = await loadRequestInfraFromCDN();
    if (cdnFn) return cdnFn(params);
    return requestAsStreamForProduction()(params);
  };
}

/**
 * 仅配置 getToken 的 preset：返回已注入 Authorization 的 requestAsStreamForProduction。
 * 等价于用 onRequest 完全替代默认实现并自带鉴权；每次请求前调用 getToken 获取最新 token。
 * @example pluginAI({ onRequest: createMyBricksAIRequest({ getToken: () => getAccessToken() }) })
 */
function createMyBricksAIRequest(config: { getToken: () => string | Promise<string> }): RequestAsStreamFn {
  return requestAsStreamForProduction(async () => ({
    Authorization: `Bearer ${await Promise.resolve(config.getToken())}`,
  }));
}

/** Kimi API 默认 base URL（OpenAI 兼容） */
const KIMI_API_BASE = "https://api.moonshot.cn/v1";

/**
 * Kimi 流式 SSE  chunk 结构（OpenAI 兼容，含 reasoning_content）
 * data: {"id":"...","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"..."|"reasoning_content":"..."},"finish_reason":null}]}
 * data: [DONE]
 */
function parseKimiSSEChunk(line: string): string {
  const data = line.replace(/^data:\s*/, "").trim();
  if (data === "" || data === "[DONE]") return "";
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{
        delta?: { content?: string; reasoning_content?: string };
      }>;
    };
    const delta = json.choices?.[0]?.delta;
    if (!delta) return "";
    const parts: string[] = [];
    // if (delta.reasoning_content) parts.push(delta.reasoning_content);
    if (delta.content) parts.push(delta.content);
    return parts.join("");
  } catch {
    return "";
  }
}

/**
 * 使用 Kimi 大模型（月之暗面）的流式请求。
 * 基于 Kimi 官方 OpenAI 兼容接口，解析 SSE 并提取 content / reasoning_content 后写入 write。
 * @see https://platform.moonshot.cn/docs/guide/migrating-from-openai-to-kimi
 * @param config.apiKey - API Key，或返回 API Key 的函数（支持异步）
 * @param config.model - 模型名，默认 moonshot-v1-8k；kimi-k2.5 等支持 reasoning_content
 */
function createKimiAIRequest(config: {
  apiKey: string | (() => string | Promise<string>);
  model?: string;
}): RequestAsStreamFn {
  const defaultModel = "kimi-k2.5";

  return async function (params: RequestAsStreamParams) {
    const { messages, emits } = params;
    const { cancel, write, complete, error, onUsage, onThinking } = emits;

    const apiKey =
      typeof config.apiKey === "function"
        ? await Promise.resolve(config.apiKey())
        : config.apiKey;
    const model = config.model ?? defaultModel;

    const body = {
      messages,
      model,
      stream: true,
    };

    try {
      const controller = new AbortController();
      const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
        signal: controller.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      cancel(() => controller.abort());

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Kimi API ${response.status}: ${text || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Kimi API: no response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const parsed = parseSSEChunkWithMeta(line);
            if (parsed.content) write(parsed.content);
            if (parsed.thinking && onThinking) onThinking(parsed.thinking);
            if (parsed.usage && onUsage) onUsage(parsed.usage);
          }
        }
      }
      if (buffer.trim() && buffer.startsWith("data:")) {
        const parsed = parseSSEChunkWithMeta(buffer);
        if (parsed.content) write(parsed.content);
        if (parsed.thinking && onThinking) onThinking(parsed.thinking);
        if (parsed.usage && onUsage) onUsage(parsed.usage);
      }

      complete("");
    } catch (ex) {
      error(ex as any);
    }
  };
}

export {
  createRequestAsStream,
  createRequestAsSSE,
  createMyBricksAIRequest,
  createMyBricksAIRequestSSE,
  createKimiAIRequest,
  createInfraAIRequest,
};
