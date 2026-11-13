import type {
  AgentSandboxFileEntry,
  AgentSandboxFindInput,
  AgentSandboxFindResult,
} from "../index";
import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy } from "./index";
import { isStructuredCommandRequest } from "./helpers/request";
import { createFileSystem } from "./helpers/file-access";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Files-backed find fallback. */
export function createFileSystemFindCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "find",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const inputValue = isStructuredCommandRequest(request) ? request.input : undefined;
      if (inputValue && typeof inputValue !== "object") {
        return { stdout: "find: structured input must be an object", exitCode: 2 };
      }
      const input = (inputValue ?? {}) as AgentSandboxFindInput;
      const root = (input.path ?? "").replace(/^\/+|\/+$/g, "");
      let entries: AgentSandboxFileEntry[];
      try { entries = await fileSystem.findEntries(root); }
      catch (error) {
        // A scoped find over a missing directory is simply empty. Root-list
        // failures still surface because they indicate an unavailable host.
        if (root) entries = [];
        else throw error;
      }
      const structured: AgentSandboxFindResult<AgentSandboxFileEntry> = { type: "find", entries };
      return { stdout: "", exitCode: 0, structured };
    },
  };
}

/** Native find proxy, normalized to AgentSandboxFindResult. */
export function createNativeFindCommandProxy(): AgentSandboxCommandProxy {
  return {
    command: "find",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const inputValue = isStructuredCommandRequest(request) ? request.input : undefined;
      if (inputValue && typeof inputValue !== "object") {
        return { stdout: "find: structured input must be an object", exitCode: 2 };
      }
      const input = (inputValue ?? {}) as AgentSandboxFindInput;
      const path = (input.path ?? ".").replace(/^\/+|\/+$/g, "") || ".";
      const result = await next(`find ${shellQuote(path)} -type f -print`, options);
      if (result.exitCode !== 0) return result;
      const entries = result.stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((entryPath) => ({ path: entryPath.replace(/^\.\//, ""), type: "file" as const }))
        .sort((left, right) => left.path.localeCompare(right.path));
      return { ...result, stdout: "", structured: { type: "find", entries } };
    },
  };
}
