import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { READ_TOOL_NAME } from "../read";

export const DELETE_TOOL_NAME = "delete_file";

export function createDeleteTool(adapter: Sandbox): Tool {
  return {
    name: DELETE_TOOL_NAME,
    description: `删除项目中的一个或多个文件。

用法：
- 使用 \`paths\` 传入要删除的文件路径数组，可批量删除。
- 删除文件需要在代码修改完成后，写文档之前的阶段进行，否则容易导致报错；
- 删除前应先确认目标文件确实存在；
- 默认遇到不存在的文件会报错；传 \`force=true\` 时会忽略不存在的路径。
- 仅用于删除文件，不用于删除目录。`,
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          description: "要删除的文件路径列表",
          items: {
            type: "string",
          },
        },
        force: {
          type: "boolean",
          description: "是否忽略不存在的文件（默认 false）",
        },
      },
      required: ["paths"],
    },
    validate(params: { paths?: string[]; force?: boolean }) {
      if (!Array.isArray(params.paths) || params.paths.length === 0) {
        throw new ToolValidationError("paths is required and must be a non-empty array");
      }
      if (params.paths.some((p) => typeof p !== "string" || !p.trim())) {
        throw new ToolValidationError("every path in paths must be a non-empty string");
      }
    },
    async execute(params: { paths: string[]; force?: boolean }): Promise<ToolResult> {
      const files = await adapter.getFiles();
      const fileSet = new Set(files.map((f) => f.path));

      const requestedPaths = Array.from(new Set(params.paths));
      const existingPaths = requestedPaths.filter((path) => fileSet.has(path));
      const missingPaths = requestedPaths.filter((path) => !fileSet.has(path));

      if (missingPaths.length > 0 && !params.force) {
        throw new ToolValidationError(
          `File not found: ${missingPaths.join(", ")}. Use \`${READ_TOOL_NAME}\` to inspect available files, or pass force=true to ignore missing paths.`
        );
      }

      if (existingPaths.length === 0) {
        return {
          title: "删除文件",
          output: missingPaths.length > 0 ? `No files deleted. Missing: ${missingPaths.join(", ")}` : "No files deleted.",
          metadata: {
            paths: requestedPaths,
            deletedPaths: [],
            missingPaths,
            force: params.force ?? false,
          },
        };
      }

      try {
        await adapter.deleteFiles(existingPaths);
      } catch (err) {
        throw new ToolValidationError(`Failed to delete files: ${err instanceof Error ? err.message : String(err)}`);
      }

      return {
        title: existingPaths.length === 1 ? existingPaths[0] : `删除 ${existingPaths.length} 个文件`,
        output: `Deleted files:\n${existingPaths.join("\n")}${missingPaths.length > 0 ? `\n\nIgnored missing files:\n${missingPaths.join("\n")}` : ""}`,
        metadata: {
          paths: requestedPaths,
          deletedPaths: existingPaths,
          missingPaths,
          force: params.force ?? false,
        },
      };
    },
  };
}
