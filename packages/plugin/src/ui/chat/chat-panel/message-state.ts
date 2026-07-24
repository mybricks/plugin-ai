import type { MessageRecord, TurnRecord } from "../use-session";

export type MessageStatus = MessageRecord["status"];

export function turnsToMessageRecords(turns: TurnRecord[]): MessageRecord[] {
  return turns
    .filter((turn) => !turn.deleted)
    .map((turn) => ({
      ...turn,
      status: !turn.endTime && turn.status === "success" ? "pending" : turn.status,
    }));
}

export function findLastPendingId(records: MessageRecord[]): string | null {
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].status === "pending") return records[i].id;
  }
  return null;
}

export function updateMessage(
  messages: MessageRecord[],
  turnId: string,
  updater: (record: MessageRecord) => MessageRecord
): MessageRecord[] {
  return messages.map((record) => (record.id === turnId ? updater(record) : record));
}

export function appendMessage(messages: MessageRecord[], record: MessageRecord): MessageRecord[] {
  return messages.some((item) => item.id === record.id) ? messages : [...messages, record];
}

export function findLastLLMIterIndex(iters: MessageRecord["iterations"]): number {
  for (let i = iters.length - 1; i >= 0; i--) {
    if ((iters[i] as any).type !== "warmup") return i;
  }
  return -1;
}

export function countLLMIters(iters: MessageRecord["iterations"]): number {
  return iters.filter((it) => (it as any).type !== "warmup").length;
}

export function ensureLastLLMIter(record: MessageRecord, startTime = Date.now()): MessageRecord {
  if (findLastLLMIterIndex(record.iterations) >= 0) return record;
  return {
    ...record,
    iterations: [...record.iterations, { content: "", toolCalls: [], startTime }],
  };
}

export function updateLastLLMIter(
  record: MessageRecord,
  updater: (iter: MessageRecord["iterations"][number]) => MessageRecord["iterations"][number]
): MessageRecord {
  const idx = findLastLLMIterIndex(record.iterations);
  if (idx < 0) return record;
  const iterations = [...record.iterations];
  iterations[idx] = updater(iterations[idx]);
  return { ...record, iterations };
}

export function updateLastLLMIterTool(
  record: MessageRecord,
  callId: string,
  updater: (tool: MessageRecord["iterations"][number]["toolCalls"][number]) => MessageRecord["iterations"][number]["toolCalls"][number]
): MessageRecord {
  return updateLastLLMIter(record, (iter) => ({
    ...iter,
    toolCalls: iter.toolCalls.map((tool) => (tool.callId === callId ? updater(tool) : tool)),
  }));
}

export function normalizeAttachments(attachments?: any[]) {
  return (attachments ?? []).map((attachment: any) => ({
    type: attachment.type ?? "image",
    ...(attachment.content !== undefined ? { content: attachment.content } : {}),
    ...(attachment.url !== undefined ? { url: attachment.url } : {}),
    ...(attachment.filename ?? attachment.title ? { filename: attachment.filename ?? attachment.title } : {}),
    ...(attachment.mime ? { mime: attachment.mime } : {}),
    ...(attachment.mediaType ? { mediaType: attachment.mediaType } : {}),
  }));
}

export function parsePartialArgs(raw: string): Record<string, any> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Fall through to lightweight partial extraction.
  }

  const result: Record<string, any> = {};
  for (const key of ["path", "content", "old_str", "new_str"]) {
    const value = extractStringField(raw, key);
    if (value !== null) result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function extractStringField(raw: string, key: string): string | null {
  const keyIndex = raw.indexOf(`"${key}"`);
  if (keyIndex === -1) return null;
  const colonIndex = raw.indexOf(":", keyIndex);
  if (colonIndex === -1) return null;
  const rest = raw.slice(colonIndex + 1).trimStart();
  if (!rest.startsWith('"')) return null;
  const inner = rest.slice(1);
  const closeIndex = findUnescapedQuote(inner);
  return closeIndex === -1 ? inner : inner.slice(0, closeIndex);
}

function findUnescapedQuote(value: string): number {
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '"') continue;
    let backslashes = 0;
    let j = i - 1;
    while (j >= 0 && value[j] === "\\") {
      backslashes++;
      j--;
    }
    if (backslashes % 2 === 0) return i;
  }
  return -1;
}
