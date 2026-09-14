import type { Message, ToolCallRecord } from "./types";

type ToolCallMessageOptions = {
  /** 由所属 turn / 当前执行信号提供，不持久化到 ToolCallRecord。 */
  isCancelled?: boolean;
};

/**
 * 把错误规范化为模型可读的文本。
 *
 * 历史记录中同时存在带/不带 `Error:` 前缀的旧值；在此统一处理，
 * 避免实时执行、retry 和历史回放得到不同文案。
 */
function formatToolError(error: unknown): string {
  const text = String(error ?? "Tool execution failed");
  return text.startsWith("Error:") ? text : `Error: ${text}`;
}

/**
 * 从持久化的 ToolCallRecord 生成将要交给模型的文本内容。
 *
 * 取消并不抹掉工具已经完成的部分：若工具已返回 output，保留该 output，
 * 再在末尾明确标注取消。取消归属于 TurnRecord，因此由调用方传入，避免在
 * ToolCallRecord 重复保存同一状态。
 */
function getToolCallMessageContent(
  record: ToolCallRecord,
  options: ToolCallMessageOptions = {},
): string {
  // pending 只会出现在进程异常后的 retry 边缘路径；保持既有的空结果语义。
  if (record.status === "pending") return "";
  if (record.status === "success" && record.result) return record.result.output;

  const error = formatToolError(record.error);
  if (options.isCancelled && record.result?.output) {
    return `${record.result.output}\n\n${error}`;
  }
  return error;
}

/**
 * 从 ToolCallRecord 还原标准 tool Message。
 *
 * 实时执行、retry 续跑和历史 turn 重建必须共用此函数，避免各路径各自
 * 拼接错误前缀或遗漏取消前的部分 output。
 */
export function toolCallRecordToMessage(
  record: ToolCallRecord,
  options: ToolCallMessageOptions = {},
): Message {
  const status = record.status === "pending"
    ? undefined
    : record.status === "success" && record.result ? "success" : "error";
  return {
    role: "tool",
    tool_call_id: record.callId,
    content: getToolCallMessageContent(record, options),
    ...(status ? { status } : {}),
    ...(record.errorType ? { errorType: record.errorType } : {}),
    ...(record.attachments?.length ? { attachments: record.attachments } : {}),
  };
}
