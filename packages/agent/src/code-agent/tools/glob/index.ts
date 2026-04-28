import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { GREP_TOOL_NAME } from "../grep";

export const GLOB_TOOL_NAME = "glob_search";

const DEFAULT_MAX_FILES = 100;

/**
 * 将 glob 模式转换为正则表达式
 * 支持：* (不跨目录)、** (跨目录)、? (单字符)、[abc] (字符集)
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === "*") {
      if (pattern[i + 1] === "*") {
        // ** 匹配任意路径（含目录分隔符）
        regexStr += ".*";
        i += 2;
        // 跳过紧跟的 /
        if (pattern[i] === "/") i++;
      } else {
        // * 匹配当前目录层级内的任意字符（不含 /）
        regexStr += "[^/]*";
        i++;
      }
    } else if (char === "?") {
      regexStr += "[^/]";
      i++;
    } else if (char === "[") {
      // 字符集直接透传
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        regexStr += "\\[";
        i++;
      } else {
        regexStr += pattern.slice(i, end + 1);
        i = end + 1;
      }
    } else {
      // 转义正则特殊字符
      regexStr += char.replace(/[.+^${}()|\\]/g, "\\$&");
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * 检查文件路径是否匹配 glob 模式
 * 支持以目录前缀开头的模式（如 "src/**​/*.ts"）
 */
function matchesGlobPattern(pattern: string, filePath: string): boolean {
  const regex = globToRegex(pattern);
  if (regex.test(filePath)) return true;

  // 如果模式不含 /，则只匹配文件名
  if (!pattern.includes("/")) {
    const fileName = filePath.split("/").pop() ?? filePath;
    return regex.test(fileName);
  }

  return false;
}

export function createGlobTool(adapter: Sandbox): Tool {
  return {
    name: GLOB_TOOL_NAME,
    description: `按文件名模式在项目中快速查找文件。

用法：
- 支持 glob 模式，如 "**​/*.js"、"src/**​/*.ts"
- 结果按文件路径字母顺序排列
- 最多返回 ${DEFAULT_MAX_FILES} 个文件，超出时提示缩小范围
- 需要按文件内容搜索时，使用 ${GREP_TOOL_NAME} 工具`,
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "文件 glob 匹配模式，例如 \"**​/*.ts\"、\"src/**​/*.tsx\"、\"*.json\"",
        },
        max_files: {
          type: "number",
          description: `最多返回的文件数量（默认 ${DEFAULT_MAX_FILES}）`,
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
      max_files?: number;
    }): Promise<ToolResult> {
      const files = await adapter.getFiles();
      const maxFiles = params.max_files ?? DEFAULT_MAX_FILES;

      const matched = files
        .map((f) => f.path)
        .filter((p) => matchesGlobPattern(params.pattern, p))
        .sort();

      const total = matched.length;
      const truncated = total > maxFiles;
      const result = matched.slice(0, maxFiles);

      let output = result.join("\n");

      if (output === "") {
        output = `No files found matching "${params.pattern}"`;
      } else if (truncated) {
        output += `\n\n(Results truncated: showing ${maxFiles} of ${total} files. Use a more specific pattern to narrow down)`;
      } else {
        output += `\n\n(${total} files in total)`;
      }

      return {
        output,
        metadata: {
          pattern: params.pattern,
          total,
          returned: result.length,
          truncated,
        },
      };
    },
  };
}
