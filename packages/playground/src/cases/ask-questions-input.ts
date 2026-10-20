import type { TestCase } from "./types";
import { ASK_QUESTIONS_TOOL_NAME, Tools } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";

export const askQuestionsInputCase: TestCase = {
  id: "ask-questions-input",
  name: "询问用户（单选+preview、多选、input 追问）",
  group: "工具调用",
  priority: "P0",
  description: "调用 ask_questions，覆盖单选+preview、多选，以及选项级 input:true 追问（典型用于验证确认场景的「不通过」选项）。",
  expectedBehavior:
    "第一题为单选+preview，第二题为多选；第三题模拟验证确认场景，提供「确认通过」与「不通过」两个选项，「不通过」设置了 input: true——选中后直接在该选项下展示输入框（placeholder 复用其 description），无需 UI 自动追加「其他」；提交时「不通过」的回传值为用户输入的文本。",
  initialTurns: [],
  tools: [Tools.createAskQuestions()],
  request: makeScriptedRequest(
    [
      {
        type: "tool_calls",
        delayMs: 200,
        calls: [
          {
            id: "call_ask_user_question_input_001",
            name: ASK_QUESTIONS_TOOL_NAME,
            args: {
              questions: [
                {
                  question: "你希望使用哪种样式方案？",
                  header: "样式方案",
                  options: [
                    {
                      label: "CSS Modules (推荐)",
                      description: "样式局部隔离，适合当前项目。",
                      preview: ".button {\n  color: red;\n}",
                    },
                    {
                      label: "Tailwind",
                      description: "使用原子类快速组合界面。",
                      preview: "<button class=\"text-red-500\">按钮</button>",
                    },
                  ],
                },
                {
                  question: "你希望优先包含哪些功能？",
                  header: "功能范围",
                  multiSelect: true,
                  options: [
                    { label: "登录", description: "提供账号登录与会话管理。" },
                    { label: "数据分析", description: "展示核心使用数据。" },
                    { label: "导出", description: "允许用户导出数据。" },
                  ],
                },
                {
                  question: "登录按钮已改为品牌蓝，是否验证通过？",
                  header: "验证确认",
                  options: [
                    { label: "确认通过" },
                    { label: "不通过", description: "请描述具体问题", input: true },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        type: "content",
        chunks: ["已收到你的选择，我会据此继续后续实现。"],
        ttftMs: 100,
        chunkDelayMs: 30,
      },
    ],
    { loop: true }
  ),
};
