import type { TestCase } from './cases/types';

/** Add cases here and implement their HTTP/SSE behavior in http-agent-mock. */
export const HTTP_PLAYGROUND_CASES: TestCase[] = [
  {
    id: 'finalizing', httpScenario: 'finalizing', group: '请求与重试', name: '完成后等待解锁',
    priority: 'P0', description: '模型输出结束后延迟 4 秒释放锁。',
    expectedBehavior: '发送消息后，回答结束但仍保持 loading；约 4 秒后解锁，loading 结束并允许发送下一条消息。消息中不显示收尾提示。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'conflict-retry', httpScenario: 'conflict-retry', group: '请求与重试', name: '请求被拒后重试',
    priority: 'P0', description: '首次请求在服务端创建 turn 前被拒绝。',
    expectedBehavior: '1. 发送消息，观察 409 错误及重试按钮。\n2. 点击重试，预期使用同一 turnId 重新发送 /run，最终成功。',
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
    expectedBehavior: '发送消息后应显示模型错误和换模型重试；普通重试先失败再成功。也可选择测试模型 B 重试，在请求面板确认 modelId 为 model-b 并成功。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'network-error', httpScenario: 'network-error', group: '错误分类', name: '前端网络连接失败',
    priority: 'P0', description: '首次 /run 模拟浏览器连接失败。',
    expectedBehavior: '发送消息后应显示网络连接提示及重试按钮，不显示换模型重试。切换中英文检查前端提示；连接失败时服务端是否已接受请求无法确定。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'sse-disconnect', httpScenario: 'sse-disconnect', group: '错误分类', name: 'SSE 中途断开',
    priority: 'P0', description: '服务端已接受请求，SSE 在终态之前断开。',
    expectedBehavior: '发送消息后应显示连接中断提示和重试按钮，不显示换模型重试；重试后显示成功结果。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'server-http-error', httpScenario: 'server-http-error', group: '错误分类', name: '服务端 HTTP 错误',
    priority: 'P0', description: '首次 /run 返回 HTTP 503。',
    expectedBehavior: '发送后显示服务端错误信息和重试按钮，不显示换模型重试；该请求尚未创建 turn 时，重试会提示无法重试。服务端原始错误不要求翻译。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'server-turn-error', httpScenario: 'server-turn-error', group: '错误分类', name: '服务端执行错误',
    priority: 'P0', description: '已进入服务端后通过 SSE 返回 SERVER_ERROR。',
    expectedBehavior: '发送后显示服务端错误信息和重试按钮，不显示换模型重试；点击重试后成功。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'model-request-network', httpScenario: 'model-request-network', group: '错误分类', name: '模型请求的网络失败',
    priority: 'P0', description: '模拟模型 request 阶段出现 fetch failed，服务端归类为 MODEL_ERROR。',
    expectedBehavior: '发送后应显示模型服务错误，并提供普通重试及换模型重试；选择测试模型 B 后成功。切换中英文检查前端文案。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'error-finalizing', httpScenario: 'error-finalizing', group: '请求与重试', name: '失败后等待解锁',
    priority: 'P0', description: '服务端先返回错误，4 秒后发送解锁事件。',
    expectedBehavior: '错误出现后仍保持 loading，期间没有重试操作；约 4 秒后解锁，loading 结束且重试可用。消息中不显示收尾提示。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'legacy-close', httpScenario: 'legacy-close', group: '请求与重试', name: '旧服务端无解锁事件',
    priority: 'P0', description: '服务端返回错误后直接关闭 SSE，不发送解锁事件。',
    expectedBehavior: '应通过关流兜底结束 loading，显示错误及重试按钮。',
    initialTurns: [], request: async () => {},
  },
  {
    id: 'success', httpScenario: 'success', group: '基础流程', name: '正常流式响应',
    priority: 'P0', description: '模拟服务端返回一轮正常的 SSE 响应。',
    expectedBehavior: '发送任意消息，观察流式内容和完成状态。\n预期：显示“服务端响应成功。”，结束后允许继续发送。',
    initialTurns: [], request: async () => {},
  },
];
