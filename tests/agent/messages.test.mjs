import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';
import { createAgentHarness, count } from './helpers/message-harness.mjs';

const { Agent } = await loadAgentFixtures();
const makeAgent = (options) => createAgentHarness(Agent, options);

test('historical messages remain identical across turns even with always context', async () => {
  let time = 0;
  const { agent, requests } = makeAgent({ items: () => [
    { key: 'locale', content: 'LANGUAGE' },
    { key: 'time', content: `TIME ${time++}`, dedupThreshold: 'always' },
  ] });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  await agent.requestAI({ message: 'third' });
  const contents = messages => messages.map(({ cache, ...message }) => message);
  assert.deepEqual(contents(requests[1].slice(0, 2)), contents(requests[0]));
  assert.deepEqual(contents(requests[2].slice(0, requests[1].length)), contents(requests[1]));
  assert.equal(count(requests[2], 'LANGUAGE'), 1);
  for (const t of ['TIME 0', 'TIME 1', 'TIME 2']) assert.equal(count(requests[2], t), 1);
});

test('attachment optimizer preserves the current tool messages and their order', async () => {
  const toolMessages = [
    { role: 'assistant', content: '', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'call-1', content: 'tool result' },
  ];
  const { agent, requests } = makeAgent({ hooks: { beforeRequest: () => ({ additionalMessages: toolMessages }) } });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  const tail = requests[1].slice(-2).map(({ cache, ...message }) => message);
  assert.deepEqual(tail, toolMessages);
  assert.deepEqual(agent.getTurns()[1].attachmentContext, {});
});

test('cache markers are assigned after optimization removes the current duplicate', async () => {
  const { agent, requests } = makeAgent();
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  const messages = requests[1];
  assert.equal(messages.at(-1).content, 'second');
  assert.equal(messages.at(-1).cache, true);
  assert.ok(messages.every(m => !('contextTurnId' in m) && !('contextEntries' in m) && !('isAttachmentContext' in m)));
});

test('cache markers follow the visible history after mask removes context', async () => {
  const { agent, requests } = makeAgent({ mask: { maxTurns: 0 }, hooks: { beforeRequest: () => ({ additionalMessages: [] }) } });
  await agent.requestAI({ message: 'first' });
  // An empty response makes the historical user message the last visible history message.
  agent.getTurns()[0].iterations[0].content = '';
  await agent.requestAI({ message: 'second' });
  const historyUser = requests[1].find(m => m.content === 'first');
  assert.equal(historyUser.cache, true);
  assert.equal(count(requests[1], 'CONTEXT'), 1);
});

