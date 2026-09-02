/** Content returned only by an explicit read operation. */
export interface AgentSandboxFile {
  path: string;
  content: string;
  permissions?: {
    read?: boolean;
    write?: boolean;
    delete?: boolean;
  };
}

/** Directory/listing metadata. `list` intentionally never returns content. */
export interface AgentSandboxFileEntry {
  path: string;
  type?: "file" | "directory";
  permissions?: AgentSandboxFile["permissions"];
  size?: number;
  lineCount?: number;
  hash?: string;
}

export interface AgentSandboxListOptions {
  /** Return descendant metadata in one operation; never includes file content. */
  recursive?: boolean;
}

/** Atomic file-system operations used by AgentSandbox tools. */
export interface AgentSandboxFiles {
  /**
   * Lists metadata only. `recursive` lets remote hosts avoid one request per
   * directory during find/glob/grep discovery.
   */
  list(path?: string, options?: AgentSandboxListOptions): Promise<AgentSandboxFileEntry[]>;
  read(path: string): Promise<AgentSandboxFile | null>;
  readFiles(paths: string[]): Promise<AgentSandboxFile[]>;
  write(file: { path: string; content: string }): Promise<void>;
  writeFiles(files: Array<{ path: string; content: string }>): Promise<void>;
  remove(path: string): Promise<void>;
  removeFiles(paths: string[]): Promise<void>;
}
