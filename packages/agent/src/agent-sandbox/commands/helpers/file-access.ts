import type { AgentSandboxFileEntry, AgentSandboxFiles } from "../../files";

export const BASH_TOOL_NAME = "bash";
export const DEFAULT_BASH_ALLOWED_COMMANDS = [
  "mv",
  "cp",
  "rm",
  "rename",
  "touch",
  "sed",
  "head",
] as const;
export type FileSystemBashCommand = typeof DEFAULT_BASH_ALLOWED_COMMANDS[number];

export interface BashToolOptions {
  allowedCommands?: readonly string[];
}


// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface FileSystemCommandResult {
  stdout: string;
  exitCode: number;
}

export type FileSystem = AgentSandboxFiles & {
  findEntries(path?: string): Promise<AgentSandboxFileEntry[]>;
};

export function createFileSystem(files: AgentSandboxFiles): FileSystem {
  const findEntries = async (path = ""): Promise<AgentSandboxFileEntry[]> => {
    const recursiveEntries = await files.list(path, { recursive: true });
    const normalizedPath = path.replace(/^\/+|\/+$/g, "");
    const hasDescendant = recursiveEntries.some((entry) => {
      const relative = normalizedPath ? entry.path.slice(normalizedPath.length + 1) : entry.path;
      return relative.includes("/");
    });
    // Older hosts may ignore the optional argument and return direct children.
    // Keep their behavior correct, but compliant remote hosts complete above in
    // one request.
    if (hasDescendant || !recursiveEntries.some((entry) => entry.type === "directory")) {
      return recursiveEntries.filter((entry) => entry.type !== "directory");
    }
    const entries: AgentSandboxFileEntry[] = [];
    const visit = async (directory = path): Promise<void> => {
      const children = await files.list(directory);
      for (const entry of children) {
        entries.push(entry);
        if (entry.type === "directory") await visit(entry.path);
      }
    };
    await visit(path);
    return entries.filter((entry) => entry.type !== "directory");
  };
  return { ...files, findEntries };
}

export function formatCommandOutput(result: FileSystemCommandResult): string {
  const stdout = result.stdout || "(done)";
  return result.exitCode === 0 ? stdout : `${stdout}\nExit code: ${result.exitCode}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function formatChangeSummary(action: string, items: string[], label: string): string {
  return `${action} ${items.length === 1 ? items[0] : `${items.length} ${plural(items.length, label)}`}`;
}

// ─── Glob 匹配（复用 glob 工具相同逻辑） ──────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        regexStr += ".*";
        i += 2;
        if (pattern[i] === "/") i++;
      } else {
        regexStr += "[^/]*";
        i++;
      }
    } else if (char === "?") {
      regexStr += "[^/]";
      i++;
    } else if (char === "[") {
      const end = pattern.indexOf("]", i);
      if (end === -1) { regexStr += "\\["; i++; }
      else { regexStr += pattern.slice(i, end + 1); i = end + 1; }
    } else {
      regexStr += char.replace(/[.+^${}()|\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${regexStr}$`);
}

function matchGlob(pattern: string, filePath: string): boolean {
  const normPath = filePath.replace(/^\/+/, "");
  const normPattern = pattern.replace(/^\/+/, "");
  const regex = globToRegex(normPattern);
  if (regex.test(normPath)) return true;
  if (!normPattern.includes("/")) {
    const fileName = normPath.split("/").pop() ?? normPath;
    return regex.test(fileName);
  }
  return false;
}

// ─── 路径工具 ─────────────────────────────────────────────────────────────────

/** 将用户输入路径规范化（去掉开头的 ./，保留内部 /） */
function normalizePath(p: string): string {
  return p.replace(/^\.\//, "").replace(/^\/+/, "");
}

/** 判断路径是否是 glob 模式（含 * 或 ?） */
function isGlobPattern(p: string): boolean {
  return p.includes("*") || p.includes("?");
}

/** 提取路径的目录部分（不含末尾 /），文件名部分 */
function splitPathParts(p: string): { dir: string; base: string } {
  const idx = p.lastIndexOf("/");
  if (idx === -1) return { dir: "", base: p };
  return { dir: p.slice(0, idx), base: p.slice(idx + 1) };
}

/** 把 src 文件移到 dstDir 目录下，保留 base filename */
function joinPath(dir: string, base: string): string {
  return dir ? `${dir}/${base}` : base;
}

function pathPrefix(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

function dirExists(paths: string[], dir: string): boolean {
  return paths.some((path) => path.startsWith(pathPrefix(dir)));
}

function resolveDirEntries(
  root: string,
  paths: string[]
): Array<{ path: string; relativePath: string; rootBase: string }> {
  const cleanRoot = root.replace(/\/$/, "");
  const prefix = pathPrefix(cleanRoot);
  const rootBase = splitPathParts(cleanRoot).base;
  return paths
    .filter((path) => path.startsWith(prefix))
    .map((path) => ({
      path,
      relativePath: path.slice(prefix.length),
      rootBase,
    }));
}

// ─── tokenizer：简单 shell-like 拆词 ──────────────────────────────────────────

/**
 * 极简 shell tokenizer：
 * - 支持单引号 'xxx' 和双引号 "xxx" 括起的 token（内部空格保留）
 * - 不支持转义符（\），因为虚拟 FS 路径不含特殊字符
 */
export function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let index = 0;
  while (index < command.length) {
    while (index < command.length && /\s/.test(command[index])) index++;
    if (index >= command.length) break;
    const quote = command[index];
    if (quote === "'" || quote === '"') {
      index++;
      let token = "";
      while (index < command.length && command[index] !== quote) token += command[index++];
      if (command[index] === quote) index++;
      tokens.push(token);
      continue;
    }
    let token = "";
    while (index < command.length && !/\s/.test(command[index])) token += command[index++];
    tokens.push(token);
  }
  return tokens;
}

// ─── 命令实现 ──────────────────────────────────────────────────────────────────

export async function execMv(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  // mv [-f] <src...> <dst>
  const filtered = args.filter((a) => !a.startsWith("-"));
  if (filtered.length < 2) {
    return { stdout: "mv: missing operand\nUsage: mv <source> <dest>  or  mv <source...> <dest-dir/>", exitCode: 1 };
  }

  const dst = normalizePath(filtered[filtered.length - 1]);
  const srcs = filtered.slice(0, -1).map(normalizePath);

  const allEntries = await fileSystem.findEntries();
  const fileMap = new Map(allEntries.map((file) => [normalizePath(file.path), file]));
  const allPaths = Array.from(fileMap.keys());

  // 解析 src（支持 glob）
  const resolvedSrcs: Array<{ path: string; relativePath?: string; rootBase?: string }> = [];
  for (const src of srcs) {
    if (isGlobPattern(src)) {
      const matched = Array.from(fileMap.keys()).filter((p) => matchGlob(src, p));
      if (matched.length === 0) {
        return { stdout: `mv: no files match '${src}'`, exitCode: 1 };
      }
      resolvedSrcs.push(...matched.map((path) => ({ path })));
    } else {
      if (fileMap.has(src)) {
        resolvedSrcs.push({ path: src });
      } else {
        const matched = resolveDirEntries(src, allPaths);
        if (matched.length === 0) {
          return { stdout: `mv: '${src}': No such file`, exitCode: 1 };
        }
        resolvedSrcs.push(...matched);
      }
    }
  }

  // 判断 dst 是目录（以 / 结尾）还是精确路径
  const dstExistsAsDir = dirExists(allPaths, dst);
  const hasMultipleSourceArgs = srcs.length > 1 || (srcs.length === 1 && isGlobPattern(srcs[0]) && resolvedSrcs.length > 1);
  const dstIsDir = dst.endsWith("/") || dstExistsAsDir || hasMultipleSourceArgs;
  const dstBase = dst.replace(/\/$/, "");

  const toWrite: { path: string; content: string }[] = [];
  const toDelete: string[] = [];
  const renames: string[] = [];
  const sourceFiles = new Map((await fileSystem.readFiles(resolvedSrcs.map((entry) => entry.path)))
    .map((file) => [normalizePath(file.path), file]));

  for (const entry of resolvedSrcs) {
    const src = entry.path;
    const file = sourceFiles.get(src)!;
    let destPath: string;
    if (entry.relativePath !== undefined) {
      const relativePath = dstIsDir && entry.rootBase
        ? joinPath(entry.rootBase, entry.relativePath)
        : entry.relativePath;
      destPath = normalizePath(joinPath(dstBase, relativePath));
    } else if (dstIsDir) {
      const base = splitPathParts(src).base;
      destPath = normalizePath(joinPath(dstBase, base));
    } else {
      destPath = dst;
    }
    toWrite.push({ path: destPath, content: file.content });
    toDelete.push(src);
    renames.push(`${src} -> ${destPath}`);
  }

  await fileSystem.writeFiles(toWrite);
  await fileSystem.removeFiles(toDelete);

  return {
    stdout: formatChangeSummary("moved", renames, "file"),
    exitCode: 0,
  };
}

export async function execCp(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  // cp [-r] <src> <dst>  or  cp <src...> <dst-dir/>
  const flags = args.filter((a) => a.startsWith("-"));
  const recursive = flags.some((f) => f.includes("r") || f.includes("R"));
  const filtered = args.filter((a) => !a.startsWith("-"));
  if (filtered.length < 2) {
    return { stdout: "cp: missing operand\nUsage: cp [-r] <source> <dest>  or  cp <source...> <dest-dir/>", exitCode: 1 };
  }

  const dst = normalizePath(filtered[filtered.length - 1]);
  const srcs = filtered.slice(0, -1).map(normalizePath);

  const allEntries = await fileSystem.findEntries();
  const fileMap = new Map(allEntries.map((file) => [normalizePath(file.path), file]));
  const allPaths = Array.from(fileMap.keys());

  const resolvedSrcs: Array<{ path: string; relativePath?: string; rootBase?: string }> = [];
  for (const src of srcs) {
    if (isGlobPattern(src)) {
      const matched = Array.from(fileMap.keys()).filter((p) => matchGlob(src, p));
      if (matched.length === 0) {
        return { stdout: `cp: no files match '${src}'`, exitCode: 1 };
      }
      resolvedSrcs.push(...matched.map((path) => ({ path })));
    } else {
      if (fileMap.has(src)) {
        resolvedSrcs.push({ path: src });
      } else if (recursive) {
        const matched = resolveDirEntries(src, allPaths);
        if (matched.length === 0) {
          return { stdout: `cp: '${src}': No such file or directory`, exitCode: 1 };
        }
        resolvedSrcs.push(...matched);
      } else {
        return { stdout: `cp: '${src}': No such file`, exitCode: 1 };
      }
    }
  }

  const dstExistsAsDir = dirExists(allPaths, dst);
  const hasMultipleSourceArgs = srcs.length > 1 || (srcs.length === 1 && isGlobPattern(srcs[0]) && resolvedSrcs.length > 1);
  const dstIsDir = dst.endsWith("/") || dstExistsAsDir || hasMultipleSourceArgs;
  const toWrite: { path: string; content: string }[] = [];
  const copies: string[] = [];
  const dstBase = dst.replace(/\/$/, "");
  const sourceFiles = new Map((await fileSystem.readFiles(resolvedSrcs.map((entry) => entry.path)))
    .map((file) => [normalizePath(file.path), file]));

  for (const entry of resolvedSrcs) {
    const src = entry.path;
    const file = sourceFiles.get(src)!;
    let destPath: string;
    if (entry.relativePath !== undefined) {
      const relativePath = dstIsDir && entry.rootBase
        ? joinPath(entry.rootBase, entry.relativePath)
        : entry.relativePath;
      destPath = normalizePath(joinPath(dstBase, relativePath));
    } else if (dstIsDir) {
      const base = splitPathParts(src).base;
      destPath = normalizePath(joinPath(dstBase, base));
    } else {
      destPath = dst;
    }
    toWrite.push({ path: destPath, content: file.content });
    copies.push(`${src} -> ${destPath}`);
  }

  await fileSystem.writeFiles(toWrite);

  return {
    stdout: formatChangeSummary("copied", copies, "file"),
    exitCode: 0,
  };
}

export async function execRm(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  // rm [-r|-rf|-f] <path...>  (虚拟 FS 中目录即是文件前缀，-r 支持删整个子树)
  const flags = args.filter((a) => a.startsWith("-"));
  const paths = args.filter((a) => !a.startsWith("-")).map(normalizePath);
  const recursive = flags.some((f) => f.includes("r") || f.includes("R"));
  const force = flags.some((f) => f.includes("f"));

  if (paths.length === 0) {
    return { stdout: "rm: missing operand", exitCode: 1 };
  }

  const allPaths = (await fileSystem.findEntries()).map((file) => normalizePath(file.path));

  const toDelete: string[] = [];

  for (const p of paths) {
    if (isGlobPattern(p)) {
      const matched = allPaths.filter((fp) => matchGlob(p, fp));
      if (matched.length === 0 && !force) {
        return { stdout: `rm: no files match '${p}'`, exitCode: 1 };
      }
      toDelete.push(...matched);
    } else {
      // 精确文件
      if (allPaths.includes(p)) {
        toDelete.push(p);
      } else if (recursive) {
        // 目录前缀匹配
        const prefix = p.endsWith("/") ? p : `${p}/`;
        const matched = allPaths.filter((fp) => fp.startsWith(prefix));
        if (matched.length === 0 && !force) {
          return { stdout: `rm: '${p}': No such file or directory`, exitCode: 1 };
        }
        toDelete.push(...matched);
      } else {
        if (!force) {
          return { stdout: `rm: '${p}': No such file (use -r to remove directories)`, exitCode: 1 };
        }
      }
    }
  }

  const unique = Array.from(new Set(toDelete));
  if (unique.length > 0) {
    await fileSystem.removeFiles(unique);
  }

  return {
    stdout: unique.length > 0
      ? formatChangeSummary("removed", unique, "file")
      : "removed 0 files",
    exitCode: 0,
  };
}

/**
 * rename：批量按正则替换路径中的某个片段
 * 用法：rename 's/old/new/' <glob>
 * 或：   rename <old-substr> <new-substr> <glob>
 */
export async function execRename(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  if (args.length < 2) {
    return {
      stdout: "rename: Usage:\n  rename 's/old/new/' <glob>\n  rename <old> <new> <glob>",
      exitCode: 1,
    };
  }

  let oldStr: string, newStr: string, globPattern: string;

  // 检测 's/old/new/' 格式
  const sedLike = /^s\/(.+?)\/(.*)\/[gim]*$/.exec(args[0]);
  if (sedLike) {
    oldStr = sedLike[1];
    newStr = sedLike[2];
    globPattern = normalizePath(args[1] ?? "**/*");
  } else {
    if (args.length < 3) {
      return { stdout: "rename: Usage: rename <old> <new> <glob>", exitCode: 1 };
    }
    oldStr = args[0];
    newStr = args[1];
    globPattern = normalizePath(args[2]);
  }

  const matchedEntries = (await fileSystem.findEntries())
    .filter((file) => matchGlob(globPattern, normalizePath(file.path)));
  const matched = await fileSystem.readFiles(matchedEntries.map((file) => file.path));

  if (matched.length === 0) {
    return { stdout: `rename: no files match '${globPattern}'`, exitCode: 1 };
  }

  const toWrite: { path: string; content: string }[] = [];
  const toDelete: string[] = [];
  const renames: string[] = [];

  for (const file of matched) {
    const src = normalizePath(file.path);
    const dst = normalizePath(src.split(oldStr).join(newStr));
    if (src === dst) continue;
    toWrite.push({ path: dst, content: file.content });
    toDelete.push(src);
    renames.push(`${src} -> ${dst}`);
  }

  if (renames.length === 0) {
    return { stdout: `renamed 0 paths (old='${oldStr}' not found)`, exitCode: 0 };
  }

  await fileSystem.writeFiles(toWrite);
  await fileSystem.removeFiles(toDelete);

  return {
    stdout: formatChangeSummary("renamed", renames, "path"),
    exitCode: 0,
  };
}

export async function execTouch(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  const paths = args.filter((a) => !a.startsWith("-")).map(normalizePath);
  if (paths.length === 0) {
    return { stdout: "touch: missing operand", exitCode: 1 };
  }

  const existingSet = new Set((await fileSystem.findEntries()).map((file) => normalizePath(file.path)));

  // 只创建不存在的文件
  const toCreate = paths.filter((p) => !existingSet.has(p));
  if (toCreate.length > 0) {
    await fileSystem.writeFiles(toCreate.map((p) => ({ path: p, content: "" })));
  }

  return {
    stdout: `touched ${paths.length} ${plural(paths.length, "file")} (created ${toCreate.length}, unchanged ${paths.length - toCreate.length})`,
    exitCode: 0,
  };
}

export async function execHead(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  // head [-n <lines>] [-c <bytes>] <file>
  let lineCount: number | null = null;
  let byteCount: number | null = null;
  let filePath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-n") {
      const val = parseInt(args[++i], 10);
      if (isNaN(val) || val < 0) return { stdout: `head: invalid line count '${args[i]}'`, exitCode: 1 };
      lineCount = val;
    } else if (arg === "-c") {
      const raw = args[++i];
      if (!raw) return { stdout: "head: option -c requires an argument", exitCode: 1 };
      // 支持 k / m 后缀
      const match = /^(\d+)([km]?)$/i.exec(raw);
      if (!match) return { stdout: `head: invalid byte count '${raw}'`, exitCode: 1 };
      const num = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      byteCount = unit === "k" ? num * 1024 : unit === "m" ? num * 1024 * 1024 : num;
    } else if (/^-n\d+$/.test(arg)) {
      lineCount = parseInt(arg.slice(2), 10);
    } else if (/^-c\d+[km]?$/i.test(arg)) {
      const raw = arg.slice(2);
      const match = /^(\d+)([km]?)$/i.exec(raw)!;
      const num = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      byteCount = unit === "k" ? num * 1024 : unit === "m" ? num * 1024 * 1024 : num;
    } else if (!arg.startsWith("-")) {
      filePath = normalizePath(arg);
    }
  }

  if (!filePath) {
    return { stdout: "head: missing file operand\nUsage: head [-n <lines>] [-c <bytes>] <file>", exitCode: 1 };
  }

  const file = await fileSystem.read(filePath);

  if (!file) {
    return { stdout: `head: '${filePath}': No such file`, exitCode: 1 };
  }

  const content = file.content;

  if (byteCount !== null) {
    // -c 模式：截取字节数（这里按字符数处理，UTF-8 环境近似）
    const truncated = content.slice(0, byteCount);
    const isTruncated = content.length > byteCount;
    return {
      stdout: isTruncated ? `${truncated}\n// [file truncated, total size: ${content.length} chars]` : truncated,
      exitCode: 0,
    };
  }

  // 默认 -n 模式，默认 10 行
  const n = lineCount ?? 10;
  const lines = content.split("\n");
  const truncated = lines.slice(0, n).join("\n");
  const isTruncated = lines.length > n;
  return {
    stdout: isTruncated ? `${truncated}\n// [${lines.length - n} more lines not shown]` : truncated,
    exitCode: 0,
  };
}

function parseSedExpression(expr: string): RegExpMatchArray | null {
  return /^s(.)(.+?)\1(.*?)\1([gim]*)$/.exec(expr);
}

/**
 * sed -i 's/old/new/[flags]' <glob>
 * 支持 g（全局替换），不支持行范围
 */
export async function execSed(args: string[], fileSystem: FileSystem): Promise<FileSystemCommandResult> {
  // 解析：sed [-i] [-e] 's/old/new/flags' ... <glob...>
  const filteredArgs = args.filter((a) => a !== "-i" && a !== "--in-place" && a !== "-E" && a !== "-r");

  if (filteredArgs.length < 2) {
    return {
      stdout: "sed: Usage: sed -i [-e] 's/old/new/[g]' ... <glob>",
      exitCode: 1,
    };
  }

  const exprArgs: string[] = [];
  const globArgs: string[] = [];
  for (let i = 0; i < filteredArgs.length; i++) {
    const arg = filteredArgs[i];
    if (arg === "-e") {
      const expr = filteredArgs[++i];
      if (!expr) {
        return { stdout: "sed: option -e requires an argument", exitCode: 1 };
      }
      exprArgs.push(expr);
    } else if (parseSedExpression(arg)) {
      exprArgs.push(arg);
    } else {
      globArgs.push(normalizePath(arg));
    }
  }

  if (exprArgs.length === 0 || globArgs.length === 0) {
    return { stdout: "sed: Usage: sed -i [-e] 's/old/new/[g]' ... <glob>", exitCode: 1 };
  }

  const replacements: Array<{ regex: RegExp; newStr: string }> = [];
  for (const exprArg of exprArgs) {
    const match = parseSedExpression(exprArg);
    if (!match) {
      return { stdout: `sed: invalid expression '${exprArg}'\nExpected format: s/old/new/[g]`, exitCode: 1 };
    }
    const oldPattern = match[2];
    const newStr = match[3];
    const flags = match[4];
    const global = flags.includes("g");
    const caseInsensitive = flags.includes("i");
    try {
      replacements.push({
        regex: new RegExp(oldPattern, (global ? "g" : "") + (caseInsensitive ? "i" : "")),
        newStr,
      });
    } catch {
      return { stdout: `sed: invalid regex '${oldPattern}'`, exitCode: 1 };
    }
  }

  const entries = await fileSystem.findEntries();
  const matchedEntries: typeof entries = [];
  for (const pattern of globArgs) {
    matchedEntries.push(...entries.filter((file) => matchGlob(pattern, normalizePath(file.path))));
  }

  // 去重
  const seen = new Set<string>();
  const uniqueEntries = matchedEntries.filter((file) => {
    const k = normalizePath(file.path);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueEntries.length === 0) {
    return { stdout: `sed: no files match '${globArgs.join(", ")}'`, exitCode: 1 };
  }

  const toWrite: { path: string; content: string }[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  const uniqueFiles = await fileSystem.readFiles(uniqueEntries.map((file) => file.path));
  for (const file of uniqueFiles) {
    let newContent = file.content;
    for (const replacement of replacements) {
      newContent = newContent.replace(replacement.regex, replacement.newStr);
    }
    const filePath = normalizePath(file.path);
    if (newContent !== file.content) {
      toWrite.push({ path: filePath, content: newContent });
      changed.push(filePath);
    } else {
      unchanged.push(filePath);
    }
  }

  if (toWrite.length > 0) {
    await fileSystem.writeFiles(toWrite);
  }

  return {
    stdout: `sed modified ${changed.length} ${plural(changed.length, "file")}, unchanged ${unchanged.length}`,
    exitCode: 0,
  };
}
