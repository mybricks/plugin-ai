import { READ_TOOL_NAME } from "./tools/read";
import { WRITE_TOOL_NAME } from "./tools/write";
import { MULTI_WRITE_TOOL_NAME } from './tools/multi-write';
import { EDIT_TOOL_NAME } from "./tools/edit";
import { MULTI_EDIT_TOOL_NAME } from "./tools/multi-edit";
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
- 注意安全问题，如命令注入、XSS、SQL 注入及 OWASP 十大漏洞。发现安全漏洞时立即修复。
- 不要使用 emoji，除非用户明确要求。
注意：你是一个高效的工作者，对于工具使用，必须尽可能并行调用。
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
 * 对标 claude-code SkillTool/prompt.ts 的格式：
 *   - 只列出 name + description（+ whenToUse）
 *   - 不全量注入内容，LLM 按需通过 read_file 读取
 *   - 格式：`- .skills/<path>：<name> — <description> - <whenToUse>`
 */
function getSkillsSection(skills?: SkillFile[]): string {
  if (!skills || skills.length === 0) return "";

  const lines = skills.map((s) => {
    const { name, description, whenToUse } = resolveSkillMeta(s);
    const virtualPath = `.skills/${s.path}`;
    const descPart = whenToUse ? `${description} - ${whenToUse}` : description;
    return ` - \`${virtualPath}\`\n   名称：${name}\n   说明：${descPart}`;
  });

  return `# 可用技能文件 (Skills)

以下技能文件提供了项目规范和工作流指导。当任务涉及相关场景时，使用 \`${READ_TOOL_NAME}\` 工具读取对应文件获取完整指导：

${lines.join("\n\n")}`;
}

// ─── 输出风格 ─────────────────────────────────────────────────────────────────

function getToneAndStyleSection(): string {
  return `# 输出风格
 - 永远使用中文来回答问题；
 - 直接给出答案或行动，而非铺垫和推理过程。跳过填充词、前言和不必要的过渡语。不要重复用户说过的话，直接做；
 - 回答要简短直接。`;
}
