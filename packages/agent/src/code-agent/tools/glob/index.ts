import type { AgentSandbox, AgentSandboxGlobResult } from "../../../agent-sandbox";
import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import { GREP_TOOL_NAME } from "../grep";

export const GLOB_TOOL_NAME = "glob_search";
const DEFAULT_MAX_FILES = 100;

function getGlobResult(value: unknown): AgentSandboxGlobResult | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AgentSandboxGlobResult>;
  return candidate.type === "glob" && Array.isArray(candidate.paths) ? candidate as AgentSandboxGlobResult : null;
}

/** Glob delegates path matching to AgentSandbox.commands. */
export function createGlobTool(sandbox: AgentSandbox): Tool {
  return {
    name: GLOB_TOOL_NAME,
    description: `按文件名模式在项目中快速查找文件。需要按文件内容搜索时，使用 ${GREP_TOOL_NAME} 工具。`,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "文件 glob 匹配模式，例如 \"**/*.ts\"、\"src/**/*.tsx\"、\"*.json\"" },
        max_files: { type: "number", description: `最多返回的文件数量（默认 ${DEFAULT_MAX_FILES}）` },
      },
      required: ["pattern"],
    },
    validate(params: { pattern?: string }) {
      if (!params.pattern || typeof params.pattern !== "string" || !params.pattern.trim()) {
        throw new ToolValidationError("pattern is required and must be a non-empty string");
      }
    },
    async execute(params: { pattern: string; max_files?: number }): Promise<ToolResult> {
      const result = await sandbox.commands.execute({ name: "glob", input: { pattern: params.pattern } });
      if (result.exitCode !== 0) throw new ToolValidationError(result.stderr || result.stdout || "glob command failed");
      const structured = getGlobResult(result.structured);
      if (!structured) throw new Error("AgentSandbox glob command must return a structured glob result");
      const maxFiles = params.max_files ?? DEFAULT_MAX_FILES;
      const paths = [...structured.paths].sort();
      const truncated = paths.length > maxFiles;
      const listed = paths.slice(0, maxFiles);
      const output = !listed.length ? `No files found matching "${params.pattern}"`
        : `${listed.join("\n")}${truncated
          ? `\n\n(Results truncated: showing ${maxFiles} of ${paths.length} files. Use a more specific pattern to narrow down)`
          : `\n\n(${paths.length} files in total)`}`;
      return { output, metadata: { pattern: params.pattern, total: paths.length, returned: listed.length, truncated } };
    },
  };
}
