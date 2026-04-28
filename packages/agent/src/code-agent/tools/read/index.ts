import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";

export const READ_TOOL_NAME = "read_file";

const DEFAULT_LINE_LIMIT = 2000;

export function createReadTool(adapter: Sandbox): Tool {
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
- 超大文件会被截断，截断时返回提示，需用 startLine 继续读取后续内容
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
      const files = await adapter.getFiles();

      if (!params.path) {
        const paths = files.map((f) => f.path);
        return {
          output: paths.join("\n"),
          metadata: { files: paths },
        };
      }

      const file = files.find((f) => f.path === params.path);
      if (!file) {
        throw new ToolValidationError(`File not found: ${params.path}. Use \`${READ_TOOL_NAME}\` to list available files.`);
      }

      const allLines = file.content.split("\n");
      const totalLines = allLines.length;

      const startLine = Math.max(1, params.startLine ?? 1);
      const maxEnd = startLine + DEFAULT_LINE_LIMIT - 1;
      const endLine = params.endLine
        ? Math.min(params.endLine, totalLines)
        : Math.min(maxEnd, totalLines);

      if (startLine > totalLines) {
        throw new ToolValidationError(`startLine ${startLine} is out of range (file has ${totalLines} lines)`);
      }

      const sliced = allLines.slice(startLine - 1, endLine);
      const truncated = endLine < totalLines && !params.endLine;

      const content = sliced.map((line, i) => `${startLine + i}: ${line}`).join("\n");

      let output = content;
      if (truncated) {
        output += `\n\n(Showing lines ${startLine}-${endLine} of ${totalLines}. Use startLine=${endLine + 1} to continue.)`;
      } else {
        output += `\n\n(Lines ${startLine}-${endLine} of ${totalLines})`;
      }

      return {
        output,
        metadata: {
          path: file.path,
          startLine,
          endLine,
          totalLines,
          truncated,
        },
      };
    },
  };
}
