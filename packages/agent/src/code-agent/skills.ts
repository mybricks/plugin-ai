// ─── SkillFile ────────────────────────────────────────────────────────────────

/**
 * 单个技能描述。
 *
 * 对标 claude-code 的 `<skill-name>/SKILL.md` 目录结构：
 *   - `name`    ：技能名称，同时作为虚拟目录名 `.agent/skills/<name>/`
 *   - `files`   ：技能目录内的文件列表，SKILL.md 为必填项
 *
 * SKILL.md 支持的 YAML frontmatter 字段（对标 claude-code FrontmatterData）：
 *   - name        - 展示名称（displayName）
 *   - description - 一句话描述
 *   - when_to_use - 触发场景（可选）
 *
 * description 解析回退链：
 *   1. frontmatter.description
 *   2. frontmatter.name
 *   3. 正文第一个 # 标题行
 *   4. 最终降级为 SkillFile.name
 *
 * @example
 * {
 *   name: "commit",
 *   files: [
 *     { path: "SKILL.md", content: "---\nname: Git Commit\ndescription: Create a git commit\n---\n# Git Commit\n..." },
 *     { path: "scripts/set.js", content: "// helper script" },
 *   ]
 * }
 */
export interface SkillFile {
  /** 技能名称，作为虚拟目录名：.agent/skills/<name>/ */
  name: string;
  /** 技能目录内的文件列表。必须包含 path === "SKILL.md" 的条目 */
  files: Array<{
    /** 相对于技能目录的路径（如 "SKILL.md"、"scripts/set.js"） */
    path: string;
    /** 文件完整内容（SKILL.md 支持 YAML frontmatter） */
    content: string;
  }>;
}

// ─── 元信息解析 ───────────────────────────────────────────────────────────────

/**
 * 解析 SKILL.md YAML frontmatter，提取指定字段。
 * 仅做最小化解析（正则匹配），不引入 YAML 解析库依赖。
 */
function parseFrontmatterField(content: string, field: string): string | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fmText = fmMatch[1]!;
  const fieldMatch = fmText.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!fieldMatch) return null;
  return fieldMatch[1]!.trim().replace(/^["']|["']$/g, "");
}

/**
 * 解析 SkillFile 的展示元信息（name、description、whenToUse）。
 *
 * 从 SKILL.md 文件中提取元信息，回退链对标 claude-code：
 *   - name        ：frontmatter.name → SkillFile.name
 *   - description ：frontmatter.description → frontmatter.name → 第一个 # 标题 → SkillFile.name
 *   - whenToUse   ：frontmatter.when_to_use 或 frontmatter.whenToUse
 *
 * @param skillMdContent  SKILL.md 的完整内容
 * @param fallbackName    回退名称（SkillFile.name）
 */
export function resolveSkillMeta(
  skillMdContent: string,
  fallbackName: string,
): {
  name: string;
  description: string;
  whenToUse: string | null;
} {
  const fmName = parseFrontmatterField(skillMdContent, "name");
  const fmDescription = parseFrontmatterField(skillMdContent, "description");
  const fmWhenToUse =
    parseFrontmatterField(skillMdContent, "when_to_use") ??
    parseFrontmatterField(skillMdContent, "whenToUse");

  const name = fmName ?? fallbackName;

  const description =
    fmDescription ??
    fmName ??
    skillMdContent.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    fallbackName;

  return { name, description, whenToUse: fmWhenToUse };
}