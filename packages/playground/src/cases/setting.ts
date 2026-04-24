import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";

export const settingCase: TestCase = {
  id: "setting-modal",
  name: "设置弹窗",
  group: "设置",
  description: "测试设置弹窗界面，包括关于和模型服务配置",
  expectedBehavior: "右上角显示设置按钮，点击后打开设置弹窗，可切换'关于'和'模型服务'标签页",
  initialTurns: [],
  request: makeScriptedRequest([
    {
      type: "content",
      chunks: ["这是一个测试设置界面的场景。"],
      ttftMs: 300,
      chunkDelayMs: 50,
    },
  ]),
};
