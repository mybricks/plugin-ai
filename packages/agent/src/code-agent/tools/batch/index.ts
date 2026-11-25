/**
 * 批量文件操作工具：move_files / copy_files / rename_paths。
 *
 * 存在原因：这些工具替代了 bash 工具的批量操作命令（mv / cp / rename）。
 * bash 工具要求模型以 shell 字符串表达操作，实测失败率居高不下：
 * - 模型会写出虚拟 FS 不支持的 shell 语法（`;`、`&&`、管道、重定向等），
 *   整条命令被 parseSimpleCommand 拦截后直接报错；
 * - sed 的行地址、head 的多文件参数等真实 shell 语义在虚拟 FS 里没有对应能力，
 *   提示词和知识库约束无法根治，属于接口形态与模型直觉的结构性冲突。
 *
 * 结构化 JSON 参数不存在语法歧义：模型只需填 src/dst/glob 等字段，
 * 校验与语义都在工具内完成，从接口形态上消灭整类语法错误。
 *
 * 实现方式：复用 agent-sandbox/commands/helpers/file-access 里原 bash 命令的
 * 底层实现（execMv / execCp / execRename），行为与语义完全对齐，这里只做
 * 参数解析、校验、顺序执行与结果聚合；bash 工具实现保留在 tools/bash，
 * 需要时可通过 builtinTools 显式启用。
 */

import type { AgentSandbox, AgentSandboxFiles } from "../../../agent-sandbox";
import {
  createFileSystem,
  execCp,
  execMv,
  execRename,
} from "../../../agent-sandbox/commands/helpers/file-access";
import type { Tool, ToolExecutionContext, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import { assertBatchToolPathsCanMutate } from "../../../mode-manager";

export const MOVE_FILES_TOOL_NAME = "move_files";
export const COPY_FILES_TOOL_NAME = "copy_files";
export const RENAME_PATHS_TOOL_NAME = "rename_paths";

interface BatchItem {
  src?: string;
  dst?: string;
}

/** move/copy 共用的 items 参数校验：非空数组且每项 src/dst 均为非空字符串。 */
function validateItems(params: { items?: BatchItem[] }, toolName: string): void {
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new ToolValidationError(`${toolName}: items is required and must be a non-empty array`);
  }
  for (const item of params.items) {
    if (!item || typeof item.src !== "string" || !item.src.trim()) {
      throw new ToolValidationError(`${toolName}: every item must have a non-empty src`);
    }
    if (typeof item.dst !== "string" || !item.dst.trim()) {
      throw new ToolValidationError(`${toolName}: every item must have a non-empty dst`);
    }
  }
}

/** 在 sandbox.files 上补齐 findEntries 等派生能力，供 file-access 的命令实现使用。 */
function toFileSystem(files: AgentSandboxFiles) {
  return createFileSystem(files);
}

/** file-access 返回 FileSystemCommandResult（stdout + exitCode）；exitCode 非 0 时转成异常，让上层按工具失败处理。 */
function toResult(stdout: string, exitCode: number): ToolResult {
  if (exitCode === 0) return { output: stdout, metadata: { ok: true } };
  throw new Error(stdout);
}

/**
 * move_files：批量移动/重命名文件。结构化参数，替代 bash mv。
 * items 逐条顺序执行而不是并行：底层的目录迁移、glob 解析都依赖虚拟 FS 的
 * 当前状态，并行可能互相覆盖同一路径；先成功先落盘，某个 item 失败时抛错
 * 并携带已执行结果，模型可从失败条目续做，不重发已成功条目。
 */
export function createMoveFilesTool(sandbox: AgentSandbox): Tool {
  const fileSystem = toFileSystem(sandbox.files);
  return {
    name: MOVE_FILES_TOOL_NAME,
    description: `批量移动或重命名项目文件/目录。

用法：
- items 数组里每项是 { src, dst }：src 是源文件或目录路径，dst 是目标路径；
- dst 以 / 结尾表示移入该目录（目录自动存在，无需先创建）；
- src 支持 glob（如 "pages/**/*.tsx"）时，dst 视为目标目录；
- 目录移动按路径前缀整体迁移其下所有文件。`,
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "移动任务列表，每项 { src, dst }",
          items: {
            type: "object",
            properties: {
              src: { type: "string", description: "源文件/目录路径，支持 glob" },
              dst: { type: "string", description: "目标路径；以 / 结尾或 src 为 glob/目录时视为目标目录" },
            },
            required: ["src", "dst"],
          },
        },
      },
      required: ["items"],
    },
    validate(params: { items?: BatchItem[] }, ctx?: ToolExecutionContext) {
      validateItems(params, MOVE_FILES_TOOL_NAME);
      const typed = params as { items: Array<{ src: string; dst: string }> };
      // move 同时变更源（被删除）与目标（被写入），两侧路径都纳入 plan/ask 边界检查；
      // src 可能是 glob/目录串，按前缀规则拦截足够（plan 目录外一律拒绝）。
      assertBatchToolPathsCanMutate(ctx, typed.items.flatMap((item) => [item.src, item.dst]), MOVE_FILES_TOOL_NAME);
    },
    async execute(params: { items: Array<{ src: string; dst: string }> }): Promise<ToolResult> {
      const outputs: string[] = [];
      for (const item of params.items) {
        const result = await execMv([item.src, item.dst], fileSystem);
        outputs.push(result.stdout);
        if (result.exitCode !== 0) {
          throw new Error(`${MOVE_FILES_TOOL_NAME} failed at item ${JSON.stringify(item)}: ${result.stdout}\n已执行结果：\n${outputs.join("\n")}`);
        }
      }
      return { output: outputs.join("\n"), metadata: { ok: true, moved: params.items.length } };
    },
  };
}

/**
 * copy_files：批量复制文件/目录。结构化参数，替代 bash cp。
 * 始终按递归语义处理目录（固定传 -r）：虚拟 FS 里目录没有独立节点，递归是
 * 唯一有意义的复制方式；不暴露 recursive 开关，减少模型需要决策的参数。
 */
export function createCopyFilesTool(sandbox: AgentSandbox): Tool {
  const fileSystem = toFileSystem(sandbox.files);
  return {
    name: COPY_FILES_TOOL_NAME,
    description: `批量复制项目文件/目录。

用法：
- items 数组里每项是 { src, dst }：src 是源文件或目录路径，dst 是目标路径；
- dst 以 / 结尾表示复制进该目录；src 为目录或 glob 时按递归语义复制其下所有文件；
- 需要复制整个目录时直接给目录路径，不需要额外参数。`,
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "复制任务列表，每项 { src, dst }",
          items: {
            type: "object",
            properties: {
              src: { type: "string", description: "源文件/目录路径，支持 glob" },
              dst: { type: "string", description: "目标路径；以 / 结尾或 src 为 glob/目录时视为目标目录" },
            },
            required: ["src", "dst"],
          },
        },
      },
      required: ["items"],
    },
    validate(params: { items?: BatchItem[] }, ctx?: ToolExecutionContext) {
      validateItems(params, COPY_FILES_TOOL_NAME);
      const typed = params as { items: Array<{ src: string; dst: string }> };
      // copy 只写入 dst，src 保持不变，因此权限边界只检查目标路径。
      assertBatchToolPathsCanMutate(ctx, typed.items.map((item) => item.dst), COPY_FILES_TOOL_NAME);
    },
    async execute(params: { items: Array<{ src: string; dst: string }> }): Promise<ToolResult> {
      const outputs: string[] = [];
      for (const item of params.items) {
        // 固定传 -r：虚拟 FS 无目录节点，目录复制必须递归（见工具头注释）。
        const result = await execCp(["-r", item.src, item.dst], fileSystem);
        outputs.push(result.stdout);
        if (result.exitCode !== 0) {
          throw new Error(`${COPY_FILES_TOOL_NAME} failed at item ${JSON.stringify(item)}: ${result.stdout}\n已执行结果：\n${outputs.join("\n")}`);
        }
      }
      return { output: outputs.join("\n"), metadata: { ok: true, copied: params.items.length } };
    },
  };
}

/**
 * rename_paths：批量按字符串替换文件路径中的片段。结构化参数，替代 bash rename。
 * 有意只做字面量替换而非正则：改名场景绝大多数是目录/文件名整体迁移，
 * 正则替换路径容易误伤（如 "Page" 命中 "PageView"），字面量语义可预期；
 * 底层 execRename 本身就是 split/join 字面量实现，这里保持语义一致。
 * 参数平铺为 old/new/glob 而非 sed 的 s/// 表达式，避免模型带入 shell 习惯。
 */
export function createRenamePathsTool(sandbox: AgentSandbox): Tool {
  const fileSystem = toFileSystem(sandbox.files);
  return {
    name: RENAME_PATHS_TOOL_NAME,
    description: `批量按字符串替换文件路径中的片段（改的是路径，不是文件内容）。

用法：
- 对 glob 匹配到的每个文件路径，把所有出现的 old 替换为 new；
- 例：old="pages"，new="views"，glob="pages/**/*" 会把 pages 下所有文件迁到 views/ 下；
- 只替换路径字符串，不修改文件内容；改内容用 edit_file / multi_edit。`,
    parameters: {
      type: "object",
      properties: {
        old: { type: "string", description: "路径中要被替换的片段（纯字符串，非正则）" },
        new: { type: "string", description: "替换后的片段" },
        glob: { type: "string", description: "匹配文件路径的 glob 模式，如 pages/**/*" },
      },
      required: ["old", "new", "glob"],
    },
    validate(params: { old?: string; new?: string; glob?: string }) {
      if (typeof params.old !== "string" || params.old === "") {
        throw new ToolValidationError(`${RENAME_PATHS_TOOL_NAME}: old is required`);
      }
      if (typeof params.new !== "string") {
        throw new ToolValidationError(`${RENAME_PATHS_TOOL_NAME}: new is required`);
      }
      if (typeof params.glob !== "string" || !params.glob.trim()) {
        throw new ToolValidationError(`${RENAME_PATHS_TOOL_NAME}: glob is required and must be a non-empty string`);
      }
    },
    async execute(params: { old: string; new: string; glob: string }): Promise<ToolResult> {
      const result = await execRename([params.old, params.new, params.glob], fileSystem);
      return toResult(result.stdout, result.exitCode);
    },
  };
}
