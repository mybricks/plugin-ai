import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false, ws: false, host: '127.0.0.1', open: false } });
const originalFetch = globalThis.fetch;
try {
  const { HttpAgent } = await server.ssrLoadModule('/../plugin/src/ui/chat/chat-panel/http-agent.ts');
  const { createHttpAgentMock } = await server.ssrLoadModule('/src/http-agent-mock.ts');
  const fixture = createHttpAgentMock('retry-error');
  globalThis.fetch = fixture.fetchMock;
  const agent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'demo' });
  const events = [];
  for (const name of ['turn:start', 'turn:resume', 'turn:error', 'turn:complete']) {
    agent.events.on(name, data => events.push({ name, data }));
  }
  const input = { turnId: 'turn-test', displayMessage: '显示', modelMessage: '模型输入', attachments: [{ type: 'image', content: 'image-data' }] };
  await agent.requestAI(input);
  assert.match(agent.getTurns()[0].error, /模拟服务端错误/);
  const resumed = new Promise(resolve => agent.events.on('turn:resume', resolve));
  const pending = agent.retry('turn-test');
  assert.equal(agent.getSessionState().running, true);
  await resumed;
  assert.equal(events.at(-1).name, 'turn:resume', 'retry enters UI loading before server responds');
  await pending;
  assert.match(agent.getTurns()[0].error, /最新错误/);
  assert.equal(agent.getSessionState().running, false);
  await agent.retry('turn-test');
  assert.equal(agent.getTurns()[0].status, 'success');
  assert.equal(events.filter(event => event.name === 'turn:resume').length, 2, 'remote resume must not duplicate local resume');
  const history = await (await fixture.fetchMock('http://localhost/mock/workspaces/demo/turns')).json();
  assert.equal(history.turns[0].id, 'turn-test');
  assert.equal(history.turns[0].status, 'success');
  const normal = createHttpAgentMock('success');
  const response = await normal.fetchMock('http://localhost/mock/workspaces/demo/run', { method: 'POST', body: JSON.stringify({ turnId: 'normal', message: 'hello' }) });
  const sse = await response.text();
  assert.match(sse, /session:locked/);
  assert.match(sse, /turn:complete/);
  const normalHistory = await (await normal.fetchMock('http://localhost/mock/workspaces/demo/turns')).json();
  assert.equal(normalHistory.turns[0].userText, 'hello');
  assert.equal(normalHistory.turns[0].status, 'success');

  const modelFixture = createHttpAgentMock('model-error-retry');
  globalThis.fetch = modelFixture.fetchMock;
  const modelAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'model-demo' });
  const modelEvents = [];
  for (const name of ['llm:start', 'turn:resume', 'turn:error', 'turn:complete']) {
    modelAgent.events.on(name, data => modelEvents.push({ name, data }));
  }
  await modelAgent.requestAI({ turnId: 'model-turn', message: '测试模型' });
  assert.match(modelAgent.getTurns()[0].error, /模型服务报错：请求失败/);
  await modelAgent.retry('model-turn');
  assert.match(modelAgent.getTurns()[0].error, /模型服务报错：重试仍然失败/);
  await modelAgent.retry('model-turn');
  assert.equal(modelAgent.getTurns()[0].status, 'success');
  assert.equal(modelAgent.getTurns()[0].error, undefined);
  assert.equal(modelEvents.filter(event => event.name === 'llm:start').length, 3);
  assert.equal(modelEvents.filter(event => event.name === 'turn:error').length, 2);
  assert.equal(modelFixture.calls.filter(call => call.path.endsWith('/run')).length, 1);
  assert.equal(modelFixture.calls.filter(call => call.path.endsWith('/retry')).length, 2);

  const rejectedFixture = createHttpAgentMock('conflict-retry');
  globalThis.fetch = rejectedFixture.fetchMock;
  const rejectedAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'rejected-demo' });
  await assert.rejects(rejectedAgent.requestAI({ turnId: 'rejected-turn', message: '测试' }), /409/);
  await rejectedAgent.retry('rejected-turn');
  assert.match(rejectedAgent.getTurns()[0].error, /cannot retry/);
  assert.equal(rejectedFixture.calls.filter(call => call.path.endsWith('/run')).length, 1);
  assert.equal(rejectedFixture.calls.filter(call => call.path.endsWith('/retry')).length, 1);
  console.log('HTTP Agent: retry loading, updated error and success passed');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
