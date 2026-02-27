import forge from "node-forge";
import { isProduction } from "./constants/env";

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
      role = "junior";
      break;
    }
    case ["architect"].includes(aiRole): {
      model = "google/gemini-3.1-pro-preview";
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

export type RequestAsStreamParams = {
  messages: any;
  emits: any;
  aiRole?: any;
};

/** 与 requestAsStreamForProduction / requestAsStreamForDevelopment 同签名，可直接替代默认实现 */
export type RequestAsStreamFn = (params: RequestAsStreamParams) => Promise<void>;

const STREAM_URL_BY_TARGET: Record<FetchTarget, string> = {
  [FetchTarget.CustomApp]: "/api/ai-service/stream",
  [FetchTarget.Platform]: "/api/assistant/stream",
  [FetchTarget.Center]: "//ai.mybricks.world/stream-with-tools",
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


/** 默认实现：线上用 production；开发时 aiRole='kimi' 走 Kimi，否则走原 stream-test。可被 pluginAI 的 onRequest 整体替代。 */
function createRequestAsStream(): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    if (isProduction()) {
      return requestAsStreamForProduction()(params);
    }
    if (params.aiRole === "kimi") {
      const kimiRequest = createKimiAIRequest({
        apiKey: "sk-hqldpxgWjw9fdncNM9zvN1yD7ANGer8TffQ6FgVq4G1JRAmA",
        model: "kimi-k2.5",
      });
      return kimiRequest(params);
    }
    return requestAsStreamForDevelopment(params);
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
    const { cancel, write, complete, error } = emits;

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
            const text = parseKimiSSEChunk(line);
            if (text) write(text);
          }
        }
      }
      if (buffer.trim() && buffer.startsWith("data:")) {
        const text = parseKimiSSEChunk(buffer);
        if (text) write(text);
      }

      complete("");
    } catch (ex) {
      error(ex as any);
    }
  };
}

export { createRequestAsStream, createMyBricksAIRequest, createKimiAIRequest };
