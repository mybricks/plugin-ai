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
 *   - activation  - 触发策略：auto | model | always | manual | disabled
 *   - disable-model-invocation - Claude 兼容字段；true 时等价于 activation: manual
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
  /**
   * @deprecated 临时兼容运行时动态 Skill 内容注入。后续应迁移到更明确的动态资源机制，
   * 避免在 Skill 对象上原地更新文件内容。
   */
  updateContent?: (context?: unknown) => void | Promise<void>;
}

// ─── 元信息解析 ───────────────────────────────────────────────────────────────

import { splitFrontmatter, getFrontmatterString } from "../utils/frontmatter";

/**
 * Skill 触发策略。
 *
 * 当前已实现：
 *   - auto   ：默认值；模型可根据 description / when_to_use 选择调用。
 *   - model  ：仅模型侧触发语义；当前运行时与 auto 一样进入模型候选，供后续 UI 区分是否可人工触发。
 *   - always ：默认打开；每轮请求直接注入 SKILL.md，不需要再调用 use_skill。
 *
 * 预留但当前未完整实现：
 *   - manual   ：只允许人类显式触发。当前包还没有 slash / picker 触发通道，因此只解析并从模型候选中移除。
 *   - disabled ：完全禁用。当前只解析并从模型候选、默认注入中移除。
 */
export type SkillActivation = "auto" | "model" | "always" | "manual" | "disabled";

function normalizeFrontmatterBoolean(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function resolveSkillActivation(fmText: string): SkillActivation {
  const rawActivation = getFrontmatterString(fmText, "activation")?.trim().toLowerCase();
  if (
    rawActivation === "auto" ||
    rawActivation === "model" ||
    rawActivation === "always" ||
    rawActivation === "manual" ||
    rawActivation === "disabled"
  ) {
    return rawActivation;
  }

  const disableModelInvocation =
    normalizeFrontmatterBoolean(getFrontmatterString(fmText, "disable-model-invocation")) ??
    normalizeFrontmatterBoolean(getFrontmatterString(fmText, "disable_model_invocation"));
  if (disableModelInvocation === true) return "manual";

  return "auto";
}

export interface SkillMeta {
  name: string;
  description: string;
  whenToUse: string | null;
  activation: SkillActivation;
}

/**
 * 解析 SkillFile 的展示元信息（name、description、whenToUse、activation）。
 *
 * 从 SKILL.md 文件中提取元信息，回退链对标 claude-code：
 *   - name        ：frontmatter.name → SkillFile.name
 *   - description ：frontmatter.description → frontmatter.name → 第一个 # 标题 → SkillFile.name
 *   - whenToUse   ：frontmatter.when_to_use 或 frontmatter.whenToUse
 *   - activation  ：frontmatter.activation → Claude disable-model-invocation 兼容 → auto
 *
 * @param skillMdContent  SKILL.md 的完整内容
 * @param fallbackName    回退名称（SkillFile.name）
 */
export function resolveSkillMeta(
  skillMdContent: string,
  fallbackName: string,
): SkillMeta {
  const { fmText } = splitFrontmatter(skillMdContent);
  const fmName = getFrontmatterString(fmText, "name");
  const fmDescription = getFrontmatterString(fmText, "description");
  const fmWhenToUse =
    getFrontmatterString(fmText, "when_to_use") ??
    getFrontmatterString(fmText, "whenToUse");
  const activation = resolveSkillActivation(fmText);

  const name = fmName ?? fallbackName;

  const description =
    fmDescription ??
    fmName ??
    skillMdContent.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    fallbackName;

  return { name, description, whenToUse: fmWhenToUse, activation };
}

export function shouldExposeSkillToModel(skill: SkillFile): boolean {
  const skillMd = skill.files.find((f) => f.path === "SKILL.md");
  if (!skillMd) return true;
  const { activation } = resolveSkillMeta(skillMd.content, skill.name);
  return activation === "auto" || activation === "model";
}

export function shouldAlwaysLoadSkill(skill: SkillFile): boolean {
  const skillMd = skill.files.find((f) => f.path === "SKILL.md");
  if (!skillMd) return false;
  const { activation } = resolveSkillMeta(skillMd.content, skill.name);
  return activation === "always";
}

export async function renderSkillContent(skill: SkillFile): Promise<{
  output: string;
  hasSupportFiles: boolean;
}> {
  await skill.updateContent?.();

  const skillMd = skill.files.find((f) => f.path === "SKILL.md");
  if (!skillMd) {
    throw new Error(`SKILL.md not found in skill "${skill.name}". This skill is misconfigured.`);
  }

  let output = `<skill name="${skill.name}">
${skillMd.content}
</skill>`;

  const supportFiles = skill.files.filter((f) => f.path !== "SKILL.md");
  if (supportFiles.length > 0) {
    output += `\n\n---\n\nSkill directory tree:\n.agent/skills/${skill.name}/`;
    for (const f of skill.files) {
      output += `\n  ${f.path}`;
    }
    output += `\n\nSupport files can be read using the read_file tool with paths like .agent/skills/${skill.name}/<path>`;
  }

  return { output, hasSupportFiles: supportFiles.length > 0 };
}
