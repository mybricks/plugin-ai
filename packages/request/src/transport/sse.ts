export interface SSEEvent {
  event?: string;
  data: string;
}

function parseEventBlock(block: string): SSEEvent | null {
  let event: string | undefined;
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

/** 按 SSE 事件边界读取事件，不解释具体模型协议。 */
export async function readSSEEvents(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  const drain = (flush = false) => {
    const blocks = buffer.split(/\r?\n\r?\n/);
    const remainder = blocks.pop() ?? "";
    buffer = flush ? "" : remainder;
    for (const block of blocks) {
      const event = parseEventBlock(block);
      if (event) onEvent(event);
    }
    if (flush && remainder.trim()) {
      const event = parseEventBlock(remainder);
      if (event) onEvent(event);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    drain();
  }
  buffer += decoder.decode();
  drain(true);
}
