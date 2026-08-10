import type { TestCase } from "./types";
import { makeScriptedRequest } from "../lib/scripted-request";
import { makeToolHistory, makeTurn } from "../lib/fixtures";
import type { CompactRecord } from "@agent/types";

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

// 30 轮更早历史：首屏不加载，待用户翻页时按需读取。
const baseTime = Date.now() - 10 * 60 * 60 * 1000;
const earlierTurns = Array.from({ length: 30 }, (_, i) =>
  makeTurn({
    userText: `早期消息 #${i + 1}`,
    startTime: baseTime + i * 5000,
    endTime: baseTime + i * 5000 + 3000,
    iterations: [{ content: `早期回复 #${i + 1}`, toolCalls: [] }],
  })
);

// Playground 内部用此游标模拟按需加载的首屏边界。
const initialPageCursor = earlierTurns[earlierTurns.length - 1];
const mockInitialPageCursor: CompactRecord = {
  upToTurnId: initialPageCursor.id,
  content: "早期对话摘要：用户进行了 30 轮基础配置和文件读取操作。",
  createdAt: baseTime + 30 * 5000,
};

// 首屏的 8 轮，每轮 4 个 iter（共 32 iters > 默认阈值 30），进来就触发折叠。
const recentTurns = Array.from({ length: 8 }, (_, i) =>
  makeTurn({
    userText: `近期消息 #${i + 1}`,
    startTime: Date.now() - (8 - i) * 60 * 1000,
    endTime: Date.now() - (8 - i) * 60 * 1000 + 3000,
    iterations: Array.from({ length: 4 }, (_, j) => ({
      content: j === 3 ? `近期回复 #${i + 1}，基于摘要上下文。` : undefined,
      toolCalls: j < 3 ? [{ name: 'read_file', args: { path: `/src/file-${i}-${j}.ts` }, result: `// content ${i}-${j}` }] : [],
    })),
  })
);

const allTurns = [...earlierTurns, ...recentTurns];

/**
 * History 支持分页：首屏只读取近期历史，用户可继续向前翻页。
 */
export const historyLazyLoadCase: TestCase = {
  id: 'history-lazy-load',
  name: '历史分页（首屏 + 更早记录）',
  group: '历史加载',
  priority: 'P0',
  description:
    '预设 30 轮更早历史 + 8 轮首屏历史（每轮 4 iters，共 32 iters > 阈值 30）。' +
    'MockHistory 实现了 loadTurns，Agent 首屏只加载 8 轮，并触发本地折叠。' +
    '验证本地展开完成后可继续按页读取更早记录。',
  expectedBehavior:
    '初始出现折叠条，只展示最近几轮。' +
    '已加载历史被折叠时可点「展开一条」或「展开全部」。全部展开后，折叠条提示「更多历史对话记录」，此时可按「展开一条」或「展开 10 条」调用 loadTurns 翻页。',
  initialTurns: allTurns,
  historyOptions: {},
  historyCollapse: { maxIters: 30 },
  compactOptions: { enabled: false },
  request: simpleReply,
  _mockCompact: mockInitialPageCursor,
} as any;

/**
 * History 未实现 loadTurns 时，直接全量加载。
 */
export const historyLazyLoadFallbackCase: TestCase = {
  id: 'history-lazy-load-fallback',
  name: '不支持分页的历史（全量加载）',
  group: '历史加载',
  priority: 'P0',
  description:
    '预设 38 轮历史，MockHistory 不实现 loadTurns。' +
    '验证 Agent 通过 load() 一次性读取完整历史，消息列表中不会遗漏更早记录。',
  expectedBehavior:
    '进入后 38 轮历史均已加载；由于超过折叠阈值，顶部显示折叠条，展开后可看到最早的历史消息。',
  initialTurns: allTurns,
  historyOptions: { supportsPagination: false },
  historyCollapse: { maxIters: 30 },
  compactOptions: { enabled: false },
  request: simpleReply,
  _mockCompact: mockInitialPageCursor,
} as any;

export const historyLazyLoadSlowCase: TestCase = {
  id: 'history-lazy-load-slow',
  name: '历史分页慢响应（翻页 2s 延迟）',
  group: '历史加载',
  priority: 'P1',
  description:
    'loadTurns 延迟 2 秒，模拟读取更早历史时持久化层响应慢的场景。' +
    '验证分页请求期间有 loading 反馈，完成后更早消息正确插入。',
  expectedBehavior:
    '全部展开后，点「展开一条」或「展开 10 条」应有 loading 反馈，2 秒后对应数量的旧消息出现在列表顶部。',
  initialTurns: allTurns,
  historyOptions: { pageDelayMs: 2000 },
  historyCollapse: { maxIters: 30 },
  compactOptions: { enabled: false },
  request: simpleReply,
  _mockCompact: mockInitialPageCursor,
} as any;

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
