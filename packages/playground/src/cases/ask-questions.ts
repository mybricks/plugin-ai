import type { TestCase } from "./types";
import { ASK_QUESTIONS_TOOL_NAME, Tools } from "@agent/index";
import { makeScriptedRequest } from "../lib/scripted-request";

export const askQuestionsCase: TestCase = {
  id: "ask-questions",
  name: "询问用户（UI 回填）",
  group: "工具调用",
  priority: "P0",
  description: "调用 ask_questions，验证工具卡片收集选项后将答案作为同一 turn 的 tool result 返回给模型。",
  expectedBehavior: "先显示两道可交互问题；选择后点击提交，卡片显示答案，随后模型继续输出确认文案。点击取消会中止当前 turn。",
  initialTurns: [],
  tools: [Tools.createAskUserQuestion()],
  request: makeScriptedRequest([
    {
      type: "tool_calls",
      delayMs: 200,
      calls: [{
        id: "call_ask_user_question_001",
        name: ASK_QUESTIONS_TOOL_NAME,
        args: {
          questions: [
            {
              question: "你希望使用哪种样式方案？",
              header: "样式方案",
              options: [
                { label: "CSS Modules (Recommended)", description: "样式局部隔离，适合当前项目。" },
                { label: "Tailwind", description: "使用原子类快速组合界面。" },
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
          ],
        },
      }],
    },
    {
      type: "content",
      chunks: ["已收到你的选择，我会据此继续后续实现。"],
      ttftMs: 100,
      chunkDelayMs: 30,
    },
  ], { loop: true }),
};
