import type { Tool, ToolResult } from "../../../types";
import type { ToolExecutionContext } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { AgentSandbox } from "../../../agent-sandbox";
import { checkEditFilePermission } from "../../../mode-manager";
import { READ_TOOL_NAME } from "../read";
import { WRITE_TOOL_NAME } from "../write";
import { replaceInContent } from "./replace";

export const EDIT_TOOL_NAME = "edit_file";
/** Used by countPrevFailures to identify multi_edit tool calls (avoids circular import) */
const MULTI_EDIT_TOOL_NAME_ALIAS = "multi_edit";

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
      if (call.name === MULTI_EDIT_TOOL_NAME_ALIAS) {
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
    return `${message} Same old_str has failed ${prev + 1} time(s). Please read the latest content of ${path} via \`${READ_TOOL_NAME}\` and verify old_str before editing.`;
  }
  return `${message} Same old_str has failed ${prev + 1} time(s). Further edits may cause significant errors. Use \`${WRITE_TOOL_NAME}\` to rewrite the entire file instead.`;
}

export function createEditTool(sandbox: AgentSandbox): Tool {
  return {
    name: EDIT_TOOL_NAME,
    limits: { maxToken: false },
    description: `对文件中的内容进行精确的字符串替换。

用法：
- 优先编辑项目中已有的文件，除非明确需要，否则不要新建文件。
- 禁止在文件中写入 emoji。
- 只包含需要更改的代码行，出于唯一性的考虑，需要包含一些周围的必要的行，一个old_str/new_str至少3行（除非源文件不够3行），避免出现误操作;
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
    validate(params: { path?: string; old_str?: string; new_str?: string }, ctx?: ToolExecutionContext) {
      if (!params.path || typeof params.path !== "string" || !params.path.trim()) {
        throw new ToolValidationError("path is required and must be a non-empty string");
      }
      if (params.old_str === undefined || params.old_str === null) {
        throw new ToolValidationError("old_str is required");
      }
      if (params.new_str === undefined || params.new_str === null) {
        throw new ToolValidationError("new_str is required");
      }
      checkEditFilePermission(params, ctx);
    },
    async execute(
      params: { path: string; old_str: string; new_str: string; replace_all?: boolean },
      ctx?: ToolExecutionContext,
    ): Promise<ToolResult> {
      const file = await sandbox.files.read(params.path);
      if (!file) {
        throw new ToolValidationError(
          `File not found: ${params.path}. Use \`${READ_TOOL_NAME}\` to list available files.`
        );
      }

      const result = replaceInContent(file.content, params.old_str, params.new_str, params.replace_all ?? false);
      if (!result.ok) {
        throw new ToolValidationError(
          appendActionHint(result.message ?? "Replace failed", ctx, params.path, params.old_str)
        );
      }

      try {
        await sandbox.files.write({ path: params.path, content: result.newContent! });
      } catch (err) {
        throw new ToolValidationError(`Failed to edit ${params.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
      // 检查 old_str 行数是否过少
      const warnings: string[] = [];
      const fileLines = countLines(file.content);
      const oldStrLines = countLines(params.old_str);
      if (fileLines >= 3 && oldStrLines < 3 && params.old_str) {
        warnings.push(
          `Warning: old_str has only ${oldStrLines} line(s) (recommended: 3+ lines). Make sure the replacement is accurate to avoid unintended changes.`
        );
      }

      let output = `File edited: ${params.path} (strategy: ${result.strategy})`;
      if (warnings.length > 0) {
        output = `${output}\n${warnings.join("\n")}`;
      }

      return {
        output,
        metadata: { path: params.path, strategy: result.strategy, replaceAll: params.replace_all ?? false },
      };
    },
  };
}
