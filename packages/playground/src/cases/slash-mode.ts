import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/** 手动验证 Sender action slash：切换模式但不插入 MBS token。 */
export const slashModeCase: TestCase = {
  id: "slash-mode",
  name: "斜线切换 Ask / Plan / Build 模式",
  group: "设置",
  priority: "P0",
  description: "在输入框依次输入 /ask、/询问、/plan、/计划、/build、/智能体并选择菜单项，验证 action slash 即时切换模式。",
  expectedBehavior:
    "模式 slash 固定排在模板命令之后，以中文展示并同时支持英文 name 或中文 displayName 检索；当前模式不会出现在列表中，例如 Plan 下只显示 /询问 和 /智能体。选择任一项立即更新模式选择器，不创建 MBS token，也不触发模型请求。随后发送普通消息时，以所选模式执行。",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["已按当前模式处理这条测试消息。"],
      ttftMs: 80,
      chunkDelayMs: 20,
    },
  ], { loop: true }),
};
