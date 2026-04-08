// ─── SkillFile ────────────────────────────────────────────────────────────────

/**
 * 单个技能文件描述。
 *
 * 对标 claude-code 的 `.claude/skills/skill-name/SKILL.md` 结构：
 *   - `path`    ：虚拟文件路径（如 "react/component/SKILL.md"），
 *                 内部会挂载到 `.skills/` 命名空间下。
 *   - `content` ：SKILL.md 完整内容，可包含 YAML frontmatter。
 *                 frontmatter 支持的字段（对标 claude-code FrontmatterData）：
 *                   name        - 展示名称（displayName）
 *                   description - 一句话描述
 *                   when_to_use - 触发场景（可选）
 *
 * description 解析回退链：
 *   1. frontmatter.description
 *   2. frontmatter.name
 *   3. 正文第一个 # 标题行
 *   4. 最终降级为 path
 *
 * @example
 * {
 *   path: "react/component/SKILL.md",
 *   content: `---
 * name: React 组件规范
 * description: React 组件开发规范
 * when_to_use: 开发或修改 React 组件时使用
 * ---
 * # React 组件规范
 * ...`
 * }
 */
export interface SkillFile {
  /** 虚拟路径，建议以 SKILL.md 结尾，对标 claude-code skill 目录结构 */
  path: string;
  /** SKILL.md 完整内容（支持 YAML frontmatter） */
  content: string;
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
 * 回退链（对标 claude-code loadSkillsDir.ts 的 parseSkillFrontmatterFields）：
 *   - name        ：frontmatter.name → path（去掉 /SKILL.md 后缀）
 *   - description ：frontmatter.description → frontmatter.name → 第一个 # 标题 → path
 *   - whenToUse   ：frontmatter.when_to_use 或 frontmatter.whenToUse（均可）
 */
export function resolveSkillMeta(skill: SkillFile): {
  name: string;
  description: string;
  whenToUse: string | null;
} {
  const fmName = parseFrontmatterField(skill.content, "name");
  const fmDescription = parseFrontmatterField(skill.content, "description");
  const fmWhenToUse =
    parseFrontmatterField(skill.content, "when_to_use") ??
    parseFrontmatterField(skill.content, "whenToUse");

  const name =
    fmName ??
    skill.path.replace(/\/SKILL\.md$/i, "").replace(/\.md$/i, "");

  const description =
    fmDescription ??
    fmName ??
    skill.content.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    skill.path;

  return { name, description, whenToUse: fmWhenToUse };
}
