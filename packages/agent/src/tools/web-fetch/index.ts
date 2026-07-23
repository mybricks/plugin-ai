import type { Tool, ToolResult } from "../../types";
import { ToolValidationError } from "../../types";

// ─── 工具名称 ─────────────────────────────────────────────────────────────────

export const WEB_FETCH_TOOL_NAME = "web_fetch";

// ─── 配置项 ───────────────────────────────────────────────────────────────────

export interface WebFetchConfig {
  /**
   * 最大响应体大小（字节）。默认 5MB。
   */
  maxResponseSize?: number;
  /**
   * 默认请求超时（毫秒）。默认 30000（30 秒）。
   */
  defaultTimeoutMs?: number;
  /**
   * 超时上限（毫秒）。LLM 传入的 timeout 不得超过此值。默认 120000（120 秒）。
   */
  maxTimeoutMs?: number;
  /**
   * 自定义请求 headers。这些 headers 会与工具内置的 Accept / Accept-Language
   * 合并，相同 key 时以此处的值覆盖内置值。
   * 例如传入 { "Authorization": "Bearer xxx" } 即可为所有请求附加鉴权 header。
   */
  headers?: Record<string, string>;
}

// ─── 参数类型 ─────────────────────────────────────────────────────────────────

interface WebFetchParams {
  url: string;
  format?: "text" | "markdown" | "html";
  timeout?: number;
}

// ─── GC 安全的 AbortSignal 工具函数 ──────────────────────────────────────────

/**
 * 创建一个会在 ms 毫秒后自动 abort 的信号。
 * 使用 bind() 而非箭头函数，避免闭包捕获作用域中的大对象，影响 GC。
 */
function abortAfter(ms: number): { signal: AbortSignal; clearTimer: () => void } {
  const controller = new AbortController();
  const id = setTimeout(controller.abort.bind(controller), ms);
  return {
    signal: controller.signal,
    clearTimer: () => clearTimeout(id),
  };
}

/**
 * 合并超时信号和外部 abort 信号（如用户取消）。
 * 任意一个触发时，合并信号即 abort。
 */
function combineSignals(ms: number, externalSignal?: AbortSignal): { signal: AbortSignal; clearTimer: () => void } {
  const { signal: timeoutSignal, clearTimer } = abortAfter(ms);
  if (!externalSignal) {
    return { signal: timeoutSignal, clearTimer };
  }
  const combined = AbortSignal.any([timeoutSignal, externalSignal]);
  return { signal: combined, clearTimer };
}

// ─── Accept Header 构建 ───────────────────────────────────────────────────────

function buildAcceptHeader(format: WebFetchParams["format"]): string {
  switch (format) {
    case "markdown":
      return "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1";
    case "text":
      return "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1";
    case "html":
      return "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, */*;q=0.1";
    default:
      return "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
  }
}

// ─── HTML 内容转换 ────────────────────────────────────────────────────────────

/**
 * 递归从 DOM 节点提取 Markdown 文本。
 */
function extractMarkdownFromNode(node: Element): string {
  const parts: string[] = [];

  function walk(el: Element | ChildNode) {
    if (el.nodeType === Node.TEXT_NODE) {
      const text = el.textContent?.trim();
      if (text) parts.push(text);
      return;
    }
    if (el.nodeType !== Node.ELEMENT_NODE) return;

    const elem = el as Element;
    const tag = elem.tagName?.toLowerCase();

    if (tag === "h1") { parts.push("\n\n# " + elem.textContent?.trim()); return; }
    if (tag === "h2") { parts.push("\n\n## " + elem.textContent?.trim()); return; }
    if (tag === "h3") { parts.push("\n\n### " + elem.textContent?.trim()); return; }
    if (tag === "h4") { parts.push("\n\n#### " + elem.textContent?.trim()); return; }
    if (tag === "h5") { parts.push("\n\n##### " + elem.textContent?.trim()); return; }
    if (tag === "h6") { parts.push("\n\n###### " + elem.textContent?.trim()); return; }

    if (["p", "div", "section", "article", "header", "footer", "main", "aside", "nav"].includes(tag)) {
      parts.push("\n\n");
      elem.childNodes.forEach(walk);
      parts.push("\n\n");
      return;
    }

    if (tag === "a") {
      const href = elem.getAttribute("href");
      const text = elem.textContent?.trim();
      if (href && text) { parts.push(`[${text}](${href})`); }
      else if (text) { parts.push(text); }
      return;
    }

    if (tag === "li") {
      parts.push("\n- ");
      elem.childNodes.forEach(walk);
      return;
    }

    if (tag === "pre" || tag === "code") {
      parts.push("`" + elem.textContent + "`");
      return;
    }

    if (tag === "hr") { parts.push("\n\n---\n\n"); return; }
    if (tag === "br") { parts.push("\n"); return; }

    elem.childNodes.forEach(walk);
  }

  node.childNodes.forEach(walk);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 正则降级：剥离 HTML 标签，返回纯文本。
 * 用于 DOMParser 不可用或抛异常时的兜底。
 */
function stripHTMLByRegex(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 将 HTML 字符串转换为 Markdown 风格文本。
 * 优先使用 DOMParser；失败时降级为纯文本（正则剥离标签）。
 */
function convertHTMLToMarkdown(html: string): string {
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      ["script", "style", "noscript", "meta", "link", "iframe", "object", "embed"].forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      });
      const result = extractMarkdownFromNode(doc.body ?? doc.documentElement);
      // 如果提取结果为空（如解析完全失败导致 body 为空），降级到纯文本
      if (result.trim()) return result;
    } catch {
      // 捕获 DOMParser 异常，降级
    }
  }
  // 降级：正则剥离（保留可读纯文本，前端也能用）
  return stripHTMLByRegex(html);
}

/**
 * 提取 HTML 中的纯文本内容（剥离所有标签）。
 */
function extractTextFromHTML(html: string): string {
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      ["script", "style", "noscript", "meta", "link"].forEach((sel) => {
        doc.querySelectorAll(sel).forEach((el) => el.remove());
      });
      const text = (doc.body ?? doc.documentElement).textContent?.replace(/\s{2,}/g, " ").trim();
      if (text) return text;
    } catch {
      // 降级
    }
  }
  return stripHTMLByRegex(html);
}

// ─── MIME 判断 ────────────────────────────────────────────────────────────────

function isImageMime(mime: string): boolean {
  return (
    mime.startsWith("image/") &&
    mime !== "image/svg+xml" &&
    mime !== "image/vnd.fastbidsheet"
  );
}

function isHTMLMime(mime: string): boolean {
  return mime.includes("text/html") || mime.includes("application/xhtml+xml");
}

// ─── 响应内容转换 ─────────────────────────────────────────────────────────────

async function convertResponse(
  arrayBuffer: ArrayBuffer,
  contentType: string,
  format: WebFetchParams["format"],
): Promise<{ output: string; isImage: boolean; mime: string; base64?: string }> {
  const mime = contentType.split(";")[0].trim().toLowerCase() || "application/octet-stream";
  const decoder = new TextDecoder();

  // 图片：转 base64
  if (isImageMime(mime)) {
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);
    return { output: "Image fetched successfully", isImage: true, mime, base64 };
  }

  const rawText = decoder.decode(arrayBuffer);

  // HTML：根据 format 转换
  if (isHTMLMime(mime)) {
    const actualFormat = format ?? "markdown";
    if (actualFormat === "html") {
      return { output: rawText, isImage: false, mime };
    }
    if (actualFormat === "text") {
      return { output: extractTextFromHTML(rawText), isImage: false, mime };
    }
    // markdown（默认）
    return { output: convertHTMLToMarkdown(rawText), isImage: false, mime };
  }

  // 其余文本内容直接返回
  return { output: rawText, isImage: false, mime };
}

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

/**
 * 创建 web_fetch 工具。
 *
 * 该工具允许 LLM 通过 HTTP GET 请求获取网页内容。
 * 特性：
 *  - 支持 text / markdown / html 三种返回格式
 *  - 自动处理超时（默认由 config.defaultTimeoutMs 控制，上限 config.maxTimeoutMs）
 *  - 响应体最大 config.maxResponseSize 字节，双重检查（Content-Length + 实际 body）
 *  - HTML 内容自动转 Markdown（DOMParser 失败时降级为纯文本），图片转 base64 Data URL
 *  - 支持通过 config.headers 附加自定义请求 headers（如鉴权信息）
 *
 * 注意：工具不自动注册到 CodeAgent，需在创建 Agent 时通过 tools 数组传入。
 *
 * @param config 可选配置
 *
 * @example
 * ```ts
 * import { Tools } from "@mybricks/plugin-ai/agent";
 *
 * new CodeAgent({
 *   tools: [Tools.createWebFetch({ headers: { Authorization: "Bearer xxx" } })],
 *   // ...
 * });
 * ```
 */
export function createWebFetchTool(config?: WebFetchConfig): Tool {
  const MAX_RESPONSE_SIZE = config?.maxResponseSize ?? 5 * 1024 * 1024;
  const DEFAULT_TIMEOUT_MS = config?.defaultTimeoutMs ?? 30 * 1000;
  const MAX_TIMEOUT_MS = config?.maxTimeoutMs ?? 120 * 1000;
  const customHeaders = config?.headers ?? {};

  return {
    name: WEB_FETCH_TOOL_NAME,
    title: "Web Fetch",
    description: `通过 HTTP GET 请求获取指定 URL 的内容，返回可供分析的文本。

支持的内容类型：
- 网页（HTML）：自动转换为 Markdown、纯文本或原始 HTML
- 纯文本 / Markdown 文件：直接返回
- 图片：返回 base64 编码的 Data URL

用法：
- 传入完整 URL（必须以 http:// 或 https:// 开头）
- 可选指定 format（text / markdown / html），默认 markdown
- 可选指定 timeout（秒，最大 ${MAX_TIMEOUT_MS / 1000}），默认 ${DEFAULT_TIMEOUT_MS / 1000} 秒
- 响应内容超过 ${Math.round(MAX_RESPONSE_SIZE / 1024 / 1024)}MB 时会报错
- 如需获取多个页面，可并行调用此工具`,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "要请求的完整 URL，必须以 http:// 或 https:// 开头",
        },
        format: {
          type: "string",
          enum: ["text", "markdown", "html"],
          description: "返回格式。text=纯文本，markdown=Markdown（默认），html=原始 HTML",
        },
        timeout: {
          type: "number",
          description: `请求超时时间（秒），默认 ${DEFAULT_TIMEOUT_MS / 1000}，最大 ${MAX_TIMEOUT_MS / 1000}`,
        },
      },
      required: ["url"],
    },

    validate(params: WebFetchParams): void {
      if (!params.url || typeof params.url !== "string" || !params.url.trim()) {
        throw new ToolValidationError("url is required and must be a non-empty string");
      }
      let parsed: URL;
      try {
        parsed = new URL(params.url);
      } catch {
        throw new ToolValidationError(`Invalid URL: ${params.url}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new ToolValidationError(`URL must use http or https protocol, got: ${parsed.protocol}`);
      }
      if (params.timeout !== undefined) {
        if (typeof params.timeout !== "number" || params.timeout <= 0) {
          throw new ToolValidationError(`timeout must be a positive number, got: ${params.timeout}`);
        }
      }
    },

    async execute(params: WebFetchParams, ctx?: { abort?: AbortSignal }): Promise<ToolResult> {
      const format = params.format ?? "markdown";
      const timeoutMs = Math.min(
        params.timeout != null ? params.timeout * 1000 : DEFAULT_TIMEOUT_MS,
        MAX_TIMEOUT_MS,
      );

      const { signal, clearTimer } = combineSignals(timeoutMs, ctx?.abort);

      const acceptHeader = buildAcceptHeader(format);
      const headers: Record<string, string> = {
        "Accept": acceptHeader,
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        // 自定义 headers 覆盖内置值（含 User-Agent / Authorization 等）
        ...customHeaders,
      };

      let response: Response;
      try {
        response = await fetch(params.url, { signal, headers });
        clearTimer();
      } catch (err) {
        clearTimer();
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(`Request timed out or was cancelled: ${params.url}`);
        }
        throw new Error(`Failed to fetch ${params.url}: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${params.url}`);
      }

      // 双重大小检查：先 Content-Length（快速 fail，不读 body）
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large (Content-Length exceeds ${Math.round(MAX_RESPONSE_SIZE / 1024 / 1024)}MB limit): ${params.url}`);
      }

      let arrayBuffer: ArrayBuffer;
      try {
        arrayBuffer = await response.arrayBuffer();
      } catch (err) {
        throw new Error(`Failed to read response body: ${err instanceof Error ? err.message : String(err)}`);
      }

      // 再次检查实际 body 大小（防 Content-Length header 说谎）
      if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large (body exceeds ${Math.round(MAX_RESPONSE_SIZE / 1024 / 1024)}MB limit): ${params.url}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      const { output, isImage, mime, base64 } = await convertResponse(arrayBuffer, contentType, format);

      // 页面标题（仅 HTML 时尝试提取）
      let title = params.url;
      if (isHTMLMime(mime) && typeof DOMParser !== "undefined") {
        try {
          const rawHTML = new TextDecoder().decode(arrayBuffer);
          const doc = new DOMParser().parseFromString(rawHTML, "text/html");
          const pageTitle = doc.querySelector("title")?.textContent?.trim();
          if (pageTitle) title = pageTitle;
        } catch {
          // 提取标题失败不影响主流程
        }
      }

      if (isImage && base64) {
        return {
          output: `Image fetched successfully from ${params.url}`,
          metadata: {
            url: params.url,
            mime,
            format: "image",
            size: arrayBuffer.byteLength,
            dataUrl: `data:${mime};base64,${base64}`,
          },
        };
      }

      return {
        output,
        metadata: {
          url: params.url,
          title,
          mime,
          format,
          size: arrayBuffer.byteLength,
          status: response.status,
        },
      };
    },
  };
}
