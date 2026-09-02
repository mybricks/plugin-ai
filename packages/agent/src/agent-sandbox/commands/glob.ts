import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { isStructuredCommandRequest } from "./helpers/request";
import { createFileSystem } from "./helpers/file-access";

function matchGlob(glob: string, path: string): boolean {
  const value = glob.includes("/") ? path : path.split("/").pop() ?? path;
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(value);
}

function isMissingRipgrep(result: { exitCode: number; stderr?: string }): boolean {
  return result.exitCode === 127 && /(?:command not found|not recognized).*\brg\b|\brg\b.*(?:command not found|not recognized)/i.test(result.stderr ?? "");
}

/** Files-backed glob fallback. */
export function createFileSystemGlobCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "glob",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const pattern = (isStructuredCommandRequest(request)
        ? request.input as { pattern?: unknown } | undefined
        : undefined)?.pattern;
      if (typeof pattern !== "string") {
        return { stdout: "glob: pattern is required", exitCode: 2 };
      }
      const entries = await fileSystem.findEntries();
      const paths = entries
        .filter((entry) => matchGlob(pattern, entry.path))
        .map((entry) => entry.path)
        .sort();
      return { stdout: "", exitCode: 0, structured: { type: "glob", paths } };
    },
  };
}

/** Native glob proxy based on `rg --files`, normalized to AgentSandboxGlobResult. */
export function createNativeGlobCommandProxy(): AgentSandboxCommandProxy {
  return {
    command: "glob",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const pattern = (isStructuredCommandRequest(request)
        ? request.input as { pattern?: unknown } | undefined
        : undefined)?.pattern;
      if (typeof pattern !== "string") {
        return { stdout: "glob: pattern is required", exitCode: 2 };
      }
      const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
      const result = await next(`rg --files --glob ${quote(pattern)}`, options);
      if (isMissingRipgrep(result)) {
        const findResult = await next("find . -type f -print", options);
        if (findResult.exitCode !== 0) return findResult;
        const paths = findResult.stdout
          .split(/\r?\n/)
          .filter(Boolean)
          .map((path) => path.replace(/^\.\//, ""))
          .filter((path) => matchGlob(pattern, path))
          .sort();
        return {
          ...findResult,
          stdout: "",
          structured: { type: "glob", paths },
          metadata: { ...findResult.metadata, searchBackend: "find" },
        };
      }
      // rg returns 1 for an empty file set.
      if (result.exitCode !== 0 && result.exitCode !== 1) return result;
      const paths = result.exitCode === 1
        ? []
        : result.stdout.split(/\r?\n/).filter(Boolean).map((path) => path.replace(/^\.\//, "")).sort();
      return {
        ...result,
        stdout: "",
        stderr: result.exitCode === 1 ? "" : result.stderr,
        exitCode: 0,
        structured: { type: "glob", paths },
      };
    },
  };
}
