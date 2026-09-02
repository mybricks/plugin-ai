import type { Tool, ToolResult } from "../../../types";
import type { ToolExecutionContext } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { AgentSandbox } from "../../../agent-sandbox";
import { checkWriteFilePermission } from "../../../mode-manager";
import { READ_TOOL_NAME } from "../read";
import { EDIT_TOOL_NAME } from "../edit";

export const WRITE_TOOL_NAME = "write_file";

export function createWriteTool(sandbox: AgentSandbox): Tool {
  return {
    name: WRITE_TOOL_NAME,
    limits: { maxToken: false },
    description: `写入单个文件到项目中。建议并行多次调用，同时写入多个文件以节省时间。

IMPORTANT: All string values must use raw Unicode characters. Never escape any character as \\uXXXX regardless of language

用法：
- 对已有文件优先使用 \`${EDIT_TOOL_NAME}\` 进行局部修改——它只发送差异部分。只有新建文件或需要完整重写时才使用此工具
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
    validate(params: { path?: string; content?: string }, ctx?: ToolExecutionContext) {
      if (!params.path || typeof params.path !== "string" || !params.path.trim()) {
        throw new ToolValidationError("path is required and must be a non-empty string");
      }
      if (params.content === undefined || params.content === null) {
        throw new ToolValidationError("content is required");
      }
      checkWriteFilePermission(params, ctx);
    },
    async execute(params: { path: string; content: string }): Promise<ToolResult> {
      try {
        await sandbox.files.write({ path: params.path, content: params.content });
      } catch (err) {
        throw new ToolValidationError(`Failed to write ${params.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
      const lineCount = params.content.split("\n").length;
      return {
        output: `File written: ${params.path} (${lineCount} lines)`,
        metadata: { path: params.path, lineCount },
      };
    },
  };
}
