import type { AgentSandboxFiles } from "../files";
import type { AgentSandboxCommandProxy, AgentSandboxGrepInput, AgentSandboxGrepMatch, AgentSandboxGrepResult } from "./index";
import { isStructuredCommandRequest, type CommandRequest } from "./helpers/request";
import { createFileSystem } from "./helpers/file-access";

function matchGlob(glob: string, path: string): boolean {
  const value = glob.includes("/") ? path : path.split("/").pop() ?? path;
  return new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`).test(value);
}

function getGrepInput(request: CommandRequest): Partial<AgentSandboxGrepInput> | undefined {
  return isStructuredCommandRequest(request)
    ? request.input as Partial<AgentSandboxGrepInput> | undefined
    : undefined;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "");
}

type CollectedGrepMatch = { lines: Array<{ lineNumber: number; content: string }>; count: number };

function createStructuredResult(
  input: AgentSandboxGrepInput,
  grouped: Map<string, CollectedGrepMatch>,
): AgentSandboxGrepResult {
  const allMatches = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, match]) => input.outputMode === "content"
      ? { path, lines: match.lines }
      : input.outputMode === "count" ? { path, count: match.count } : { path });
  const offset = input.offset ?? 0;
  const headLimit = input.headLimit ?? 250;
  const matches = allMatches.slice(offset, offset + headLimit);
  return {
    type: "grep",
    pattern: input.pattern,
    outputMode: input.outputMode ?? "files_with_matches",
    matches,
    totalCount: allMatches.length,
    offset,
    returned: matches.length,
    hasMore: offset + headLimit < allMatches.length,
  };
}

function toStructuredResult(input: AgentSandboxGrepInput, stdout: string): AgentSandboxGrepResult {
  const grouped = new Map<string, CollectedGrepMatch>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue;
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.type !== "match" || typeof event?.data?.path?.text !== "string") continue;
    const path = normalizePath(event.data.path.text);
    const match = grouped.get(path) ?? { lines: [], count: 0 };
    match.count += 1;
    if (typeof event?.data?.line_number === "number" && typeof event?.data?.lines?.text === "string") {
      match.lines.push({
        lineNumber: event.data.line_number,
        content: event.data.lines.text.replace(/\r?\n$/, ""),
      });
    }
    grouped.set(path, match);
  }
  return createStructuredResult(input, grouped);
}

/** Portable fallback for hosts that have grep but not ripgrep. */
function toGrepFallbackStructuredResult(input: AgentSandboxGrepInput, stdout: string): AgentSandboxGrepResult {
  const grouped = new Map<string, CollectedGrepMatch>();
  for (const line of stdout.split(/\r?\n/)) {
    // grep -R -n emits path:line:content. A greedy path capture keeps colons
    // in a path/content unambiguous by anchoring the numeric line field.
    const match = line.match(/^(.+):(\d+):(.*)$/);
    if (!match) continue;
    const path = normalizePath(match[1]);
    if (input.glob && !matchGlob(input.glob, path)) continue;
    const item = grouped.get(path) ?? { lines: [], count: 0 };
    item.count += 1;
    item.lines.push({ lineNumber: Number(match[2]), content: match[3] });
    grouped.set(path, item);
  }
  return createStructuredResult(input, grouped);
}

function isMissingRipgrep(result: { exitCode: number; stderr?: string }): boolean {
  return result.exitCode === 127 && /(?:command not found|not recognized).*\brg\b|\brg\b.*(?:command not found|not recognized)/i.test(result.stderr ?? "");
}

/** Files-backed grep fallback. It is portable but recursively lists the tree. */
export function createFileSystemGrepCommandProxy(files: AgentSandboxFiles): AgentSandboxCommandProxy {
  const fileSystem = createFileSystem(files);
  return {
    command: "grep",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const input = getGrepInput(request);
      if (!input || typeof input.pattern !== "string") {
        return { stdout: "grep: structured input is required", exitCode: 2 };
      }
      let regex: RegExp;
      try {
        regex = new RegExp(input.pattern, input.caseInsensitive ? "i" : "");
      } catch {
        return { stdout: `Invalid regex pattern: ${input.pattern}`, exitCode: 2 };
      }
      const outputMode = input.outputMode ?? "files_with_matches";
      const matchesList: AgentSandboxGrepMatch[] = [];
      const entries = await fileSystem.findEntries();
      const filteredEntries = input.glob
        ? entries.filter((entry) => matchGlob(input.glob!, entry.path))
        : entries;
      const fileContents = await files.readFiles(filteredEntries.map((e) => e.path));
      for (const file of fileContents) {
        const lines = file.content.split("\n").flatMap((content, index) =>
          regex.test(content) ? [{ lineNumber: index + 1, content }] : []
        );
        if (!lines.length) continue;
        if (outputMode === "files_with_matches") matchesList.push({ path: file.path });
        else if (outputMode === "content") matchesList.push({ path: file.path, lines });
        else matchesList.push({ path: file.path, count: lines.length });
      }
      const offset = input.offset ?? 0;
      const headLimit = input.headLimit ?? 250;
      const paged = matchesList.slice(offset, offset + headLimit);
      const structured: AgentSandboxGrepResult = {
        type: "grep",
        pattern: input.pattern,
        outputMode,
        matches: paged,
        totalCount: matchesList.length,
        offset,
        returned: paged.length,
        hasMore: offset + headLimit < matchesList.length,
      };
      return { stdout: "", exitCode: 0, structured };
    },
  };
}

/**
 * Native grep proxy. It delegates the actual search to the next raw command
 * transport as `rg --json`, then converts the JSON stream into the same
 * structured result used by the files fallback and the grep Tool.
 */
export function createNativeGrepCommandProxy(): AgentSandboxCommandProxy {
  return {
    command: "grep",
    async execute(request, next, options) {
      if (!isStructuredCommandRequest(request)) return next(request, options);
      const input = getGrepInput(request);
      if (!input || typeof input.pattern !== "string") {
        return { stdout: "grep: structured input is required", exitCode: 2 };
      }
      // Validate before invoking rg so the V1 and native paths retain the same
      // error contract for malformed patterns.
      try { new RegExp(input.pattern, input.caseInsensitive ? "i" : ""); } catch {
        return { stdout: `Invalid regex pattern: ${input.pattern}`, exitCode: 2 };
      }
      const normalized: AgentSandboxGrepInput = {
        pattern: input.pattern,
        outputMode: input.outputMode ?? "files_with_matches",
        caseInsensitive: input.caseInsensitive ?? false,
        headLimit: input.headLimit ?? 250,
        offset: input.offset ?? 0,
        ...(input.glob ? { glob: input.glob } : {}),
      };
      const command = [
        "rg --json --no-heading --color never",
        normalized.caseInsensitive ? "-i" : "",
        normalized.glob ? `--glob ${shellQuote(normalized.glob)}` : "",
        `--regexp ${shellQuote(normalized.pattern)}`,
        ".",
      ].filter(Boolean).join(" ");
      const result = await next(command, options);
      if (isMissingRipgrep(result)) {
        // Do not use `grep -R`: it follows symlinks and can crawl dependency
        // trees forever. `find` visits normal files only and prunes the same
        // high-volume internal directories that a project search should skip.
        const grepCommand = [
          "find . \\( -path './.git' -o -path './node_modules' -o -path './.agent' -o -path './.claude' \\) -prune -o -type f -exec grep -H -I -n -E",
          normalized.caseInsensitive ? "-i" : "",
          "--",
          shellQuote(normalized.pattern),
          "{} +",
        ].filter(Boolean).join(" ");
        const grepResult = await next(grepCommand, options);
        // grep returns 1 for a valid query without matches.
        if (grepResult.exitCode !== 0 && grepResult.exitCode !== 1) return grepResult;
        return {
          ...grepResult,
          stdout: "",
          stderr: grepResult.exitCode === 1 ? "" : grepResult.stderr,
          exitCode: 0,
          structured: toGrepFallbackStructuredResult(normalized, grepResult.stdout),
          metadata: { ...grepResult.metadata, searchBackend: "grep" },
        };
      }
      // rg returns 1 for a valid query without matches.
      if (result.exitCode !== 0 && result.exitCode !== 1) return result;
      return {
        ...result,
        stdout: "",
        stderr: result.exitCode === 1 ? "" : result.stderr,
        exitCode: 0,
        structured: toStructuredResult(normalized, result.stdout),
      };
    },
  };
}
