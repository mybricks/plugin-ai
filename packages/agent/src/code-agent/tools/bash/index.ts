import type { AgentSandboxCommands } from "../../../agent-sandbox";
import type { Tool, ToolExecutionContext, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import { MULTI_EDIT_TOOL_NAME } from "../multi-edit";
import {
  DEFAULT_BASH_ALLOWED_COMMANDS,
  type BashToolOptions,
  type FileSystemBashCommand,
} from "../../../agent-sandbox/commands/helpers/file-access";

export const BASH_TOOL_NAME = "bash";
export { DEFAULT_BASH_ALLOWED_COMMANDS };
export type { BashToolOptions };

function formatCommandOutput(result: { stdout: string; stderr?: string; exitCode: number }): string {
  const output = [result.stdout, result.stderr].filter(Boolean).join(result.stdout && result.stderr ? "\n" : "") || "(done)";
  return result.exitCode === 0 ? output : `${output}\nExit code: ${result.exitCode}`;
}

function getCommandDescription(command: string): string {
  switch (command) {
    case "mv":
      return "移动/重命名文件或目录前缀。dst 以 / 结尾或已有文件以 dst/ 为前缀时视为目标目录。支持 glob 批量移动。";
    case "cp":
      return "复制文件。dst 以 / 结尾时视为目标目录。支持 glob 批量复制；`cp -r <dir> <dst>` 按路径前缀递归复制已有文件，支持多源目录。";
    case "rm":
      return "删除文件。支持 glob 批量删除；`rm -r <dir>` 递归删除目录下所有文件；`-f` 忽略不存在。";
    case "rename":
      return "批量按正则替换路径中的片段，也支持 `rename <old> <new> <glob>`。";
    case "touch":
      return "创建空文件。";
    case "sed":
      return `批量替换文件内容中的文本，支持正则、g、i 标志和多个 \`-e\` 表达式；多文件替换场景使用，否则优先 ${MULTI_EDIT_TOOL_NAME}。`;
    case "head":
      return "读取文件开头内容。默认输出前 10 行；支持 `-n N` 和 `-c N`（k/m 后缀）。";
    default:
      return "由宿主 command transport 执行。";
  }
}

function createBashDescription(allowedCommands: readonly string[]): string {
  const usesVirtualFileSystem = allowedCommands.some((command) =>
    DEFAULT_BASH_ALLOWED_COMMANDS.includes(command as FileSystemBashCommand)
  );
  return `支持的命令：
${allowedCommands.map((command) => `- \`${command}\` — ${getCommandDescription(command)}`).join("\n")}${usesVirtualFileSystem ? `

注意：
- 上述命令由 AgentSandbox 文件系统代理直接处理；\`allowedCommands\` 只决定哪些默认代理可接管命令。
- 其他原始 shell 命令会交给宿主 command transport；是否允许、如何执行由宿主决定。
- 文件系统代理没有空目录概念，不需要先 mkdir；直接创建或移动到目标文件路径即可。
- 文件路径以项目根目录为基准，如 src/components/Button.tsx。` : ""}`;
}

/** The bash tool runs raw scripts through AgentSandbox command proxies and then the host transport. */
export function createBashTool(commands: AgentSandboxCommands, options: BashToolOptions = {}): Tool {
  const allowedCommands = options.allowedCommands ?? DEFAULT_BASH_ALLOWED_COMMANDS;
  return {
    name: BASH_TOOL_NAME,
    description: createBashDescription(allowedCommands),
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的命令，如 mv src/old.ts src/new.ts" },
        description: { type: "string", description: "简短一句话，本次命令的用途说明" },
        timeout_ms: { type: "number", description: "可选超时（毫秒），由宿主 command transport 执行" },
      },
      required: ["command"],
    },
    validate(params: { command?: string; timeout_ms?: number }) {
      if (!params.command || typeof params.command !== "string" || !params.command.trim()) {
        throw new ToolValidationError("command is required and must be a non-empty string");
      }
      if (params.timeout_ms !== undefined && (!Number.isFinite(params.timeout_ms) || params.timeout_ms <= 0)) {
        throw new ToolValidationError("timeout_ms must be a positive number");
      }
    },
    async execute(
      params: { command: string; description?: string; timeout_ms?: number },
      context?: ToolExecutionContext,
    ): Promise<ToolResult> {
      let stdout = "";
      let stderr = "";
      let progressBytes = 0;
      const emitOutput = (stream: "stdout" | "stderr", chunk: string) => {
        progressBytes += chunk.length;
        if (stream === "stdout") stdout += chunk;
        else stderr += chunk;
        context?.emitProgress({
          type: "command-output",
          stream,
          chunk,
          stdout,
          stderr,
          totalBytes: progressBytes,
        });
      };
      const result = await commands.execute(params.command, {
        timeoutMs: params.timeout_ms,
        signal: context?.signal,
        onStdout: (chunk) => emitOutput("stdout", chunk),
        onStderr: (chunk) => emitOutput("stderr", chunk),
      });
      return {
        output: formatCommandOutput(result),
        metadata: {
          exitCode: result.exitCode,
          ...(result.metadata ? { commandMetadata: result.metadata } : {}),
        },
      };
    },
  };
}
