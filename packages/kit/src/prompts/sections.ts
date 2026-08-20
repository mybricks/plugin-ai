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

export interface AgentMdFrontmatter {
  title?: string;
  description?: string;
  permissions?: string[];
  body: string;
}

export interface ExtraProjectInfo {
  path: string;
  files: ProjectInfoFile[];
}

export interface BuildExtraProjectInfoSectionOptions {
  directories: ExtraProjectInfo[];
  files: ProjectInfoFile[];
  globToolName: string;
}

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

/** 解析 .agent/agent.md 的 frontmatter 与正文。 */
export function parseAgentMdFrontmatter(content: string): AgentMdFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { body: content };
  const frontmatter = match[1] ?? "";
  const getValue = (key: string): string | undefined =>
    frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  const inlinePermissions = frontmatter.match(/^permissions:\s*\[([^\]]+)\]/m)?.[1];
  const commaSeparatedPermissions = frontmatter.match(/^permissions:\s*([^\[\n][^\n]*)$/m)?.[1];
  const permissionsValue = inlinePermissions ?? commaSeparatedPermissions;

  return {
    title: getValue("title"),
    description: getValue("description"),
    permissions: permissionsValue
      ? permissionsValue.split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : undefined,
    body: (match[2] ?? "").trimEnd(),
  };
}

/** 构建主工程文件清单；扩展工程信息需通过 buildExtraProjectInfoSection 单独追加。 */
export function buildProjectInfoSection(files: ProjectInfoFile[]): string {
  const sections = ["这是发送这条消息时的项目空间快照，并不会实时更新。", "# 项目空间"];

  if (files.length === 0) {
    sections.push([
      "## 项目工程",
      "权限：读取、写入",
      "当前没有任何代码文件。可以使用类似 `index.tsx` 的路径来操作文件。建议使用初始化来同时生成多份文件。",
    ].join("\n"));
  } else {
    const fileList = files.map((file) => `- ${normalizePath(file.path)} (${file.content.split("\n").length} lines)`).join("\n");
    sections.push([
      "## 项目工程",
      "权限：读取、写入",
      `总计：${files.length} 个文件（${summarizeFiles(files)}）`,
      "文件：",
      fileList,
    ].join("\n"));
  }

  return `<project-info>\n${sections.join("\n\n")}\n</project-info>`;
}

/** 构建扩展工程信息，不会自动包含在 project-info 中。 */
export function buildExtraProjectInfoSection(options: BuildExtraProjectInfoSectionOptions): string | null {
  const { directories, files, globToolName } = options;
  if (!directories.length) return null;

  const permissionLabels: Record<string, string> = { read: "读取", write: "写入", bash: "执行 bash 命令" };
  const sections = directories.map(({ path, files: directoryFiles }, index) => {
    const normalizedDirectoryPath = normalizePath(path).replace(/\/$/, "");
    const agentMd = files.find((file) => normalizePath(file.path) === `${normalizedDirectoryPath}/.agent/agent.md`);
    const metadata = agentMd ? parseAgentMdFrontmatter(agentMd.content) : undefined;
    const permissions = metadata?.permissions?.map((permission) => permissionLabels[permission] ?? permission) ?? [];
    const countDescription = directoryFiles.length === 0
      ? "当前没有任何代码文件。"
      : `总计：${directoryFiles.length} 个文件（${summarizeFiles(directoryFiles)}）。当前不展开文件列表，可使用 ${globToolName} 工具（如 \`${normalizedDirectoryPath}/**/*\`）查询文件列表，再按需读取具体文件。`;

    return [
      `工程${index + 1}「${metadata?.title ?? path}」，虚拟目录为\`${normalizedDirectoryPath}\``,
      metadata?.description ? `说明：${metadata.description}` : undefined,
      permissions.length ? `权限：${permissions.join("、")}` : undefined,
      countDescription,
      `可以使用类似 \`${normalizedDirectoryPath}/src/index.ts\` 的完整路径来读取或修改文件。`,
    ].filter(Boolean).join("\n");
  });

  return `<extra-project-info>\n## 扩展工程（${directories.length}个）\n${sections.join("\n\n")}\n</extra-project-info>`;
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
