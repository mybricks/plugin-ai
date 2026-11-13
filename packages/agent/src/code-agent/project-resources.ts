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

/**
 * Read-only project resource discovery.
 *
 * It only lists and reads resources; it never filters, writes, or deletes
 * project files. Future resource types (tools, skills, etc.) use this same
 * primitive with their own matcher and parser.
 */
export async function scanProjectResources(
  sandbox: AgentSandbox,
  options: ProjectResourceScanOptions,
): Promise<AgentSandboxFile[]> {
  const paths = new Set((options.candidates ?? []).map(normalizePath));
  const entries = await sandbox.files.list("", { recursive: true });
  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (entry.type !== "directory" && options.matches(path)) paths.add(path);
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
