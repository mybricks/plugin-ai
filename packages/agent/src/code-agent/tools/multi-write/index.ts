import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { WRITE_TOOL_NAME } from "../write";
import { EDIT_TOOL_NAME } from "../edit";
import { MULTI_EDIT_TOOL_NAME } from "../multi-edit";

export const MULTI_WRITE_TOOL_NAME = "multi_write";

export function createMultiWriteTool(adapter: Sandbox): Tool {
  return {
    name: MULTI_WRITE_TOOL_NAME,
    description: `批量写入多个文件到项目中。一次调用写入多个文件，比多次调用 ${WRITE_TOOL_NAME} 更高效。
特别适合空项目创建文件时使用，一次尽可能多创建文件，但不得超过6个。

IMPORTANT: All string values must use raw Unicode characters. Never escape any character as \\uXXXX regardless of language

使用前：
1. 对于已有文件，优先使用 ${EDIT_TOOL_NAME} 或 ${MULTI_EDIT_TOOL_NAME} 进行局部修改
`,
    parameters: {
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "文件列表，每个元素包含 path 和 content",
          items: {
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
        },
      },
      required: ["files"],
    },
    validate(params: { files?: Array<{ path?: string; content?: string }> }) {
      if (!Array.isArray(params.files) || params.files.length === 0) {
        throw new ToolValidationError("files must be a non-empty array");
      }
      for (let i = 0; i < params.files.length; i++) {
        const file = params.files[i];
        if (!file.path || typeof file.path !== "string" || !file.path.trim()) {
          throw new ToolValidationError(`files[${i}].path is required and must be a non-empty string`);
        }
        if (file.content === undefined || file.content === null) {
          throw new ToolValidationError(`files[${i}].content is required`);
        }
      }
    },
    async execute(params: { files: Array<{ path: string; content: string }> }): Promise<ToolResult> {
      try {
        await adapter.updateFiles(params.files);
      } catch (err) {
        throw new ToolValidationError(
          `Failed to write files: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const summaries = params.files.map((f) => {
        const lineCount = f.content.split("\n").length;
        return { path: f.path, lineCount };
      });

      const output = summaries
        .map((s) => `${s.path} (${s.lineCount} lines)`)
        .join("\n");

      return {
        output: `Files written:\n${output}`,
        metadata: { files: summaries },
      };
    },
  };
}
