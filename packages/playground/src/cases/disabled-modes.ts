import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

/**
 * 禁用 plan 模式：输入框不显示模式切换器。
 */
export const disabledModesPlanCase: TestCase = {
  id: "disabled-modes-plan",
  name: "禁用计划模式",
  group: "设置",
  description: "测试 disabledModes: ['plan'] 配置，隐藏模式切换器",
  expectedBehavior: "输入框不显示模式切换器；Agent 始终以 build 模式运行",
  initialTurns: [],
  disabledModes: ["plan"],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["当前以 build 模式运行，模式切换器已隐藏。"],
      ttftMs: 300,
      chunkDelayMs: 50,
    },
  ]),
};
