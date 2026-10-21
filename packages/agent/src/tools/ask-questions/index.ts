import type { Tool, ToolExecutionContext, ToolResult } from "../../types";
import { ToolValidationError } from "../../types";

export const ASK_QUESTIONS_TOOL_NAME = "ask_questions";

export interface AskQuestionsOption {
  label: string;
  description?: string;
  preview?: string;
  /** 为该普通选项显示一项可选的补充说明输入框。 */
  input?: boolean;
  /** input 为 true 时的输入框提示文案；未提供时回退到 description。 */
  inputPlaceholder?: string;
}

export interface AskQuestionsQuestion {
  question: string;
  header: string;
  options: AskQuestionsOption[];
  multiSelect?: boolean;
}

export interface AskQuestionsParams {
  questions: AskQuestionsQuestion[];
}

export type AskQuestionsAnswers = Record<string, string | string[]>;

interface AskQuestionsSkip {
  skipped: true;
}

function isSkip(response: AskQuestionsAnswers | AskQuestionsSkip): response is AskQuestionsSkip {
  return "skipped" in response && response.skipped === true;
}

function formatAnswers(answers: AskQuestionsAnswers): string {
  return Object.entries(answers)
    .map(([question, answer]) => `- ${question}：${Array.isArray(answer) ? answer.join("、") : answer}`)
    .join("\n");
}

const DESCRIPTION = `在执行过程中向用户提出 1 至 4 个问题，用于澄清需求、收集偏好、让用户作出决策，或请用户验证确认。

规则：
- 每次调用提 1 至 4 题，每题提供 1 至 4 个选项。
- 同一次调用中的问题文本和选项 label 必须全局唯一。
- 不要自行添加“其他”选项，UI 会自动提供。
- 如有推荐项，放在第一项，并在 label 末尾添加 (推荐)。
- multiSelect 为 true 时，问题措辞应使用可多选、非互斥的复数表达。
- header 是用于展示的短标签，最多 12 个字符。
- preview 为可选的纯文本预览内容，仅允许用于单选题。
- plan 模式下仅用于澄清需求或方案取舍，不能用于请求确认计划。
- 单选题未提供 input: true 选项时，UI 会在选项后提供一个“或者，告诉我应该怎么做”的自由输入框；用户填写后即可提交，无需先点击选项。
- 多选题不会自动追加自由输入框。
- 普通选项可设置 input: true，以始终展示一项可选的补充说明输入框。填写说明会自动选择该选项，回传结果保留选项名称和补充说明。
- 单选题已有 input: true 选项时，UI 不会自动追加“其他”，以免出现重复的自由文本入口。
- inputPlaceholder 可指定该输入框的提示文案；未提供时回退到 description。description 仍用于解释普通选项的影响或取舍。
- 验证确认场景：提供「确认通过」与「不通过」（input: true）两个选项即可；用户可直接填写“不通过”的具体问题。`;

function validateParams(params: AskQuestionsParams): void {
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
    if (!Array.isArray(item.options) || item.options.length < 1 || item.options.length > 4) {
      throw new ToolValidationError("每个问题必须包含 1 至 4 个选项");
    }
    if (item.multiSelect && item.options.some((option) => option.preview !== undefined)) {
      throw new ToolValidationError("preview 仅支持单选题");
    }
    for (const option of item.options) {
      if (!option || typeof option.label !== "string" || !option.label.trim()) {
        throw new ToolValidationError("每个选项都必须包含非空的 label");
      }
      if (option.description !== undefined && typeof option.description !== "string") {
        throw new ToolValidationError("选项 description 必须是字符串");
      }
      if (option.input !== undefined && typeof option.input !== "boolean") {
        throw new ToolValidationError("选项 input 必须是布尔值");
      }
      if (option.inputPlaceholder !== undefined && typeof option.inputPlaceholder !== "string") {
        throw new ToolValidationError("选项 inputPlaceholder 必须是字符串");
      }
      if (labels.has(option.label)) throw new ToolValidationError("所有问题的选项 label 必须全局唯一");
      labels.add(option.label);
    }
  }
}

/**
 * 创建可选的 AskQuestions 工具。内置聊天界面会自动渲染该工具；
 * 该工厂不会将工具加入任何默认列表。
 */
export function createAskQuestionsTool(): Tool {
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
                  required: ["label"],
                  properties: {
                    label: { type: "string", description: "简洁的可见选项名称。" },
                    description: { type: "string", description: "该选项的具体影响、理由或取舍，可不填。" },
                    preview: { type: "string", description: "仅单选题可用的纯文本预览内容，不支持 Markdown 或 HTML。" },
                    input: { type: "boolean", description: "是否为该普通选项始终展示一个可选的补充说明输入框；填写说明会自动选择该选项。" },
                    inputPlaceholder: { type: "string", description: "input 为 true 时的输入框提示文案；未提供时回退到 description。" },
                  },
                },
              },
            },
          },
        },
      },
    },
    validate: validateParams,
    async execute(params: AskQuestionsParams, ctx?: ToolExecutionContext): Promise<ToolResult> {
      if (!ctx?.waitUIRender) {
        return { output: "错误：当前工具上下文不支持等待 UI 回传。" };
      }

      const response = await ctx.waitUIRender<AskQuestionsAnswers | AskQuestionsSkip>();
      if (response === null) {
        ctx.getAgent().abort();
        return { output: "用户未回答问题，当前对话已取消。" };
      }

      if (isSkip(response)) {
        return {
          output: "The user skipped these questions. Do not ask these questions again.",
          metadata: { skipped: true },
        };
      }

      return {
        output: `用户已确认以下选择：\n${formatAnswers(response)}`,
        metadata: { answers: response },
      };
    },
  };
}
