import { READ_TOOL_NAME } from "./tools/read";
import { WRITE_TOOL_NAME } from "./tools/write";
import { MULTI_WRITE_TOOL_NAME } from './tools/multi-write';
import { EDIT_TOOL_NAME } from "./tools/edit";
import { MULTI_EDIT_TOOL_NAME } from "./tools/multi-edit";
import { USE_SKILL_TOOL_NAME } from "./tools/skill";
import type { SkillFile } from "./skills";
import { resolveSkillMeta } from "./skills";

/**
 * 提示词。
 */
export interface CodeAgentPromptOptions {
  /** 覆盖默认的身份定位描述 */
  identitySection?: string;
  /** 覆盖默认的工具使用规范描述 */
  usingToolsSection?: string;
}

export function getCodeAgentSystemPrompt(opts?: CodeAgentPromptOptions, skills?: SkillFile[]): string {
  const sections = [
    getIdentitySection(opts?.identitySection),
    getDoingTasksSection(),
    getUsingToolsSection(opts?.usingToolsSection),
    getSkillsSection(skills),
    getToneAndStyleSection(),
  ].filter(Boolean);

  return sections.join("\n\n");
}

// ─── 身份定位 ─────────────────────────────────────────────────────────────────

const DEFAULT_IDENTITY = `你是一个专业的开发 AI 助手，帮助用户完成软件工程任务。使用下方说明和可用工具来协助用户。

你有能力帮用户完成复杂任务，包括修复 bug、开发新功能、重构代码、解释代码等。对于不清楚的指令，请结合当前项目上下文理解用户意图。

当您完成任务时，请回复一份简明的报告，涵盖已完成的工作和任何关键发现。`;

function getIdentitySection(identity?: string): string {
  return identity ?? DEFAULT_IDENTITY;
}

// ─── 工作原则 ─────────────────────────────────────────────────────────────────

function getDoingTasksSection(): string {
  return `# 工作原则
不要妄下断言，不要直接工作，不要掩饰困惑，坦诚地权衡利弊。
- 如果存在多种解释，请将它们提出来——不要默默地做出选择。
- 如果有什么不清楚的地方，停下来。说出让你困惑的地方。然后提问。
`;
}

// ─── 工具使用规范 ─────────────────────────────────────────────────────────────

function getUsingToolsSection(usingTools?: string): string {
  if (usingTools !== undefined) return usingTools;
  return `# 工具使用
 > 如果修改了用户的代码，在最后考虑是否需要更新副作用文件、查看各类LSP或者运行状态来做最后的检查确认。

 - 使用 \`${READ_TOOL_NAME}\` 读取项目文件，而非其他方式。
 - 使用 \`${EDIT_TOOL_NAME}\` 或 \`${MULTI_EDIT_TOOL_NAME}\` 修改已有文件。这是修改文件的首选工具，因为它只发送差异部分。
 - 使用 \`${WRITE_TOOL_NAME}\` 或 \`${MULTI_WRITE_TOOL_NAME}\` 新建文件，或在需要完整重写文件时使用。对已有文件优先使用 \`${EDIT_TOOL_NAME}\`。
 - 在一次响应中可以调用多个工具。如果多个工具之间没有依赖关系，并行调用它们以提高效率。如果某些工具调用依赖于前一个调用的结果，则按顺序调用。`;
}

// ─── 可用技能文件 ─────────────────────────────────────────────────────────────

/**
 * 生成 skills 目录节。
 *
 * 格式：每条 skill 结构化列出 name（SkillFile.name，作为索引 key）+ description + whenToUse。
 * 不全量注入内容，LLM 按需通过 use_skill 工具加载。
 */
function getSkillsSection(skills?: SkillFile[]): string {
  if (!skills || skills.length === 0) return "";

  const lines = skills.map((s) => {
    const skillMd = s.files.find((f) => f.path === "SKILL.md");
    if (!skillMd) {
      return `- name: ${s.name}`;
    }
    const { description, whenToUse } = resolveSkillMeta(skillMd.content, s.name);
    let line = `- name: ${s.name}\n  description: ${description}`;
    if (whenToUse) {
      line += `\n  when_to_use: ${whenToUse}`;
    }
    return line;
  });

  return `# 可用技能文件 (Skills)
以下是可用的技能列表。当任务涉及相关场景时，使用 \`${USE_SKILL_TOOL_NAME}\` 工具调用指定技能获取完整指导：

${lines.join("\n")}

重要：
- When a skill matches the user's request, this is a BLOCKING REQUIREMENT...
- NEVER mention a skill without actually calling this tool`;
}

// ─── 输出风格 ─────────────────────────────────────────────────────────────────

function getToneAndStyleSection(): string {
  return `# 输出风格
- 在调用工具之前，务必用一句简洁明了的句子告诉用户你要做什么。这有助于他们理解你的操作及其原因；
- 永远使用简体中文来告知、回答用户、输出总结；
- 禁止使用emoji、表情符号。`;
}


// function getToneAndStyleSection(): string {
//   return `# 输出风格
//  - 永远使用中文来回答问题；
//  - 直接给出答案或行动，而非铺垫和推理过程。跳过填充词、前言和不必要的过渡语。不要重复用户说过的话，直接做；
//  - 回答要简短直接；
//  - 禁止使用 Unicode 转义序列；
//  - 禁止使用emoji、表情符号。`;
// }
