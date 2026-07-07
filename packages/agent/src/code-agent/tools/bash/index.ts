import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { Sandbox } from "../../index";
import { MULTI_EDIT_TOOL_NAME } from './../multi-edit'

export const BASH_TOOL_NAME = "bash";

// ─── 类型 ─────────────────────────────────────────────────────────────────────

interface CommandResult {
  stdout: string;
  exitCode: number;
}

function formatCommandOutput(result: CommandResult): string {
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
function tokenize(cmd: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < cmd.length) {
    // 跳过空白
    while (i < cmd.length && /\s/.test(cmd[i])) i++;
    if (i >= cmd.length) break;

    const ch = cmd[i];
    if (ch === "'" || ch === '"') {
      // 引号内容
      const q = ch;
      i++;
      let tok = "";
      while (i < cmd.length && cmd[i] !== q) {
        tok += cmd[i++];
      }
      if (cmd[i] === q) i++; // 跳过结束引号
      tokens.push(tok);
    } else {
      // 普通 token，遇到空白结束
      let tok = "";
      while (i < cmd.length && !/\s/.test(cmd[i])) {
        tok += cmd[i++];
      }
      tokens.push(tok);
    }
  }
  return tokens;
}

// ─── 命令实现 ──────────────────────────────────────────────────────────────────

async function execMv(args: string[], adapter: Sandbox): Promise<CommandResult> {
  // mv [-f] <src...> <dst>
  const filtered = args.filter((a) => !a.startsWith("-"));
  if (filtered.length < 2) {
    return { stdout: "mv: missing operand\nUsage: mv <source> <dest>  or  mv <source...> <dest-dir/>", exitCode: 1 };
  }

  const dst = normalizePath(filtered[filtered.length - 1]);
  const srcs = filtered.slice(0, -1).map(normalizePath);

  const allFiles = await adapter.getFiles();
  const fileMap = new Map(allFiles.map((f) => [normalizePath(f.path), f]));
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

  for (const entry of resolvedSrcs) {
    const src = entry.path;
    const file = fileMap.get(src)!;
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

  await adapter.updateFiles(toWrite);
  await adapter.deleteFiles(toDelete);

  return {
    stdout: formatChangeSummary("moved", renames, "file"),
    exitCode: 0,
  };
}

async function execCp(args: string[], adapter: Sandbox): Promise<CommandResult> {
  // cp [-r] <src> <dst>  or  cp <src...> <dst-dir/>
  const flags = args.filter((a) => a.startsWith("-"));
  const recursive = flags.some((f) => f.includes("r") || f.includes("R"));
  const filtered = args.filter((a) => !a.startsWith("-"));
  if (filtered.length < 2) {
    return { stdout: "cp: missing operand\nUsage: cp [-r] <source> <dest>  or  cp <source...> <dest-dir/>", exitCode: 1 };
  }

  const dst = normalizePath(filtered[filtered.length - 1]);
  const srcs = filtered.slice(0, -1).map(normalizePath);

  const allFiles = await adapter.getFiles();
  const fileMap = new Map(allFiles.map((f) => [normalizePath(f.path), f]));
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

  for (const entry of resolvedSrcs) {
    const src = entry.path;
    const file = fileMap.get(src)!;
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

  await adapter.updateFiles(toWrite);

  return {
    stdout: formatChangeSummary("copied", copies, "file"),
    exitCode: 0,
  };
}

async function execRm(args: string[], adapter: Sandbox): Promise<CommandResult> {
  // rm [-r|-rf|-f] <path...>  (虚拟 FS 中目录即是文件前缀，-r 支持删整个子树)
  const flags = args.filter((a) => a.startsWith("-"));
  const paths = args.filter((a) => !a.startsWith("-")).map(normalizePath);
  const recursive = flags.some((f) => f.includes("r") || f.includes("R"));
  const force = flags.some((f) => f.includes("f"));

  if (paths.length === 0) {
    return { stdout: "rm: missing operand", exitCode: 1 };
  }

  const allFiles = await adapter.getFiles();
  const allPaths = allFiles.map((f) => normalizePath(f.path));

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
    await adapter.deleteFiles(unique);
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
async function execRename(args: string[], adapter: Sandbox): Promise<CommandResult> {
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

  const allFiles = await adapter.getFiles();
  const matched = allFiles.filter((f) => matchGlob(globPattern, normalizePath(f.path)));

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

  await adapter.updateFiles(toWrite);
  await adapter.deleteFiles(toDelete);

  return {
    stdout: formatChangeSummary("renamed", renames, "path"),
    exitCode: 0,
  };
}

async function execTouch(args: string[], adapter: Sandbox): Promise<CommandResult> {
  const paths = args.filter((a) => !a.startsWith("-")).map(normalizePath);
  if (paths.length === 0) {
    return { stdout: "touch: missing operand", exitCode: 1 };
  }

  const allFiles = await adapter.getFiles();
  const existingSet = new Set(allFiles.map((f) => normalizePath(f.path)));

  // 只创建不存在的文件
  const toCreate = paths.filter((p) => !existingSet.has(p));
  if (toCreate.length > 0) {
    await adapter.updateFiles(toCreate.map((p) => ({ path: p, content: "" })));
  }

  return {
    stdout: `touched ${paths.length} ${plural(paths.length, "file")} (created ${toCreate.length}, unchanged ${paths.length - toCreate.length})`,
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
async function execSed(args: string[], adapter: Sandbox): Promise<CommandResult> {
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

  const allFiles = await adapter.getFiles();

  const matchedFiles: typeof allFiles = [];
  for (const pattern of globArgs) {
    matchedFiles.push(...allFiles.filter((f) => matchGlob(pattern, normalizePath(f.path))));
  }

  // 去重
  const seen = new Set<string>();
  const uniqueFiles = matchedFiles.filter((f) => {
    const k = normalizePath(f.path);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (uniqueFiles.length === 0) {
    return { stdout: `sed: no files match '${globArgs.join(", ")}'`, exitCode: 1 };
  }

  const toWrite: { path: string; content: string }[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

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
    await adapter.updateFiles(toWrite);
  }

  return {
    stdout: `sed modified ${changed.length} ${plural(changed.length, "file")}, unchanged ${unchanged.length}`,
    exitCode: 0,
  };
}

// ─── 路由器 ───────────────────────────────────────────────────────────────────

async function dispatchCommand(
  cmd: string,
  adapter: Sandbox
): Promise<CommandResult> {
  const tokens = tokenize(cmd.trim());
  if (tokens.length === 0) {
    return { stdout: "bash: empty command", exitCode: 1 };
  }

  const [command, ...args] = tokens;

  switch (command) {
    case "mv":
      return execMv(args, adapter);
    case "cp":
      return execCp(args, adapter);
    case "rm":
      return execRm(args, adapter);
    case "rename":
      return execRename(args, adapter);
    case "mkdir":
      return {
        stdout: "mkdir: command not supported in virtual filesystem\nThe virtual filesystem has no empty directories; create files directly with paths like src/hooks/useThing.ts.",
        exitCode: 1,
      };
    case "touch":
      return execTouch(args, adapter);
    case "sed":
      return execSed(args, adapter);
    default:
      return {
        stdout: `bash: '${command}': command not supported in sandbox environment\nThe sandbox only supports virtual filesystem operations. Supported commands: mv, cp, rm, rename, touch, sed`,
        exitCode: 1,
      };
  }
}

// ─── Tool 工厂 ────────────────────────────────────────────────────────────────

export function createBashTool(adapter: Sandbox): Tool {
  return {
    name: BASH_TOOL_NAME,
    description: `在虚拟文件系统中执行文件管理命令，用于重构、批量操作文件。

支持的命令：
- \`mv <src> <dst>\` — 移动/重命名文件或目录前缀。dst 以 / 结尾或已有文件以 dst/ 为前缀时视为目标目录。支持 glob 批量移动。
- \`cp <src> <dst>\` — 复制文件。dst 以 / 结尾时视为目标目录。支持 glob 批量复制；\`cp -r <dir> <dst>\` 按路径前缀递归复制已有文件，支持多源目录，目标是否为已存在目录取决于是否已有文件以 \`<dst>/\` 为前缀。
- \`rm <path>\` — 删除文件。支持 glob 批量删除；\`rm -r <dir>\` 递归删除目录下所有文件；\`-f\` 忽略不存在。
- \`rename 's/old/new/' <glob>\` — 批量按正则替换路径中的片段，也支持 \`rename <old> <new> <glob>\`。
- \`touch <path>\` — 创建空文件。
- \`sed -i 's/old/new/g' <glob>\` — 批量替换文件内容中的文本，支持正则，支持 g（全局）、i（大小写不敏感）标志，支持多个 \`-e\` 表达式；仅在变量替换，字符替换等需要多文件替换场景下使用，否则还是${MULTI_EDIT_TOOL_NAME}更快速。

注意：
- 这是沙箱虚拟文件系统环境，不支持 cd、ls、cat、echo、git 等真实 shell 命令，只支持上述文件管理操作。
- 虚拟文件系统没有空目录概念，不需要先 mkdir；直接创建或移动到目标文件路径即可。
- 路径以项目根目录为基准，如 src/components/Button.tsx。`,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "要执行的命令，如 mv src/old.ts src/new.ts 或 sed -i 's/OldName/NewName/g' src/**/*.tsx",
        },
        description: {
          type: "string",
          description: "简短一句话，本次命令的用途说明",
        },
      },
      required: ["command"],
    },
    validate(params: { command?: string; description?: string }) {
      if (!params.command || typeof params.command !== "string" || !params.command.trim()) {
        throw new ToolValidationError("command is required and must be a non-empty string");
      }
    },
    async execute(params: { command: string; description?: string }): Promise<ToolResult> {
      const result = await dispatchCommand(params.command, adapter);
      return {
        output: formatCommandOutput(result),
        metadata: {
          command: params.command,
          description: params.description,
          stdout: result.stdout,
          exitCode: result.exitCode,
        },
      };
    },
  };
}
