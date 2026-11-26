import type { AgentSandbox } from "../agent-sandbox";
import type { AgentSandboxFile } from "../agent-sandbox";

export interface ProjectResourceScanOptions {
  /**
   * Paths read even when virtual files do not appear in the directory listing.
   * Resource scanners should use this for root-level convention files.
   */
  candidates?: readonly string[];
  /** Selects resource files from the project tree. */
  matches: (path: string) => boolean;
  /** Defines deterministic processing order for discovered resources. */
  compare?: (a: string, b: string) => number;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Rule discovery only: other file operations retain access to these directories. */
const EXCLUDED_RESOURCE_DIRECTORIES = new Set([
  ".git", ".hg", ".svn", "node_modules", "bower_components",
  "dist", "build", "coverage", ".next", ".nuxt", ".output",
  ".turbo", ".cache", ".pnpm-store", ".venv", "venv", "__pycache__",
]);
const MAX_RESOURCE_DEPTH = 10;
const LIST_CONCURRENCY = 8;

/**
 * Read-only project resource discovery.
 *
 * Directory exclusions and depth apply only to this resource scan; they do not
 * change the sandbox list, read, glob, or grep operations.
 */
export async function scanProjectResources(
  sandbox: AgentSandbox,
  options: ProjectResourceScanOptions,
): Promise<AgentSandboxFile[]> {
  const paths = new Set((options.candidates ?? []).map(normalizePath));
  // Depth counts path components: a file at the root has depth 1.
  let directories = [""];
  while (directories.length) {
    const nextDirectories: string[] = [];
    for (let i = 0; i < directories.length; i += LIST_CONCURRENCY) {
      const batch = directories.slice(i, i + LIST_CONCURRENCY);
      const results = await Promise.all(batch.map((dir) => sandbox.files.list(dir)));
      for (let index = 0; index < results.length; index++) {
        const parent = batch[index];
        const parentDepth = parent ? parent.split("/").length : 0;
        for (const entry of results[index]) {
          const path = normalizePath(entry.path);
          const segments = path.split("/");
          // Only process direct children even if a host ignores list options.
          if (segments.length !== parentDepth + 1 || (parent && !path.startsWith(`${parent}/`))) continue;
          if (entry.type === "directory") {
            if (segments.length < MAX_RESOURCE_DEPTH && !EXCLUDED_RESOURCE_DIRECTORIES.has(segments[segments.length - 1])) {
              nextDirectories.push(path);
            }
          } else if (options.matches(path)) {
            paths.add(path);
          }
        }
      }
    }
    directories = nextDirectories;
  }

  const sortedPaths = Array.from(paths).sort(options.compare);
  const filesByPath = new Map(
    (await sandbox.files.readFiles(sortedPaths)).map((file) => [normalizePath(file.path), file])
  );
  return sortedPaths.flatMap((path) => {
    const file = filesByPath.get(path);
    return file ? [file] : [];
  });
}
