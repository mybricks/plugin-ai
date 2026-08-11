import type { Tool, ToolExecutionContext, ToolResult } from "../../types";
import { ToolValidationError } from "../../types";

export const ASK_QUESTIONS_TOOL_NAME = "ask_questions";

export interface AskUserQuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface AskUserQuestion {
  question: string;
  header: string;
  options: AskUserQuestionOption[];
  multiSelect?: boolean;
}

export interface AskUserQuestionParams {
  questions: AskUserQuestion[];
}

export type AskUserQuestionAnswers = Record<string, string | string[]>;

function formatAnswers(answers: AskUserQuestionAnswers): string {
  return Object.entries(answers)
    .map(([question, answer]) => `- ${question}：${Array.isArray(answer) ? answer.join("、") : answer}`)
    .join("\n");
}

const DESCRIPTION = `在执行过程中向用户提出 1 至 4 个多选题，以澄清需求、收集偏好或让用户作出决策。

规则：
- 每次调用提 1 至 4 题，每题提供 2 至 4 个选项。
- 同一次调用中的问题文本和选项 label 必须全局唯一。
- 不要自行添加“其他”选项，UI 会自动提供。
- 如有推荐项，放在第一项，并在 label 末尾添加 (推荐)。
- multiSelect 为 true 时，问题措辞应使用可多选、非互斥的复数表达。
- header 是用于展示的短标签，最多 12 个字符。
- preview 为可选的纯文本预览内容，仅允许用于单选题。
- plan 模式下仅用于澄清需求或方案取舍，不能用于请求确认计划。`;

function validateParams(params: AskUserQuestionParams): void {
  if (!Array.isArray(params?.questions) || params.questions.length < 1 || params.questions.length > 4) {
    throw new ToolValidationError("questions 必须包含 1 至 4 个问题");
  }

  const questions = new Set<string>();
  const labels = new Set<string>();
  for (const item of params.questions) {
    if (!item || typeof item.question !== "string" || !item.question.trim()) {
      throw new ToolValidationError("每个问题都必须包含非空的 question 文本");
    }
    if (questions.has(item.question)) throw new ToolValidationError("问题文本必须唯一");
    questions.add(item.question);
    if (typeof item.header !== "string" || item.header.length > 12) {
      throw new ToolValidationError("每个 header 最多 12 个字符");
    }
    if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4) {
      throw new ToolValidationError("每个问题必须包含 2 至 4 个选项");
    }
    if (item.multiSelect && item.options.some((option) => option.preview !== undefined)) {
      throw new ToolValidationError("preview 仅支持单选题");
    }
    for (const option of item.options) {
      if (!option || typeof option.label !== "string" || !option.label.trim() || typeof option.description !== "string") {
        throw new ToolValidationError("每个选项都必须包含 label 和 description");
      }
      if (labels.has(option.label)) throw new ToolValidationError("所有问题的选项 label 必须全局唯一");
      labels.add(option.label);
    }
  }
}

/**
 * 创建可选的 AskUserQuestion 工具。调用方需为该工具注册 renderer；
 * 该工厂不会将工具加入任何默认列表。
 */
export function createAskUserQuestionTool(): Tool {
  return {
    name: ASK_QUESTIONS_TOOL_NAME,
    title: "询问用户",
    description: DESCRIPTION,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["questions"],
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          description: "在同一张交互卡片中向用户提出的 1 至 4 个问题。",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["question", "header", "options"],
            properties: {
              question: { type: "string", description: "清晰、具体并以问号结尾的问题文本。" },
              header: { type: "string", maxLength: 12, description: "用于展示的短标签。" },
              multiSelect: { type: "boolean", default: false, description: "是否允许选择多个非互斥选项。" },
              options: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "description"],
                  properties: {
                    label: { type: "string", description: "简洁的可见选项名称。" },
                    description: { type: "string", description: "该选项的含义、影响或取舍。" },
                    preview: { type: "string", description: "仅单选题可用的纯文本预览内容，不支持 Markdown 或 HTML。" },
                  },
                },
              },
            },
          },
        },
      },
    },
    validate: validateParams,
    async execute(params: AskUserQuestionParams, ctx?: ToolExecutionContext): Promise<ToolResult> {
      if (!ctx?.waitUIRender) {
        return { output: "错误：当前工具上下文不支持等待 UI 回传。" };
      }

      const answers = await ctx.waitUIRender<AskUserQuestionAnswers>();
      if (answers === null) {
        ctx.getAgent().abort();
        return { output: "用户未回答问题，当前对话已取消。" };
      }

      return {
        output: `用户已确认以下选择：\n${formatAnswers(answers)}`,
        metadata: { answers },
      };
    },
  };
}
