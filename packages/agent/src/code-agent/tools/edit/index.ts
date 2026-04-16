import type { Tool, ToolResult } from "../../../types";
import type { ToolExecutionContext } from "../../../agent";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { READ_TOOL_NAME } from "../read";
import { replaceInContent } from "./replace";

export const EDIT_TOOL_NAME = "edit_file";
const MULTI_EDIT_TOOL_NAME = "multi_edit";

/**
 * 统计本轮 turn 中，同一 path + old_str 的编辑调用已失败了多少次（不含本次）。
 * edit_file 和 multi_edit 都计入（multi_edit 以单条 edit 为粒度）。
 */
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

/**
 * 根据历史失败次数，在错误消息末尾追加对应的行动建议：
 * - 第 1 次（prevFailures === 0）→ 建议先 read_file 核对内容
 * - 第 2 次及以上（prevFailures >= 1）→ 建议改用 write_file / multi_write
 */
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

export function createEditTool(adapter: Sandbox): Tool {
  return {
    name: EDIT_TOOL_NAME,
    description: `对文件中的内容进行精确的字符串替换。

用法：
- 优先编辑项目中已有的文件，除非明确需要，否则不要新建文件。
- 只有在用户明确要求时才使用 emoji，避免在文件中写入 emoji。
- 编辑文件时，建议先通过 \`${READ_TOOL_NAME}\` 读取文件内容，确认 old_str 后再编辑。
- 如果 old_str 在文件中不唯一，编辑会失败。请提供包含更多上下文行的更大字符串使其唯一。
- 使用 \`replace_all\` 批量替换和重命名文件中的字符串，例如重命名某个变量时非常有用。
- 确保 old_str 与当前文件内容完全一致（包括缩进）。`,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
        },
        old_str: {
          type: "string",
          description: "要被替换的原始内容（必须与文件中完全一致，包括缩进）",
        },
        new_str: {
          type: "string",
          description: "替换后的内容。传空字符串表示删除 old_str",
        },
        replace_all: {
          type: "boolean",
          description: "是否替换文件中所有匹配的 old_str（默认 false）。适用于批量重命名变量等场景",
        },
      },
      required: ["path", "old_str", "new_str"],
    },
    validate(params: { path?: string; old_str?: string; new_str?: string }) {
      if (!params.path || typeof params.path !== "string" || !params.path.trim()) {
        throw new ToolValidationError("path is required and must be a non-empty string");
      }
      if (params.old_str === undefined || params.old_str === null) {
        throw new ToolValidationError("old_str is required");
      }
      if (params.new_str === undefined || params.new_str === null) {
        throw new ToolValidationError("new_str is required");
      }
    },
    async execute(
      params: { path: string; old_str: string; new_str: string; replace_all?: boolean },
      ctx?: ToolExecutionContext,
    ): Promise<ToolResult> {
      const files = await adapter.getFiles();
      const file = files.find((f) => f.path === params.path);
      if (!file) {
        throw new ToolValidationError(
          `File not found: ${params.path}. Use \`${READ_TOOL_NAME}\` without path to list available files.`
        );
      }

      const result = replaceInContent(file.content, params.old_str, params.new_str, params.replace_all ?? false);
      if (!result.ok) {
        throw new ToolValidationError(
          appendActionHint(result.message ?? "Replace failed", ctx, params.path, params.old_str)
        );
      }

      try {
        await adapter.updateFiles([{ path: params.path, content: result.newContent! }]);
      } catch (err) {
        throw new ToolValidationError(`Failed to edit ${params.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return {
        title: params.path,
        output: `File edited: ${params.path} (strategy: ${result.strategy})`,
        metadata: { path: params.path, strategy: result.strategy, replaceAll: params.replace_all ?? false },
      };
    },
  };
}
