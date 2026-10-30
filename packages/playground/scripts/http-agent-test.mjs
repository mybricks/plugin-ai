import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.ts', server: { middlewareMode: true, hmr: false, ws: false, host: '127.0.0.1', open: false } });
const originalFetch = globalThis.fetch;
try {
  const { HttpAgent } = await server.ssrLoadModule('/../plugin/src/ui/chat/chat-panel/remote/http-agent.ts');
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
  assert.equal(modelAgent.getTurns()[0].errorCode, 'MODEL_ERROR');
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
  await rejectedAgent.requestAI({ turnId: 'rejected-turn', message: '测试', extra: { trace: 'keep' }, mode: 'plan' });
  assert.equal(rejectedAgent.getTurns().length, 0, '409 discards the locally rejected turn');
  await rejectedAgent.requestAI({ turnId: 'new-turn', message: '重新发送' });
  assert.equal(rejectedAgent.getTurns()[0].status, 'success');
  assert.equal(rejectedFixture.calls.filter(call => call.path.endsWith('/run')).length, 2);
  assert.equal(rejectedFixture.calls.filter(call => call.path.endsWith('/retry')).length, 0);
  const retried = rejectedFixture.calls.filter(call => call.path.endsWith('/run'))[1].body;
  assert.equal(retried.turnId, 'new-turn');
  assert.equal(retried.message, '重新发送');
  assert.equal(rejectedAgent.getTurns()[0].errorCode, undefined);

  const recoverFixture = createHttpAgentMock('retry-error');
  let connects = 0;
  let conflictSent = false;
  let finishReplay;
  let replayStarted;
  const replayReady = new Promise(resolve => { replayStarted = resolve; });
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/retry')) {
      conflictSent = true;
      return Response.json({ message: 'Agent is already running' }, { status: 409 });
    }
    if (path.endsWith('/turns') && conflictSent) {
      const page = await (await recoverFixture.fetchMock(input, init)).json();
      page.turns[0].status = 'success';
      delete page.turns[0].error;
      delete page.turns[0].endTime;
      return Response.json(page);
    }
    if (path.endsWith('/connect')) {
      if (++connects === 1) return new Response(null, { status: 204 });
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        start(controller) {
          const send = (event, data = {}) => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, turnId: 'recover-turn', data: { turnId: 'recover-turn', ...data }, createdAt: Date.now() })}\n\n`));
          send('session:locked');
          send('turn:resume');
          send('llm:start', { iterId: 'live-iter' });
          send('llm:content', { iterId: 'live-iter', content: '正在执行' });
          finishReplay = () => { send('turn:complete'); send('session:released'); controller.close(); };
          replayStarted();
        },
      }), { headers: { 'content-type': 'text/event-stream' } });
    }
    return recoverFixture.fetchMock(input, init);
  };
  const recoverAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'recover-demo' });
  await recoverAgent.requestAI({ turnId: 'recover-turn', message: '恢复测试' });
  await recoverAgent.retry('recover-turn');
  await replayReady;
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(recoverAgent.getSessionState().running, true, '409 replay restores loading');
  assert.equal(recoverAgent.getTurns()[0].iterations.at(-1).content, '正在执行');
  finishReplay();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(recoverAgent.getSessionState().running, false, 'replayed release ends loading');

  const idleFixture = createHttpAgentMock('retry-error');
  globalThis.fetch = (input, init) => String(input).endsWith('/retry')
    ? Promise.resolve(Response.json({ message: 'Agent is already running' }, { status: 409 }))
    : idleFixture.fetchMock(input, init);
  const idleAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'idle-demo' });
  await idleAgent.requestAI({ turnId: 'idle-turn', message: '恢复历史' });
  await idleAgent.retry('idle-turn');
  assert.equal(idleAgent.getTurns().length, 1);
  assert.equal(idleAgent.getTurns()[0].status, 'error', '409 restores the persisted turn');
  assert.equal(idleAgent.getSessionState().running, false, 'idle recovery clears loading');

  for (const [scenario, expectedCode, rejects] of [
    ['network-error', 'NETWORK_ERROR', true],
    ['sse-disconnect', 'NETWORK_ERROR', true],
    ['server-http-error', 'SERVER_ERROR', true],
    ['server-turn-error', 'SERVER_ERROR', false],
    ['model-request-network', 'MODEL_ERROR', false],
  ]) {
    const caseFixture = createHttpAgentMock(scenario);
    globalThis.fetch = caseFixture.fetchMock;
    const caseAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: scenario });
    const turnId = `turn-${scenario}`;
    let emittedCode;
    caseAgent.events.on('turn:error', event => { emittedCode = event.errorCode; });
    const run = caseAgent.requestAI({ turnId, message: '测试错误分类' });
    if (rejects) await assert.rejects(run);
    else await run;
    assert.equal(caseAgent.getTurns()[0].errorCode, expectedCode, `${scenario}: turn errorCode`);
    assert.equal(emittedCode, expectedCode, `${scenario}: event errorCode`);
    if (scenario !== 'network-error' && scenario !== 'server-http-error') {
      await caseAgent.retry(turnId);
      assert.equal(caseAgent.getTurns()[0].status, 'success', `${scenario}: retry`);
      assert.equal(caseAgent.getTurns()[0].errorCode, undefined, `${scenario}: retry clears errorCode`);
    }
  }

  const lockFixture = createHttpAgentMock('success');
  let releaseLock;
  const unlock = new Promise(resolve => { releaseLock = resolve; });
  let afterTurn = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/run')) {
      const encoder = new TextEncoder();
      return new Response(new ReadableStream({
        async start(controller) {
          const send = event => controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event, turnId: 'lock-turn', data: { turnId: 'lock-turn' }, createdAt: Date.now() })}\n\n`));
          send('turn:complete');
          await unlock;
          send('session:released');
          controller.close();
        },
      }));
    }
    return lockFixture.fetchMock(input, init);
  };
  const lockAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'lock-demo' }, { hooks: { afterTurn: () => { afterTurn++; } } });
  const completed = new Promise(resolve => lockAgent.events.on('turn:complete', resolve));
  const lockedRun = lockAgent.requestAI({ turnId: 'lock-turn', message: '锁' });
  await completed;
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(afterTurn, 0, 'afterTurn must wait for lock release');
  assert.equal(lockAgent.getSessionState().running, true);
  assert.equal(lockAgent.getSessionState().stage?.key, 'http:finalizing');
  releaseLock();
  await lockedRun;
  await Promise.resolve();
  assert.equal(afterTurn, 1);
  assert.equal(lockAgent.getSessionState().running, false);

  let fallbackHooks = 0;
  const legacyFixture = createHttpAgentMock('success');
  globalThis.fetch = async (input, init) => {
    if (!String(input).endsWith('/run')) return legacyFixture.fetchMock(input, init);
    const event = { event: 'turn:error', turnId: 'legacy', data: { turnId: 'legacy', error: 'old server' }, createdAt: Date.now() };
    return new Response(`data: ${JSON.stringify(event)}\n\n`);
  };
  const legacyAgent = new HttpAgent({ baseUrl: 'http://localhost/mock', workspaceId: 'legacy-demo' }, { hooks: { afterTurn: () => { fallbackHooks++; } } });
  await legacyAgent.requestAI({ turnId: 'legacy', message: 'test' });
  await Promise.resolve();
  assert.equal(fallbackHooks, 1, 'stream close must not leave afterTurn waiting forever');
  assert.equal(legacyAgent.getSessionState().running, false);
  console.log('HTTP Agent: retry loading, updated error and success passed');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
