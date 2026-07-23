import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";

export const GREP_TOOL_NAME = "grep_search";

const DEFAULT_HEAD_LIMIT = 250;

/**
 * 简单的 glob 模式匹配（支持 * 和 ?）
 */
function matchGlob(pattern: string, str: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`).test(str);
}

/**
 * 检查文件路径是否匹配 glob 模式（支持路径段匹配）
 */
function fileMatchesGlob(glob: string, filePath: string): boolean {
  // 如果不含路径分隔符，只匹配文件名
  if (!glob.includes("/")) {
    const fileName = filePath.split("/").pop() ?? filePath;
    return matchGlob(glob, fileName);
  }
  return matchGlob(glob, filePath);
}

export function createGrepTool(adapter: Sandbox): Tool {
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
        pattern: {
          type: "string",
          description: "正则表达式搜索模式",
        },
        glob: {
          type: "string",
          description: "按文件名过滤的 glob 模式，例如 \"*.ts\"、\"src/**/*.tsx\"",
        },
        output_mode: {
          type: "string",
          enum: ["files_with_matches", "content", "count"],
          description: "输出模式：files_with_matches（仅返回文件路径，默认）、content（返回匹配行）、count（各文件匹配计数）",
        },
        case_insensitive: {
          type: "boolean",
          description: "是否大小写不敏感（默认 false）",
        },
        head_limit: {
          type: "number",
          description: `最多返回的结果条数（默认 ${DEFAULT_HEAD_LIMIT}）`,
        },
        offset: {
          type: "number",
          description: "跳过前 N 条结果，用于翻页（默认 0）",
        },
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
      const files = await adapter.getFiles();

      const flags = params.case_insensitive ? "i" : "";
      let regex: RegExp;
      try {
        regex = new RegExp(params.pattern, flags);
      } catch {
        throw new ToolValidationError(`Invalid regex pattern: ${params.pattern}`);
      }

      const outputMode = params.output_mode ?? "files_with_matches";
      const headLimit = params.head_limit ?? DEFAULT_HEAD_LIMIT;
      const offset = params.offset ?? 0;

      // 过滤文件
      const filteredFiles = params.glob
        ? files.filter((f) => fileMatchesGlob(params.glob!, f.path))
        : files;

      interface MatchResult {
        path: string;
        lines?: Array<{ lineNumber: number; content: string }>;
        count?: number;
      }

      const results: MatchResult[] = [];

      for (const file of filteredFiles) {
        const lines = file.content.split("\n");
        const matchedLines: Array<{ lineNumber: number; content: string }> = [];

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            matchedLines.push({ lineNumber: i + 1, content: lines[i] });
          }
        }

        if (matchedLines.length === 0) continue;

        if (outputMode === "files_with_matches") {
          results.push({ path: file.path });
        } else if (outputMode === "content") {
          results.push({ path: file.path, lines: matchedLines });
        } else {
          results.push({ path: file.path, count: matchedLines.length });
        }
      }

      const totalCount = results.length;
      const paged = results.slice(offset, offset + headLimit);
      const hasMore = offset + headLimit < totalCount;

      let output: string;

      if (outputMode === "files_with_matches") {
        output = paged.map((r) => r.path).join("\n");
      } else if (outputMode === "content") {
        output = paged
          .map((r) => {
            const lineOutput = (r.lines ?? []).map((l) => `${l.lineNumber}: ${l.content}`).join("\n");
            return `${r.path}\n${lineOutput}`;
          })
          .join("\n\n");
      } else {
        output = paged.map((r) => `${r.path}:${r.count}`).join("\n");
      }

      if (output === "") {
        output = "No matches found";
      } else {
        if (outputMode === "files_with_matches") {
          const header = `Found ${paged.length} file${paged.length !== 1 ? "s" : ""}`;
          output = `${header}\n${output}`;
          if (hasMore) {
            output += `\n\n(Showing ${offset + 1}-${offset + paged.length} of ${totalCount}. Use offset=${offset + headLimit} to see more)`;
          }
        } else if (outputMode === "count") {
          const totalOccurrences = paged.reduce((sum, r) => sum + (r.count ?? 0), 0);
          output += `\n\nFound ${totalOccurrences} total occurrence${totalOccurrences !== 1 ? "s" : ""} across ${paged.length} file${paged.length !== 1 ? "s" : ""}.`;
          if (hasMore) {
            output += `\n(Showing ${offset + 1}-${offset + paged.length} of ${totalCount}. Use offset=${offset + headLimit} to see more)`;
          }
        } else {
          if (hasMore) {
            output += `\n\n(Showing ${offset + 1}-${offset + paged.length} of ${totalCount}. Use offset=${offset + headLimit} to see more)`;
          } else {
            output += `\n\n(${totalCount} results in total)`;
          }
        }
      }

      return {
        output,
        metadata: {
          pattern: params.pattern,
          totalCount,
          offset,
          returned: paged.length,
          hasMore,
        },
      };
    },
  };
}
