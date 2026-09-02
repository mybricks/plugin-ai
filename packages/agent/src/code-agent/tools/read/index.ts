import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { AgentSandbox, AgentSandboxFileEntry, AgentSandboxFindResult } from "../../../agent-sandbox";

export const READ_TOOL_NAME = "read_file";

const DEFAULT_LINE_LIMIT = 2000;

/**
 * 单次 Read 返回内容的字节上限。
 *
 * 超限时直接抛错，而非静默截断。
 *
 * 设计取舍：曾考虑过截断后加提示让模型续读，但经验表明截断会把接近上限的内容
 * 全量塞入上下文，而报错只有约 100 字节，反而节省 token。
 * 报错同时引导模型使用 startLine/endLine 范围读取或 grep 搜索，是更好的选择。
 * 参考：Claude Code read-tool-token-optimization.md §3
 */
const MAX_BYTES = 50 * 1024;
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`;

/** Browser-compatible UTF-8 byte length calculation */
function byteLength(str: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str).length;
  }
  // Fallback: manual UTF-8 byte counting
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) len += 1;
    else if (code <= 0x7ff) len += 2;
    else if (code <= 0xffff) len += 3;
    else len += 4;
  }
  return len;
}

export function createReadTool(sandbox: AgentSandbox): Tool {
  return {
    name: READ_TOOL_NAME,
//     description: `读取项目中的文件内容，或列出所有文件路径。

// 用法：
// - 不传 path 则返回项目中所有文件的路径列表（不含内容）
// - 传 path 则返回该文件的内容（默认最多返回 ${DEFAULT_LINE_LIMIT} 行）
// - 使用 startLine / endLine 读取指定行范围（1-indexed，含首尾）
// - 超大文件会被截断，截断时返回提示，需用 startLine 继续读取后续内容
// - 在编辑或覆写文件之前，必须先调用此工具读取文件内容
// - 如果读取的文件不存在，会返回错误信息
// - 可并行调用此工具同时读取多个文件`,
    description: `读取项目中的文件内容。
用法：
- 传 path 则返回该文件的内容（默认最多返回 ${DEFAULT_LINE_LIMIT} 行）
- 使用 startLine / endLine 读取指定行范围（1-indexed，含首尾）
- 范围过大时会报错，需用 startLine/endLine 缩小范围，或改用 grep 搜索
- 在编辑或覆写文件之前，必须先调用此工具读取文件内容
- 如果读取的文件不存在，会返回错误信息
- 可并行调用此工具同时读取多个文件`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
        },
        startLine: {
          type: "number",
          description: `从第几行开始读取（1-indexed，默认 1）`,
        },
        endLine: {
          type: "number",
          description: `读到第几行结束（1-indexed，含该行）。与 startLine 配合使用；不传时最多读取 ${DEFAULT_LINE_LIMIT} 行`,
        },
      },
    },
    validate(params: { path?: string; startLine?: number; endLine?: number }) {
      if (params.startLine !== undefined && (typeof params.startLine !== "number" || params.startLine < 1)) {
        throw new ToolValidationError(`startLine must be a positive number, got: ${params.startLine}`);
      }
      if (params.endLine !== undefined && (typeof params.endLine !== "number" || params.endLine < 1)) {
        throw new ToolValidationError(`endLine must be a positive number, got: ${params.endLine}`);
      }
      if (
        params.startLine !== undefined &&
        params.endLine !== undefined &&
        params.endLine < params.startLine
      ) {
        throw new ToolValidationError(`endLine (${params.endLine}) must be >= startLine (${params.startLine})`);
      }
    },
    async execute(
      params: { path?: string; startLine?: number; endLine?: number },
    ): Promise<ToolResult> {
      if (!params.path) {
        const result = await sandbox.commands.execute({ name: "find" });
        const entries = ((result.structured as AgentSandboxFindResult<AgentSandboxFileEntry> | undefined)?.entries ?? [])
          .filter((e) => e.type !== "directory")
          .map((e) => e.path);
        return {
          output: entries.join("\n"),
          metadata: { files: entries },
        };
      }

      const file = await sandbox.files.read(params.path);
      if (!file) {
        throw new ToolValidationError(`File not found: ${params.path}. Use \`${READ_TOOL_NAME}\` to list available files.`);
      }

      const allLines = file.content.split("\n");
      const totalLines = allLines.length;

      const startLine = Math.max(1, params.startLine ?? 1);

      if (startLine > totalLines) {
        throw new ToolValidationError(`startLine ${startLine} is out of range (file has ${totalLines} lines)`);
      }

      // Determine the upper bound requested by the caller
      const requestedEnd = params.endLine
        ? Math.min(params.endLine, totalLines)
        : Math.min(startLine + DEFAULT_LINE_LIMIT - 1, totalLines);

      // Pre-flight byte check: accumulate bytes and error out if the requested range
      // exceeds MAX_BYTES *before* returning anything.
      //
      // Why error instead of truncate?
      // Truncation returns near-limit content and inflates the context window.
      // An error is ~100 bytes and forces the model to use a narrower startLine/endLine
      // range or switch to grep — both are better outcomes for token usage.
      const raw: string[] = [];
      let bytes = 0;
      let lastReadLine = startLine - 1;

      for (let i = startLine - 1; i < requestedEnd; i++) {
        const line = allLines[i];
        const size = byteLength(line) + (raw.length > 0 ? 1 : 0); // +1 for newline separator

        if (bytes + size > MAX_BYTES) {
          // Throw instead of truncate — see MAX_BYTES comment above.
          const rangeDesc = params.endLine
            ? `lines ${startLine}-${params.endLine}`
            : `lines ${startLine}-${requestedEnd} (default ${DEFAULT_LINE_LIMIT}-line window)`;
          throw new ToolValidationError(
            `Output for ${rangeDesc} of "${params.path}" exceeds the ${MAX_BYTES_LABEL} limit ` +
            `(file has ${totalLines} lines total). ` +
            `Use startLine/endLine to read a smaller range, or use grep to search for specific content.`
          );
        }

        raw.push(line);
        bytes += size;
        lastReadLine = i + 1; // 1-indexed
      }

      const hasMoreLines = lastReadLine < totalLines && lastReadLine < requestedEnd;

      const content = raw.map((line, i) => `${startLine + i}: ${line}`).join("\n");

      let output = content;
      const nextOffset = lastReadLine + 1;

      if (hasMoreLines) {
        output += `\n\n(Showing lines ${startLine}-${lastReadLine} of ${totalLines}. Use startLine=${nextOffset} to continue.)`;
      } else {
        output += `\n\n(Lines ${startLine}-${lastReadLine} of ${totalLines})`;
      }

      return {
        output,
        metadata: {
          path: file.path,
          startLine,
          endLine: lastReadLine,
          totalLines,
        },
      };
    },
  };
}
