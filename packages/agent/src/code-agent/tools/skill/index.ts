import type { Tool, ToolResult } from "../../../types";
import { ToolValidationError } from "../../../types";
import type { SkillFile } from "../../skills";
import { resolveSkillMeta } from "../../skills";

/** 与 `createSkillTool` 注册的 `name` 一致，供 UI 等侧注册渲染器使用 */
export const USE_SKILL_TOOL_NAME = "use_skill";

// ─── createSkillTool ──────────────────────────────────────────────────────────

/**
 * 创建 `use_skill` 工具。
 *
 * LLM 通过此工具调用指定技能，获取 SKILL.md 完整内容及技能目录结构。
 * 对标 claude-code 的 SkillTool（use_skill），最小实现：
 *   - 按 skill name 查找对应 SkillFile
 *   - 返回 SKILL.md 内容 + 元信息 + 目录树（如有支持文件）
 *
 * @param skills  技能文件列表（在 CodeAgent 构造函数中传入）
 */
export function createSkillTool(skills: SkillFile[]): Tool {
  const skillNames = skills.map((s) => s.name);

  return {
    name: USE_SKILL_TOOL_NAME,
    description: `调用指定 Skill，获取 Skill 的完整指导内容。

当用户消息涉及 Skill 相关场景时，看下是否有合适的 Skill 可以使用。Skill 提供专业能力和领域知识，应使用此工具加载 Skill 获取完整内容。

用法：
- 传入 skill name 调用指定 Skill
- 返回内容包括：SKILL.md 完整内容（由 <skill> 标签包裹）、目录树（如有可读取的文件）
- 可读取的文件可通过 read_file 工具读取（路径格式：.agent/skills/<name>/<path>）`,
    parameters: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          enum: skillNames,
          description: "要调用的技能名称",
        },
      },
      required: ["skill"],
    },
    validate(params: { skill?: string }) {
      if (!params.skill || typeof params.skill !== "string" || !params.skill.trim()) {
        throw new ToolValidationError("skill is required and must be a non-empty string");
      }
      if (!skillNames.includes(params.skill)) {
        throw new ToolValidationError(
          `Skill not found: ${params.skill}. Available skills: ${skillNames.join(", ")}`,
        );
      }
    },
    async execute(params: { skill: string }): Promise<ToolResult> {
      const skill = skills.find((s) => s.name === params.skill);
      if (!skill) {
        throw new ToolValidationError(`Skill not found: ${params.skill}. Available skills: ${skillNames.join(", ")}`);
      }

      const skillMd = skill.files.find((f) => f.path === "SKILL.md");
      if (!skillMd) {
        throw new ToolValidationError(`SKILL.md not found in skill "${skill.name}". This skill is misconfigured.`);
      }

      // ── 构造输出：<skill> 标签包裹 SKILL.md 内容 ───────────────────────────
      let output = `<skill name="${skill.name}">
${skillMd.content}
</skill>`;

      // ── 目录树（如有可读取的文件）───────────────────────────────────────────────
      const supportFiles = skill.files.filter((f) => f.path !== "SKILL.md");
      if (supportFiles.length > 0) {
        output += `\n\n---\n\nSkill directory tree:\n.agent/skills/${skill.name}/`;
        for (const f of skill.files) {
          output += `\n  ${f.path}`;
        }
        output += `\n\nSupport files can be read using the read_file tool with paths like .agent/skills/${skill.name}/<path>`;
      }

      return {
        output,
        metadata: {
          skillName: skill.name,
          skillPath: `.agent/skills/${skill.name}/`,
          hasSupportFiles: supportFiles.length > 0,
        },
      };
    },
  };
}