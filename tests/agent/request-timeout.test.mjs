import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { Agent, requestIdleTimeoutRetryCase, requestIdleTimeoutExhaustedCase } = await loadAgentFixtures();
const defaults = { summary: false, compact: { enabled: false }, retry: { timeoutMs: 30, maxRetries: 1, baseDelayMs: 0 } };

test('idle timeout cancels and retries, isolating late events', async () => {
  let calls = 0, cancelled = 0, old;
  const agent = new Agent({ ...defaults, request: async ({ emits }) => {
    if (++calls === 1) { old = emits; emits.cancel(() => cancelled++); return; }
    old.write('late'); old.complete();
    emits.write('new'); emits.complete();
  } });
  const retries = [];
  agent.events.on('llm:retry', e => retries.push(e));
  await agent.requestAI({ message: 'hello' });
  assert.equal(calls, 2);
  assert.equal(cancelled, 1);
  assert.equal(retries.length, 1);
  assert.equal(agent.getTurns().at(-1).iterations[0].content, 'new');
});

test('stream activity resets the idle timeout', async () => {
  const agent = new Agent({ ...defaults, request: async ({ emits }) => {
    for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 12)); emits.write('a'); }
    emits.complete();
  } });
  await agent.requestAI({ message: 'hello' });
  assert.equal(agent.getTurns().at(-1).iterations[0].content, 'aaaa');
});

test('timeout exhaustion reports error after each attempt', async () => {
  let attempts = 0;
  const agent = new Agent({ ...defaults, request: async () => { attempts++; } });
  await assert.rejects(agent.requestAI({ message: 'hello' }), /timed out/);
  assert.equal(attempts, 2);
  assert.equal(agent.getTurns().at(-1).status, 'error');
  assert.match(agent.getTurns().at(-1).error, /timed out/);
});

test('user cancellation stops a hanging request without retry', async () => {
  let calls = 0, cancel = 0;
  const agent = new Agent({ ...defaults, request: async ({ emits }) => { calls++; emits.cancel(() => cancel++); } });
  const run = agent.requestAI({ message: 'hello' });
  await new Promise(r => setTimeout(r, 5));
  agent.abort();
  await run;
  assert.equal(calls, 1);
  assert.equal(cancel, 1);
  assert.equal(agent.getTurns().at(-1).status, 'abort');
});

test('playground timeout scenario can be repeated', async () => {
  const agent = new Agent({ ...defaults, retry: { ...defaults.retry, timeoutMs: 500 }, request: requestIdleTimeoutRetryCase.request });
  let retries = 0;
  agent.events.on('llm:retry', () => retries++);
  for (let i = 0; i < 2; i++) {
    await agent.requestAI({ message: '测试' });
    assert.equal(agent.getTurns().at(-1).status, 'success');
    assert.match(agent.getTurns().at(-1).iterations[0].content, /模型请求恢复成功/);
  }
  assert.equal(retries, 2);
});

test('playground exhausted timeout scenario emits three retries and ends in error', async () => {
  const config = requestIdleTimeoutExhaustedCase.agentOptions.retry;
  const agent = new Agent({ ...defaults, retry: { ...config, timeoutMs: 20, baseDelayMs: 0 }, request: requestIdleTimeoutExhaustedCase.request });
  const retries = [];
  agent.events.on('llm:retry', event => retries.push(event.attempt));
  await assert.rejects(agent.requestAI({ message: '测试' }), /timed out/);
  assert.deepEqual(retries, [1, 2, 3]);
  assert.equal(agent.getTurns().at(-1).status, 'error');
  assert.equal(agent.getTurns().at(-1).errorCode, 'MODEL_ERROR');
});

test('playground exhausted timeout can retry with the working model', async () => {
  const provider = requestIdleTimeoutExhaustedCase.llm.providers[0];
  const agent = new Agent({ ...defaults, request: params => provider.request({
    ...params, model: { providerId: provider.providerId, modelId: params.modelId ?? 'timeout' },
  }) });
  await assert.rejects(agent.requestAI({ message: '测试' }), /timed out/);
  const turn = agent.getTurns().at(-1);
  await agent.retry({ turnId: turn.id, providerId: provider.providerId, modelId: 'working' });
  assert.equal(agent.getTurns().at(-1).status, 'success');
  assert.match(agent.getTurns().at(-1).iterations.at(-1).content, /正常模型/);
});
