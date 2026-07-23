import type { Tool, ToolResult } from "../../../types";
import type { ToolExecutionContext } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { checkDeleteFilePermission } from "../../../mode-manager";

export const DELETE_TOOL_NAME = "delete_file";

interface DeleteFailure {
  path: string;
  reason: string;
}

export function createDeleteTool(adapter: Sandbox): Tool {
  return {
    name: DELETE_TOOL_NAME,
    description: `删除项目中的一个或多个文件。

用法：
- 使用 \`paths\` 传入要删除的文件路径数组，可批量删除。
- 删除文件需要在代码修改完成后，写文档之前的阶段进行，否则容易导致报错；
- 删除前应先确认目标文件确实存在；
- 批量删除会尽量删除可删除的文件，并在结果中明确返回已删除、缺失、失败的路径。
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
          description: "兼容旧调用；批量删除始终会在结果中报告缺失路径并继续删除可删除文件。",
        },
      },
      required: ["paths"],
    },
    validate(params: { paths?: string[]; force?: boolean }, ctx?: ToolExecutionContext) {
      if (!Array.isArray(params.paths) || params.paths.length === 0) {
        throw new ToolValidationError("paths is required and must be a non-empty array");
      }
      if (params.paths.some((p) => typeof p !== "string" || !p.trim())) {
        throw new ToolValidationError("every path in paths must be a non-empty string");
      }
      checkDeleteFilePermission(params, ctx);
    },
    async execute(params: { paths: string[]; force?: boolean }): Promise<ToolResult> {
      const files = await adapter.getFiles();
      const fileMap = new Map(files.map((f) => [f.path, f]));

      const requestedPaths = Array.from(new Set(params.paths));
      const existingPaths = requestedPaths.filter((path) => fileMap.has(path));
      const missingPaths = requestedPaths.filter((path) => !fileMap.has(path));
      const permissionDeniedPaths = existingPaths.filter((path) => {
        const file = fileMap.get(path);
        return !!file?.permissions && !file.permissions.delete;
      });
      const deletablePaths = existingPaths.filter((path) => !permissionDeniedPaths.includes(path));

      const deletedPaths: string[] = [];
      const failedPaths: DeleteFailure[] = permissionDeniedPaths.map((path) => ({
        path,
        reason: "cannot be deleted",
      }));

      if (deletablePaths.length > 0) {
        try {
          await adapter.deleteFiles(deletablePaths);
          deletedPaths.push(...deletablePaths);
        } catch (err) {
          const afterBatchFiles = await adapter.getFiles();
          const afterBatchFileSet = new Set(afterBatchFiles.map((f) => f.path));
          const remainingPaths = deletablePaths.filter((path) => afterBatchFileSet.has(path));
          deletedPaths.push(...deletablePaths.filter((path) => !afterBatchFileSet.has(path)));

          for (const path of remainingPaths) {
            try {
              await adapter.deleteFiles([path]);
              deletedPaths.push(path);
            } catch (singleErr) {
              failedPaths.push({
                path,
                reason: singleErr instanceof Error ? singleErr.message : String(singleErr),
              });
            }
          }
        }
      }

      if (deletedPaths.length === 0) {
        return {
          output: [
            "No files deleted.",
            missingPaths.length > 0 ? `Missing files:\n${missingPaths.join("\n")}` : "",
            failedPaths.length > 0 ? `Failed to delete files:\n${failedPaths.map((item) => `${item.path}: ${item.reason}`).join("\n")}` : "",
          ].filter(Boolean).join("\n\n"),
          metadata: {
            paths: requestedPaths,
            deletedPaths: [],
            missingPaths,
            failedPaths,
            force: params.force ?? false,
          },
        };
      }

      return {
        output: [
          `Deleted files:\n${deletedPaths.join("\n")}`,
          missingPaths.length > 0 ? `Missing files:\n${missingPaths.join("\n")}` : "",
          failedPaths.length > 0 ? `Failed to delete files:\n${failedPaths.map((item) => `${item.path}: ${item.reason}`).join("\n")}` : "",
        ].filter(Boolean).join("\n\n"),
        metadata: {
          paths: requestedPaths,
          deletedPaths,
          missingPaths,
          failedPaths,
          force: params.force ?? false,
        },
      };
    },
  };
}
