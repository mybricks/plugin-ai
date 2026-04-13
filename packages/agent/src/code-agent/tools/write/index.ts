import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { READ_TOOL_NAME } from "../read";

export const WRITE_TOOL_NAME = "write_file";

export function createWriteTool(adapter: Sandbox): Tool {
  return {
    name: WRITE_TOOL_NAME,
    description: `写入单个文件到项目中。建议并行多次调用，同时写入多个文件以节省时间。
用法：
- 对已有文件优先使用 \`edit_file\` 进行局部修改——它只发送差异部分。只有新建文件或需要完整重写时才使用此工具。
- 只有在用户明确要求时才使用 emoji，避免在文件中写入 emoji。
- 可并行调用此工具同时创建多个文件`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
        },
        content: {
          type: "string",
          description: "文件完整内容",
        },
      },
      required: ["path", "content"],
    },
    validate(params: { path?: string; content?: string }) {
      if (!params.path || typeof params.path !== "string" || !params.path.trim()) {
        throw new ToolValidationError("path is required and must be a non-empty string");
      }
      if (params.content === undefined || params.content === null) {
        throw new ToolValidationError("content is required");
      }
    },
    async execute(params: { path: string; content: string }): Promise<ToolResult> {
      try {
        await adapter.updateFiles([{ path: params.path, content: params.content }]);
      } catch (err) {
        throw new ToolValidationError(`Failed to write ${params.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
      const lineCount = params.content.split("\n").length;
      return {
        title: params.path,
        output: `File written: ${params.path} (${lineCount} lines)`,
        metadata: { path: params.path, lineCount },
      };
    },
  };
}
