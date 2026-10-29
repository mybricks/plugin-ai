import type { TestCase } from './cases/types';

/** Add cases here and implement their HTTP/SSE behavior in http-agent-mock. */
export const HTTP_PLAYGROUND_CASES: TestCase[] = [
  {
    id: 'conflict-retry', httpScenario: 'conflict-retry', group: '请求与重试', name: '请求被拒后重试',
    priority: 'P0', description: '首次请求在服务端创建 turn 前被拒绝。',
    expectedBehavior: '1. 发送消息，观察服务端拒绝请求。\n2. 点击重试，观察 loading 和新的服务端错误。\n预期：同一条消息更新为最新错误；未创建的 turn 如何重试留待后续处理。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'retry-error', httpScenario: 'retry-error', group: '请求与重试', name: '重试在恢复前失败',
    priority: 'P0', description: 'turn 已进入服务端，重试在 turn:resume 之前直接失败。',
    expectedBehavior: '1. 发送任意消息，等待模拟错误。\n2. 点击重试，观察 loading 和最新错误。\n3. 再次重试，观察成功结果。\n预期：错误气泡更新为“模拟重试失败：最新错误”，再次重试成功。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'model-error-retry', httpScenario: 'model-error-retry', group: '模型与重试', name: '模型报错后重试失败再成功',
    priority: 'P0', description: '模型调用报错后，第一次重试仍失败，第二次重试成功。',
    expectedBehavior: '1. 发送消息，观察模型错误。\n2. 点击重试，观察 loading 和第二次模型错误。\n3. 再次重试，观察成功回复。\n预期：同一条消息依次显示两次不同的错误，并在成功后恢复正常。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'success', httpScenario: 'success', group: '基础流程', name: '正常流式响应',
    priority: 'P0', description: '模拟服务端返回一轮正常的 SSE 响应。',
    expectedBehavior: '发送任意消息，观察流式内容和完成状态。\n预期：显示“服务端响应成功。”，结束后允许继续发送。',
    initialTurns: [], request: async () => {},
  },
];
