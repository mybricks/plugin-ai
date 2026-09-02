import type { AgentSandbox, AgentSandboxGrepResult } from "../../../agent-sandbox";
import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";

export const GREP_TOOL_NAME = "grep_search";

const DEFAULT_HEAD_LIMIT = 250;

function formatGrepOutput(result: AgentSandboxGrepResult): string {
  const { matches, outputMode, offset, totalCount, hasMore } = result;
  let output: string;

  if (outputMode === "files_with_matches") {
    output = matches.map((match) => match.path).join("\n");
  } else if (outputMode === "content") {
    output = matches
      .map((match) => {
        const lines = (match.lines ?? [])
          .map((line) => `${line.lineNumber}: ${line.content}`)
          .join("\n");
        return `${match.path}\n${lines}`;
      })
      .join("\n\n");
  } else {
    output = matches.map((match) => `${match.path}:${match.count}`).join("\n");
  }

  if (!output) return "No matches found";

  if (outputMode === "files_with_matches") {
    const header = `Found ${matches.length} file${matches.length !== 1 ? "s" : ""}`;
    output = `${header}\n${output}`;
    if (hasMore) {
      output += `\n\n(Showing ${offset + 1}-${offset + matches.length} of ${totalCount}. Use offset=${offset + matches.length} to see more)`;
    }
  } else if (outputMode === "count") {
    const occurrences = matches.reduce((sum, match) => sum + (match.count ?? 0), 0);
    output += `\n\nFound ${occurrences} total occurrence${occurrences !== 1 ? "s" : ""} across ${matches.length} file${matches.length !== 1 ? "s" : ""}.`;
    if (hasMore) {
      output += `\n(Showing ${offset + 1}-${offset + matches.length} of ${totalCount}. Use offset=${offset + matches.length} to see more)`;
    }
  } else if (hasMore) {
    output += `\n\n(Showing ${offset + 1}-${offset + matches.length} of ${totalCount}. Use offset=${offset + matches.length} to see more)`;
  } else {
    output += `\n\n(${totalCount} results in total)`;
  }

  return output;
}

function getStructuredGrepResult(value: unknown): AgentSandboxGrepResult | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AgentSandboxGrepResult>;
  return candidate.type === "grep" && Array.isArray(candidate.matches) &&
    typeof candidate.totalCount === "number" && typeof candidate.offset === "number" &&
    typeof candidate.returned === "number" && typeof candidate.hasMore === "boolean"
    ? candidate as AgentSandboxGrepResult
    : null;
}

/**
 * Grep always delegates to the AgentSandbox command transport. A Sandbox V1
 * is normalized to AgentSandbox by CodeAgent, so this tool has one API and
 * one output path for both sandbox generations.
 */
export function createGrepTool(sandbox: AgentSandbox): Tool {
  return {
    name: GREP_TOOL_NAME,
    description: `在项目文件中使用正则表达式搜索内容。

用法：
- 始终使用此工具进行代码搜索任务
- 支持完整的正则表达式语法 (e.g., "log.*Error", "function\\s+\\w+")
- 使用 glob 参数按文件名模式过滤 (e.g., "*.js", "**/*.tsx") or type parameter (e.g., "js", "py", "rust")
- 输出模式：files_with_matches（仅返回匹配的文件路径，默认，最省 token）、content（返回匹配行内容）、count（各文件匹配计数）
- 结果按文件路径排序，最多返回 ${DEFAULT_HEAD_LIMIT} 条，可用 offset 翻页
- 可并行调用此工具同时进行多个搜索`,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "正则表达式搜索模式" },
        glob: { type: "string", description: "按文件名过滤的 glob 模式，例如 \"*.ts\"、\"src/**/*.tsx\"" },
        output_mode: {
          type: "string",
          enum: ["files_with_matches", "content", "count"],
          description: "输出模式：files_with_matches（仅返回文件路径，默认）、content（返回匹配行）、count（各文件匹配计数）",
        },
        case_insensitive: { type: "boolean", description: "是否大小写不敏感（默认 false）" },
        head_limit: { type: "number", description: `最多返回的结果条数（默认 ${DEFAULT_HEAD_LIMIT}）` },
        offset: { type: "number", description: "跳过前 N 条结果，用于翻页（默认 0）" },
      },
      required: ["pattern"],
    },
    validate(params: { pattern?: string }) {
      if (!params.pattern || typeof params.pattern !== "string" || !params.pattern.trim()) {
        throw new ToolValidationError("pattern is required and must be a non-empty string");
      }
    },
    async execute(params: {
      pattern: string;
      glob?: string;
      output_mode?: "files_with_matches" | "content" | "count";
      case_insensitive?: boolean;
      head_limit?: number;
      offset?: number;
    }): Promise<ToolResult> {
      const outputMode = params.output_mode ?? "files_with_matches";
      const headLimit = params.head_limit ?? DEFAULT_HEAD_LIMIT;
      const offset = params.offset ?? 0;
      const commandResult = await sandbox.commands.execute({
        name: "grep",
        input: {
          pattern: params.pattern,
          ...(params.glob ? { glob: params.glob } : {}),
          outputMode,
          caseInsensitive: params.case_insensitive ?? false,
          headLimit,
          offset,
        },
      });

      if (commandResult.exitCode !== 0) {
        throw new ToolValidationError(commandResult.stderr || commandResult.stdout || "grep command failed");
      }

      const structured = getStructuredGrepResult(commandResult.structured);
      if (!structured) {
        throw new Error("AgentSandbox grep command must return a structured grep result");
      }

      return {
        output: formatGrepOutput(structured),
        metadata: {
          pattern: params.pattern,
          totalCount: structured.totalCount,
          offset: structured.offset,
          returned: structured.returned,
          hasMore: structured.hasMore,
        },
      };
    },
  };
}
