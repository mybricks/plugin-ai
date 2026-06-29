import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeToolHistory } from "../lib/fixtures";

// 预设 2 轮历史，模拟"有历史的正常场景"
const twoTurnHistory = makeToolHistory(
  [
    {
      user: '读一下 config.ts',
      assistant: '已读取，config.ts 包含基础配置。',
      toolCalls: [{ name: 'read_file', args: { path: '/src/config.ts' }, result: 'export const config = { debug: false };' }],
    },
    {
      user: '再读一下 index.ts',
      assistant: 'index.ts 是入口文件，导入了 config。',
      toolCalls: [{ name: 'read_file', args: { path: '/src/index.ts' }, result: "import { config } from './config';" }],
    },
  ],
  Date.now() - 5 * 60 * 1000
);

const simpleReply = makeScriptedRequest([
  {
    type: 'content',
    chunks: ['好的，我已经了解到这个项目的基础配置了。有什么我可以帮你的吗？'],
    ttftMs: 300,
    chunkDelayMs: 40,
  },
]);

/**
 * 慢速加载历史：load() 延迟 3 秒，期间 UI 应显示"正在加载历史记录..."并禁用输入框
 */
export const historySlowLoadCase: TestCase = {
  id: 'history-slow-load',
  name: '历史记录加载慢（3s 延迟）',
  group: '历史加载',
  priority: 'P0',
  description:
    'MockHistory.load() 延迟 3 秒返回，模拟持久化层响应慢的场景。' +
    '验证 UI 在加载期间显示占位文案、禁用输入框，加载完成后正确显示历史消息。',
  expectedBehavior:
    '打开后 3 秒内：messages-area 中央显示「正在加载历史记录...」，Sender 不可用。' +
    '3 秒后：历史消息正常渲染，Sender 恢复可用，可正常发消息。',
  initialTurns: twoTurnHistory,
  historyOptions: { loadDelayMs: 3000 },
  request: simpleReply,
};

/**
 * 历史加载失败：load() 直接抛异常，UI 应显示错误提示并禁用输入框
 */
export const historyLoadErrorCase: TestCase = {
  id: 'history-load-error',
  name: '历史记录加载失败',
  group: '历史加载',
  priority: 'P0',
  description:
    'MockHistory.load() 抛出异常，模拟 IDB / 网络存储读取失败的场景。' +
    '验证 UI 在 error 状态下显示错误占位、禁用输入框，不崩溃。',
  expectedBehavior:
    '打开后 messages-area 中央显示「历史记录加载失败，请刷新后重试」，' +
    'Sender 保持禁用状态，页面不崩溃。',
  initialTurns: twoTurnHistory,
  historyOptions: { loadError: true },
  request: simpleReply,
};
