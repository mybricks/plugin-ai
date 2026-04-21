import type { Tool, ToolResult } from "../../../types";
import type { ToolExecutionContext } from "../../../agent";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { READ_TOOL_NAME } from "../read";
import { replaceInContent } from "../edit/replace";

export const MULTI_EDIT_TOOL_NAME = "multi_edit";
const EDIT_TOOL_NAME = "edit_file";

/**
 * 计算字符串的行数（不含末尾空行）
 */
function countLines(str: string): number {
  if (!str) return 0;
  const lines = str.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    return lines.length - 1;
  }
  return lines.length;
}

function countPrevFailures(
  ctx: ToolExecutionContext | undefined,
  path: string,
  oldStr: string
): number {
  if (!ctx) return 0;
  let count = 0;
  for (const iter of ctx.iterations) {
    for (const call of iter.toolCalls) {
      if (call.status !== "error") continue;
      if (call.name === EDIT_TOOL_NAME) {
        if (call.args?.path === path && call.args?.old_str === oldStr) count++;
        continue;
      }
      if (call.name === MULTI_EDIT_TOOL_NAME) {
        const edits: Array<{ path?: string; old_str?: string }> = Array.isArray(call.args?.edits) ? call.args.edits : [];
        if (edits.some((e: { path?: string; old_str?: string }) => e.path === path && e.old_str === oldStr)) count++;
      }
    }
  }
  return count;
}

function appendActionHint(
  message: string,
  ctx: ToolExecutionContext | undefined,
  path: string,
  oldStr: string
): string {
  const prev = countPrevFailures(ctx, path, oldStr);
  if (prev === 0) {
    return `${message} 请先通过 \`${READ_TOOL_NAME}\` 读取 ${path} 的最新内容，确认 old_str 后再编辑。`;
  }
  return `${message} 同一 old_str 已连续失败 ${prev + 1} 次，建议改用 \`write_file\` 或 \`multi_write\` 直接重写该文件。`;
}

export function createMultiEditTool(adapter: Sandbox): Tool {
  return {
    name: MULTI_EDIT_TOOL_NAME,
    description: `批量编辑多个文件，对每个文件进行精确的字符串替换。一次调用可以对多个文件同时进行编辑，比多次调用 edit_file 更高效。
警告：
- 如果 old_str 与文件内容不完全匹配（包括空白），工具将失败
- 如果 old_str 与 new_str 相同，工具将失败

编辑时请确保：
- 所有编辑结果符合语言习惯、语法正确
- 只包含需要更改的代码行，出于唯一性的考虑，需要包含一些周围的必要的行，一个old_str/new_str至少3行（除非源文件不够3行），避免出现误操作;
- 一次操作文件不得超过5个
- 编辑文件时，建议先通过 \`${READ_TOOL_NAME}\` 读取文件内容，确认 old_str 后再编辑。
- 不要使用 emoji
- 使用 replace_all 在文件中批量替换和重命名字符串（例如重命名变量时非常有用）`,
    parameters: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          description: "编辑操作列表",
          items: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "文件路径",
              },
              old_str: {
                type: "string",
                description: "要被替换的原始内容（必须与文件中完全一致）",
              },
              new_str: {
                type: "string",
                description: "替换后的内容。传空字符串表示删除 old_str",
              },
              replace_all: {
                type: "boolean",
                description: "是否替换文件中所有匹配的 old_str（默认 false）",
              },
            },
            required: ["path", "old_str", "new_str"],
          },
        },
      },
      required: ["edits"],
    },
    validate(params: { edits?: Array<{ path?: string; old_str?: string; new_str?: string; replace_all?: boolean }> }) {
      if (!Array.isArray(params.edits) || params.edits.length === 0) {
        throw new ToolValidationError("现在拿不到edits参数，工具传参有问题。");
      }
      for (let i = 0; i < params.edits.length; i++) {
        const edit = params.edits[i];
        if (!edit.path || typeof edit.path !== "string" || !edit.path.trim()) {
          throw new ToolValidationError(`edits[${i}].path is required and must be a non-empty string`);
        }
        if (edit.old_str === undefined || edit.old_str === null) {
          throw new ToolValidationError(`edits[${i}].old_str is required`);
        }
        if (edit.new_str === undefined || edit.new_str === null) {
          throw new ToolValidationError(`edits[${i}].new_str is required`);
        }
      }
    },
    async execute(
      params: { edits: Array<{ path: string; old_str: string; new_str: string; replace_all?: boolean }> },
      ctx?: ToolExecutionContext,
    ): Promise<ToolResult> {
      // 批量读取所有文件
      const files = await adapter.getFiles();
      const fileMap = new Map(files.map((f) => [f.path, f.content]));

      // 对每个编辑操作执行替换
      // 用 Map 存储，确保同一路径只保留最终版本
      const updates = new Map<string, string>();
      const results: Array<{ path: string; strategy?: string; error?: string }> = [];

      for (const edit of params.edits) {
        const content = fileMap.get(edit.path);
        if (content === undefined) {
          results.push({
            path: edit.path,
            error: `File not found: ${edit.path}. Use \`${READ_TOOL_NAME}\` without path to list available files.`,
          });
          continue;
        }

        const result = replaceInContent(content, edit.old_str, edit.new_str, edit.replace_all ?? false);
        if (!result.ok) {
          results.push({
            path: edit.path,
            error: appendActionHint(result.message ?? "Replace failed", ctx, edit.path, edit.old_str),
          });
          continue;
        }

        // 更新 fileMap 以支持对同一文件的多次编辑
        fileMap.set(edit.path, result.newContent!);
        updates.set(edit.path, result.newContent!);
        results.push({ path: edit.path, strategy: result.strategy });
      }

      // 检查是否有失败
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        const errorMessages = errors.map((e) => `${e.path}: ${e.error}`).join("\n");
        throw new ToolValidationError(`Some edits failed:\n${errorMessages}`);
      }

      // 批量写入更新后的文件（去重后）
      const filesToWrite = Array.from(updates.entries()).map(([path, content]) => ({ path, content }));
      try {
        await adapter.updateFiles(filesToWrite);
      } catch (err) {
        throw new ToolValidationError(
          `Failed to write files: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // 检查每个 old_str 行数是否过少
      const warnings: string[] = [];
      for (let i = 0; i < params.edits.length; i++) {
        const edit = params.edits[i];
        const fileContent = fileMap.get(edit.path);
        if (fileContent && edit.old_str) {
          const fileLines = countLines(fileContent);
          const oldStrLines = countLines(edit.old_str);
          if (fileLines >= 3 && oldStrLines < 3) {
            warnings.push(`edits[${i}].old_str 只有 ${oldStrLines} 行`);
          }
        }
      }

      const summaries = results.map((r) => ({
        path: r.path,
        strategy: r.strategy,
      }));

      let output = summaries
        .map((s) => `${s.path} (${s.strategy ?? "unknown"})`)
        .join("\n");
      output = `Files edited:\n${output}`;

      if (warnings.length > 0) {
        output = `${output}\n注意：${warnings.join("，")}，行数较少（推荐3行及以上），请确保修改内容准确，避免误操作周围其他代码。`;
      }

      return {
        output,
        metadata: { edits: summaries },
      };
    },
  };
}
