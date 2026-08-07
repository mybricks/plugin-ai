import {
  BASH_TOOL_NAME,
  READ_TOOL_NAME,
  type AgentOptions,
  type CodeAgentBuiltinToolName,
  type CodeAgentOptions,
  type CodeAgentPromptOptions,
  type Tool,
} from "../../../../agent/src";

export interface CopilotAppPromptBuilderOptions {
  name: string;
  soulMd?: string;
  agentsMd?: string;
  builtInToolsMd?: string;
}

export interface CopilotAppPromptBuilderResult {
  promptOptions: CodeAgentPromptOptions;
}

export interface BusinessSkillCard {
  name?: string;
  title?: string;
  description?: string;
  md?: string;
  config?: unknown;
  props?: unknown;
  apis?: Array<{
    name?: string;
    description?: string;
  }>;
}

export interface BusinessSkill {
  name?: string;
  title?: string;
  description?: string;
  md?: string;
  cards?: BusinessSkillCard[];
  tools?: Tool[];
}

export interface CopilotAgentOptionBuilderOptions extends CodeAgentOptions {
  businessSkills?: BusinessSkill[];
}

export type CopilotAgentOptionBuilderResult = CodeAgentOptions;

function joinSections(sections: Array<string | undefined>): string {
  return sections.map((section) => section?.trim()).filter(Boolean).join("\n\n");
}

function createIdentitySection(name: string, soulMd?: string, agentsMd?: string): string {
  const resolvedSoulMd = soulMd?.trim() || `你是一个 ${name}，可以通过下方说明和可用的工具，协助用户达成完成任务，达成目的。`;

  return `你是一个个人助手，可以通过下方说明和可用的工具，协助用户达成完成任务，达成目的。

# SOUL定义 - 你是谁
${resolvedSoulMd}

## 行为准则
**真正有帮助，而不是表演式有帮助。** 跳过“好问题！”和“我很乐意帮忙！” - 直接帮忙。
**先想办法，再提问。** 读文件，查上下文，搜索，带着答案回来，而不是只带着问题回来。
**用能力赢得信任。** 对带副作用的动作要谨慎（邮件、操作、任何带副作用的内容），对内部集成的能力要大胆（读取、整理、学习）。

## 边界
- 拿不准时，在对外行动前先问。
- 永远不要发送半成品回复，不要轻易进行断言。

## 语气
该简洁时简洁，该深入时深入。不是企业话术机器人。不是应声虫。

## 输出格式
你的输出内容将显示在聊天界面中，该聊天界面支持渲染 Markdown 格式内容。
${agentsMd?.trim() ? `\n${agentsMd.trim()}\n` : ""}`;
}

function createUsingToolsSection(builtInToolsMd?: string): string {
  return `# 工具使用

## 调用原则
你需要按照 **先检索、后执行** 的方式来调用工具完成任务，避免基于假设直接回答问题或者完成任务。

1. **检索**：先用检索/查询工具获取事实（文档、搜索、接口、知识库、工具、历史上下文），不要基于记忆或猜测作答；
2. **执行**：根据用户的需求，决定回答用户问题、使用 \`render_canvas\` 展示 UI 画布、或者执行一些带副作用的操作。

## UI 画布相关工具
- render_canvas：用于在聊天界面中给用户展示对应功能或信息的 UI 画布。展示出来的 UI 画布是**有状态的**，画布对外提供 API 供 \`call_canvas_component_api\` 调用，以获取画布内部状态、数据信息。
- call_canvas_component_api：用于查询已经展示出来的 UI 画布的内部状态或数据，不要对 UI展示内容 进行重复说明，用户是可以看见的。

> UI 画布只是在对话中辅助进行展示，不要把 UI 画布 作为检索工具，如果UI画布返回的信息不足时，禁止直接断定信息不足，而是先通过各类检索手段确认清楚，再下结论。
IMPORTANT：绝对禁止为了获取已有 UI 画布的数据而重新渲染一个新的 UI 画布，应使用 \`call_canvas_component_api\` 查询 UI 画布数据。

${builtInToolsMd?.trim() ? `\n${builtInToolsMd.trim()}\n` : ""}`;
}

function formatJsonLike(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildBusinessCardsSection(cards: BusinessSkillCard[] | undefined): string {
  if (!cards?.length) return "";

  const cardLines = cards.map((card) => {
    const summary = [
      card.name ? `name: \`${card.name}\`` : undefined,
      card.title ? `title: ${card.title}` : undefined,
      card.description ? `desc: ${card.description}` : undefined,
    ].filter(Boolean).join("  ");
    const lines = summary ? [`- ${summary}`] : [];
    const config = formatJsonLike(card.config ?? card.props);
    if (config) lines.push(`  - config: ${config}`);
    if (card.md?.trim()) lines.push(`  - md: ${card.md.trim()}`);
    if (card.apis?.length) {
      const apis = card.apis
        .map((api) => `    - ${api.name ?? ""}: ${api.description ?? ""}`)
        .join("\n");
      lines.push(`  - apis:\n${apis}`);
    }
    return lines.join("\n");
  }).filter(Boolean);

  if (!cardLines.length) return "";

  return `## 可用卡片\n${cardLines.join("\n")}`;
}

function buildBusinessContextSection(businessSkills: BusinessSkill[] | undefined): string {
  if (!businessSkills?.length) return "";

  const skillBlocks = businessSkills.map((skill) => {
    const heading = skill.title ?? skill.name;
    const metadata = [
      skill.name ? `name: ${skill.name}` : undefined,
      skill.title ? `title: ${skill.title}` : undefined,
      skill.description ? `description: ${skill.description}` : undefined,
    ].filter(Boolean).join("\n");

    return joinSections([
      heading ? `# ${heading}` : undefined,
      metadata,
      skill.md?.trim(),
      buildBusinessCardsSection(skill.cards),
    ]);
  }).filter(Boolean);

  if (!skillBlocks.length) return "";

  return `<business_context>\n以下是当前可用的各类能力指导。\n\n${skillBlocks.join("\n\n---\n\n")}\n</business_context>`;
}

function collectBusinessTools(businessSkills: BusinessSkill[] | undefined): Tool[] {
  return businessSkills?.flatMap((skill) => skill.tools ?? []) ?? [];
}

export function copilotAppPromptBuilder(options: CopilotAppPromptBuilderOptions): CopilotAppPromptBuilderResult {
  const { name, soulMd, agentsMd, builtInToolsMd } = options;

  return {
    promptOptions: {
      identitySection: createIdentitySection(name, soulMd, agentsMd),
      usingToolsSection: createUsingToolsSection(builtInToolsMd),
    },
  };
}

export function copilotAgentOptionBuilder(options: CopilotAgentOptionBuilderOptions): CopilotAgentOptionBuilderResult {
  const {
    businessSkills,
    tools,
    disabledModes,
    builtinTools,
    getAttachmentContextMessages,
    ...restOptions
  } = options;
  const businessTools = collectBusinessTools(businessSkills);
  const defaultDisabledModes: AgentOptions["disabledModes"] = ["plan"];
  const defaultBuiltinTools: CodeAgentBuiltinToolName[] = [READ_TOOL_NAME, BASH_TOOL_NAME];

  return {
    ...restOptions,
    disabledModes: disabledModes ?? defaultDisabledModes,
    builtinTools: builtinTools ?? defaultBuiltinTools,
    tools: [...businessTools, ...(tools ?? [])],
    getAttachmentContextMessages: async (ctx) => {
      const sections: string[] = [];
      const businessContext = buildBusinessContextSection(businessSkills);
      if (businessContext) sections.push(businessContext);
      const extra = await getAttachmentContextMessages?.(ctx);
      if (extra?.length) sections.push(...extra);
      return sections;
    },
  };
}
