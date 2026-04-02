import type { RequestAsStreamFn, RequestAsStreamParams } from '../requestAsStream';

export interface CustomRequestConfig {
  provider: () => 'openai' | 'anthropic' | Promise<'openai' | 'anthropic'>;
  apiUrl: () => string | Promise<string>;
  apiKey: () => string | Promise<string>;
  model?: () => string | undefined | Promise<string | undefined>;
}

async function resolveConfig(config: CustomRequestConfig) {
  const [provider, apiUrl, apiKey, model] = await Promise.all([
    config.provider(),
    config.apiUrl(),
    config.apiKey(),
    config.model?.() ?? undefined,
  ]);
  return { provider, apiUrl, apiKey, model };
}

function validateResolved(resolved: Awaited<ReturnType<typeof resolveConfig>>): string | null {
  if (!resolved.provider) return '缺少 provider 配置';
  if (!resolved.apiUrl?.trim()) return '缺少 API 地址';
  if (!resolved.apiKey?.trim()) return '缺少 API 密钥';
  try {
    new URL(resolved.apiUrl);
  } catch {
    return `API 地址格式不合法: ${resolved.apiUrl}`;
  }
  return null;
}

function isAbortError(ex: unknown): boolean {
  return (
    (ex instanceof DOMException && ex.name === 'AbortError') ||
    (ex instanceof Error && ex.message.toLowerCase().includes('aborted'))
  );
}

async function readErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()) || response.statusText;
  } catch {
    return response.statusText;
  }
}

/**
 * 创建自定义渠道的请求函数
 * 支持 OpenAI 和 Anthropic 格式的 API
 * config 中所有字段均为函数，每次请求时动态获取，适应配置动态变化的场景
 */
export function createCustomRequest(config: CustomRequestConfig): RequestAsStreamFn {
  return async function (params: RequestAsStreamParams) {
    const { messages, emits } = params;
    const { cancel, write, complete, error, onUsage, onThinking } = emits;

    // 每次请求时动态解析配置
    const resolved = await resolveConfig(config);

    const configError = validateResolved(resolved);
    if (configError) {
      const err = new Error(configError);
      error(err);
      throw err;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      const err = new Error('messages 不能为空');
      error(err);
      throw err;
    }

    const controller = new AbortController();
    cancel(() => controller.abort());

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const requestBody = formatRequestBody(resolved.provider, messages, resolved.model);

      const response = await fetch(resolved.apiUrl, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resolved.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await readErrorText(response);
        throw new Error(`API 请求失败 [${response.status}]: ${text}`);
      }

      if (!response.body) {
        throw new Error('响应体为空，无法读取流数据');
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const parsed = parseSSELine(line, resolved.provider);
            if (parsed.content != null) write(parsed.content);
            if (parsed.thinking != null && onThinking) onThinking(parsed.thinking);
            if (parsed.usage != null && onUsage) onUsage(parsed.usage);
          }
        }
      }

      if (buffer.trimStart().startsWith('data:')) {
        const parsed = parseSSELine(buffer, resolved.provider);
        if (parsed.content != null) write(parsed.content);
        if (parsed.thinking != null && onThinking) onThinking(parsed.thinking);
        if (parsed.usage != null && onUsage) onUsage(parsed.usage);
      }

      complete('');
    } catch (ex) {
      if (isAbortError(ex)) return;
      const err = ex instanceof Error ? ex : new Error(String(ex));
      error(err);
      throw err;
    } finally {
      try { await reader?.cancel(); } catch { /* ignore */ }
    }
  };
}

/**
 * 格式化请求体
 */
function formatRequestBody(
  provider: 'openai' | 'anthropic',
  messages: any[],
  model?: string
): any {
  const defaultModel = provider === 'anthropic' ? 'claude-sonnet-4-5' : 'gpt-4o';
  return {
    model: model?.trim() || defaultModel,
    messages,
    stream: true,
    ...(provider === 'anthropic' ? { max_tokens: 4096 } : {}),
  };
}

/**
 * 解析 SSE 数据行
 */
function parseSSELine(
  line: string,
  provider: 'openai' | 'anthropic'
): { content?: string; thinking?: string; usage?: any } {
  const data = line.replace(/^data:\s*/, '').trim();
  if (data === '' || data === '[DONE]') return {};

  let json: any;
  try {
    json = JSON.parse(data);
  } catch {
    return {};
  }

  if (provider === 'openai') {
    const delta = json.choices?.[0]?.delta;
    const result: { content?: string; thinking?: string; usage?: any } = {};
    if (delta?.content != null) result.content = delta.content;
    if (delta?.reasoning_content != null) result.thinking = delta.reasoning_content;
    if (json.usage) {
      result.usage = {
        inputTokens: json.usage.prompt_tokens,
        outputTokens: json.usage.completion_tokens,
        totalTokens: json.usage.total_tokens,
      };
    }
    return result;
  }

  if (provider === 'anthropic') {
    const result: { content?: string; thinking?: string; usage?: any } = {};
    if (json.type === 'content_block_delta') {
      if (json.delta?.type === 'text_delta' && json.delta?.text != null) result.content = json.delta.text;
      if (json.delta?.type === 'thinking_delta' && json.delta?.thinking != null) result.thinking = json.delta.thinking;
    }
    if (json.type === 'message_delta' && json.usage) {
      result.usage = {
        inputTokens: json.usage.input_tokens,
        outputTokens: json.usage.output_tokens,
      };
    }
    return result;
  }

  return {};
}
