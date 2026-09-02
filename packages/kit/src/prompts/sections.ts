import type { PromptSections } from "./index";
import { resolveDefaultPromptSections } from "../internal/resolve";

export interface DevelopmentGuideLibrary {
  name: string;
  version?: string;
  usage: string;
}

export interface BuildDevelopmentGuideContextOptions {
  promptSections?: PromptSections;
  codeRules?: string;
  designRules?: string;
  libraries?: DevelopmentGuideLibrary[];
}

export interface ProjectInfoFile {
  path: string;
  content: string;
}

export interface BuildProjectInfoSectionOptions {
  /**
   * Directories hidden from the project snapshot and empty-project check.
   * This affects prompt presentation only; it never changes sandbox files.
   */
  ignoredDirectories?: readonly string[];
}

const DEFAULT_PROJECT_INFO_IGNORED_DIRECTORIES = [".agent", ".lingchuang"] as const;

function wrapRules(tag: string, value?: string): string {
  const content = value?.trim();
  return content ? `\n<${tag}>\n${content}\n</${tag}>\n` : "";
}

function formatLibraryDocs(libraries: DevelopmentGuideLibrary[]): string {
  return libraries
    .map((library) => `---\nname: ${library.name}\nversion: ${library.version ?? ""}\n---\n${library.usage}`)
    .join("\n\n");
}

function normalizePath(path: string): string {
  return path.replace(/^\/+/, "");
}

function isInIgnoredDirectory(path: string, ignoredDirectories: readonly string[]): boolean {
  const ignored = new Set(ignoredDirectories.map((directory) => directory.replace(/^\/+|\/+$/g, "")));
  return normalizePath(path).split("/").some((segment) => ignored.has(segment));
}

function summarizeFiles(files: ProjectInfoFile[]): string {
  const suffixMap: Record<string, number> = {};
  for (const file of files) {
    const dotIndex = file.path.lastIndexOf(".");
    const extension = dotIndex === -1 ? "(无后缀)" : file.path.slice(dotIndex);
    suffixMap[extension] = (suffixMap[extension] ?? 0) + 1;
  }
  return Object.entries(suffixMap)
    .map(([extension, count]) => `${count} 个 ${extension}`)
    .join("、");
}

/**
 * 构建主工程文件清单。
 *
 * 给线上版本用。默认隐藏 `.agent` / `.lingchuang`：线上 Agent 暂时不需要理解
 * `.lingchuang` 文件夹，内部规则也不应刷进全量文件列表。这是故意的，与
 * `buildDirectoryInfoSection` 不隐藏目录名的行为不同。
 */
export function buildProjectInfoSection(
  files: ProjectInfoFile[],
  options: BuildProjectInfoSectionOptions = {},
): string {
  const ignoredDirectories = options.ignoredDirectories ?? DEFAULT_PROJECT_INFO_IGNORED_DIRECTORIES;
  const projectFiles = files.filter((file) => !isInIgnoredDirectory(file.path, ignoredDirectories));
  const sections = ["这是发送这条消息时的项目空间快照，并不会实时更新。", "# 项目空间"];

  if (projectFiles.length === 0) {
    sections.push([
      "## 项目工程",
      "权限：读取、写入",
      "当前没有任何代码文件。可以使用类似 `index.tsx` 的路径来操作文件。建议使用初始化来同时生成多份文件。",
    ].join("\n"));
  } else {
    const fileList = projectFiles.map((file) => `- ${normalizePath(file.path)} (${file.content.split("\n").length} lines)`).join("\n");
    sections.push([
      "## 项目工程",
      "权限：读取、写入",
      `总计：${projectFiles.length} 个文件（${summarizeFiles(projectFiles)}）`,
      "文件：",
      fileList,
    ].join("\n"));
  }

  return `<project-info>\n${sections.join("\n\n")}\n</project-info>`;
}

/**
 * 构建目录级快照；不递归也不读取文件内容。
 *
 * 给可进入真实目录树的场景用。故意不隐藏 `.agent` / `.lingchuang`：只展示
 * 当前目录的一层名字，模型需要看见这些目录才能决定要不要进去。线上全量
 * 文件快照的隐藏由 `buildProjectInfoSection` 负责。
 */
export function buildDirectoryInfoSection(options: { workingDirectory?: string; entries: string[] }): string {
  const entries = options.entries.length ? options.entries.join("\n") : "（空目录）";
  return `<project-info>\n当前工作目录：${options.workingDirectory ?? "."}\n \n 命令行默认在此目录下执行，无需进入目录。 \n \n根目录树\n${entries}\n</project-info>`;
}

export function buildDevelopmentGuideContext(options: BuildDevelopmentGuideContextOptions): string | null {
  const { codeRules, designRules, libraries = [] } = options;
  const resolved = resolveDefaultPromptSections(options.promptSections);
  const developeGuide = resolved.developeGuide;

  if (!developeGuide.firstOfAll?.trim()) return null;

  const designGuide = resolved.designGuide;
  const documentGuide = resolved.documentGuide;

  const codeRulesSection = wrapRules("code_rules", codeRules);
  const designRulesSection = wrapRules("design_rules", designRules);

  const bestPracticesContent = [
    codeRulesSection ? "#### 代码规范：\n" + codeRulesSection : undefined,
    developeGuide.assetsUsageSection ? "#### 图片和图标使用：\n" + developeGuide.assetsUsageSection : undefined,
    developeGuide.examplesSection ? "#### 开发示例：\n" + developeGuide.examplesSection : undefined,
  ].filter(Boolean).join("\n");

  const documentGuideContent = [
    documentGuide.firstOfAll,
    documentGuide.requirementGuide,
  ].filter(Boolean).join("\n\n");

  const libraryDocsContent = formatLibraryDocs(libraries);

  return [
    "\n# 前端开发指南\n",
    developeGuide.firstOfAll,
    "\n## 项目架构\n",
    developeGuide.architectureSection ?? "",
    "\n## 环境变量\n",
    developeGuide.environmentVariablesSection ?? "",
    "\n## 最佳实践\n",
    bestPracticesContent,
    developeGuide.end,
    "\n## 设计规范\n",
    [designGuide.firstOfAll, designRulesSection].filter(Boolean).join("\n"),
    ...(documentGuideContent ? [
      "\n## 文档规范\n",
      "<文档规范>\n",
      documentGuideContent,
      "\n</文档规范>\n",
    ] : []),
    "\n## 允许使用的类库\n",
    "\n---\n\n",
    libraryDocsContent,
  ].join("");
}
