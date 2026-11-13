import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const { Agent } = await loadAgentFixtures();
const defaults = { summary: false, compact: { enabled: false }, retry: { maxRetries: 1, baseDelayMs: 0 } };

test('a completion without response callbacks retries and can succeed', async () => {
  let count = 0;
  const retries = [];
  const agent = new Agent({ ...defaults, request: async ({ emits }) => {
    if (++count === 2) emits.write('成功');
    emits.complete();
  } });
  agent.events.on('llm:retry', event => retries.push(event.attempt));
  await agent.requestAI({ message: 'test' });
  assert.equal(count, 2);
  assert.deepEqual(retries, [1]);
  assert.equal(agent.getTurns().at(-1).iterations[0].content, '成功');
});

test('exhausted empty responses report a model error', async () => {
  let count = 0;
  const agent = new Agent({ ...defaults, request: async ({ emits }) => { count++; emits.complete(); } });
  await assert.rejects(agent.requestAI({ message: 'test' }), /without response events/);
  assert.equal(count, 2);
  assert.equal(agent.getTurns().at(-1).errorCode, 'MODEL_ERROR');
});

for (const [name, send] of [
  ['write', emits => emits.write('')],
  ['thinking', emits => emits.onThinking('')],
  ['usage', emits => emits.onUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })],
  ['tool calls', emits => emits.onToolCalls([])],
  ['tool stream', emits => emits.onToolCallStream({ index: 0 })],
  ['finish reason', emits => emits.onFinishReason('stop')],
]) {
  test(`${name} callback counts as a response even with empty data`, async () => {
    let count = 0;
    const agent = new Agent({ ...defaults, request: async ({ emits }) => { count++; send(emits); emits.complete(); } });
    await agent.requestAI({ message: 'test' });
    assert.equal(count, 1);
    assert.equal(agent.getTurns().at(-1).status, 'success');
  });
}

