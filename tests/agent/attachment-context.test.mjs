import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';
import { createAgentHarness, count } from './helpers/message-harness.mjs';

const { Agent } = await loadAgentFixtures();
const makeAgent = (options) => createAgentHarness(Agent, options);

test('captures actual requests: context is persisted, reused from history, and placed before user input', async () => {
  const { agent, requests } = makeAgent();
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(agent.getTurns()[0].attachmentContext.context.content, 'CONTEXT');
  assert.deepEqual(agent.getTurns()[1].attachmentContext, {});
  assert.equal(agent.getTurns()[1].attachmentContextCandidates, undefined);
  assert.deepEqual(agent.getTurns()[1].iterations[0].attachmentContextKeys, []);
  assert.equal(count(requests[1], 'CONTEXT'), 1);
  assert.ok(requests[0].findIndex(m => m.content === 'CONTEXT') < requests[0].findIndex(m => m.content === 'first'));
});

test('masked historical context is sent again', async () => {
  const { agent, requests } = makeAgent({ mask: { maxTurns: 0 } });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[1], 'CONTEXT'), 1);
  assert.equal(requests[1].at(-2).content, 'CONTEXT');
});

test('handoff replaces historical context and causes it to be sent again', async () => {
  const { agent, requests } = makeAgent({ handoff: { enabled: true } });
  await agent.requestAI({ message: 'first' });
  agent.getTurns()[0].handoff = 'summary';
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[1], 'CONTEXT'), 1);
  assert.equal(requests[1].at(-2).content, 'CONTEXT');
});

test('mask maps history correctly when hook adds a user message', async () => {
  const { agent, requests } = makeAgent({ mask: { maxTurns: 0 }, hooks: { beforeRequest: () => ({ additionalMessages: [{ role: 'user', content: 'hook' }] }) } });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[1], 'CONTEXT'), 1);
  assert.ok(requests[1].findIndex(m => m.content === 'CONTEXT') < requests[1].findIndex(m => m.content === 'second'));
});

test('changed content is appended while the original historical message remains', async () => {
  let content = 'CONTEXT version 1';
  const { agent, requests } = makeAgent({ items: () => [{ key: 'context', content }] });
  await agent.requestAI({ message: 'first' });
  content = 'CONTEXT version 2';
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[1], 'CONTEXT'), 2);
  assert.ok(requests[1].some(m => m.content === 'CONTEXT version 1'));
  assert.ok(requests[1].some(m => m.content === 'CONTEXT version 2'));
});

test('threshold suppresses small changes but sends changes above the threshold', async () => {
  let content = 'abcdefghij';
  const { agent, requests } = makeAgent({ items: () => [{ key: 'context', content, dedupThreshold: 0.2 }] });
  await agent.requestAI({ message: 'first' });
  content = 'abcdefghiX';
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[1], 'abcdefghij'), 1);
  assert.equal(count(requests[1], 'abcdefghiX'), 0);
  content = 'abcXXXXXXX';
  await agent.requestAI({ message: 'third' });
  assert.equal(agent.getTurns()[2].attachmentContext.context.content, content);
  assert.equal(count(requests[2], content), 1);
});

test('persisted attachment context is available after history reload', async () => {
  const records = [];
  const history = {
    load: async () => structuredClone(records),
    append: async (_key, record) => { records.push(structuredClone(record)); },
    update: async (_key, id, patch) => { Object.assign(records.find(r => r.id === id), structuredClone(patch)); },
    clear: async () => { records.length = 0; },
    loadCompact: async () => null,
    saveCompact: async () => {},
  };
  const first = makeAgent({ history, key: 'replay' });
  await first.agent.requestAI({ message: 'first' });
  assert.equal(records[0].attachmentContext.context.content, 'CONTEXT');
  const second = makeAgent({ history, key: 'replay' });
  await second.agent.requestAI({ message: 'second' });
  assert.equal(count(second.requests[0], 'CONTEXT'), 1);
  assert.deepEqual(second.agent.getTurns()[1].attachmentContext, {});
});

test('selects individual keys, retains history and appends always-dynamic values', async () => {
  let step = 0;
  const { agent, requests } = makeAgent({ items: () => [
    { key: 'stable', content: 'STABLE' },
    { key: 'project', content: `PROJECT ${step}` },
    { key: 'time', content: `TIME ${step++}`, dedupThreshold: 'always' },
  ] });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  const messages = requests[1];
  assert.equal(count(messages, 'STABLE'), 1);
  assert.equal(count(messages, 'PROJECT 0'), 1);
  assert.equal(count(messages, 'PROJECT 1'), 1);
  assert.equal(count(messages, 'TIME 0'), 1);
  assert.equal(count(messages, 'TIME 1'), 1);
  assert.ok(messages.findIndex(m => typeof m.content === 'string' && m.content.includes('TIME 1')) < messages.findIndex(m => m.content === 'second'));
  assert.ok(messages.every(m => !('contextTurnId' in m) && !('contextEntries' in m)));
});

test('retry keeps previously sent context content while regenerating unsent candidates', async () => {
  let attempts = 0;
  let generated = 0;
  const requests = [];
  const agent = new Agent({
    summary: false, compact: { enabled: false }, handoff: false, mask: false,
    retry: { maxRetries: 0 },
    getAttachmentContextMessages: () => [{ key: 'project', content: ++generated === 1 ? 'ORIGINAL' : 'CHANGED' }],
    request: async ({ messages, emits }) => {
      requests.push(structuredClone(messages));
      attempts++;
      if (attempts === 2) { emits.error(new Error('simulated failure')); return; }
      emits.write('reply');
      if (attempts === 1) emits.onFinishReason('length');
      emits.complete();
    },
  });
  await assert.rejects(agent.requestAI({ message: 'first' }), /simulated failure/);
  const turn = agent.getTurns()[0];
  assert.equal(turn.attachmentContext.project.content, 'ORIGINAL');
  assert.deepEqual(turn.iterations[0].attachmentContextKeys, ['project']);
  await agent.retry(turn.id);
  assert.equal(generated, 2);
  assert.equal(count(requests[2], 'ORIGINAL'), 1);
  assert.equal(count(requests[2], 'CHANGED'), 0);
  assert.deepEqual(turn.iterations[1].attachmentContextKeys, ['project']);
  assert.equal(turn.attachmentContextCandidates, undefined);
});

test('legacy records without iter selection metadata retain their attachment context', async () => {
  const first = makeAgent();
  await first.agent.requestAI({ message: 'first' });
  const record = structuredClone(first.agent.getTurns()[0]);
  delete record.iterations[0].attachmentContextKeys;
  const history = {
    load: async () => [structuredClone(record)],
    append: async () => {}, update: async () => {}, clear: async () => {},
    loadCompact: async () => null, saveCompact: async () => {},
  };
  const second = makeAgent({ history, key: 'legacy' });
  await second.agent.requestAI({ message: 'second' });
  assert.equal(count(second.requests[0], 'CONTEXT'), 1);
  assert.deepEqual(second.agent.getTurns()[1].iterations[0].attachmentContextKeys, []);
});

test('history reconstruction uses the last iter selection rather than the complete content pool', async () => {
  const first = makeAgent();
  await first.agent.requestAI({ message: 'first' });
  const record = structuredClone(first.agent.getTurns()[0]);
  record.iterations[0].attachmentContextKeys = [];
  const history = {
    load: async () => [structuredClone(record)],
    append: async () => {}, update: async () => {}, clear: async () => {},
    loadCompact: async () => null, saveCompact: async () => {},
  };
  const second = makeAgent({ history, key: 'selection' });
  await second.agent.requestAI({ message: 'second' });
  const messages = second.requests[0];
  assert.equal(count(messages, 'CONTEXT'), 1);
  assert.ok(messages.findIndex(m => m.content === 'CONTEXT') < messages.findIndex(m => m.content === 'second'));
  assert.deepEqual(second.agent.getTurns()[1].iterations[0].attachmentContextKeys, ['context']);
});

test('old history with no attachment context or attachment fields reloads and injects current context', async () => {
  const oldTurn = {
    id: 'old', startTime: 1000, endTime: 1001, status: 'success', userText: 'old question',
    iterations: [{ content: 'old answer', startTime: 1000 }],
  };
  const history = {
    load: async () => [structuredClone(oldTurn)], append: async () => {}, update: async () => {}, clear: async () => {},
    loadCompact: async () => null, saveCompact: async () => {},
  };
  const { agent, requests } = makeAgent({ history, key: 'old' });
  await agent.requestAI({ message: 'new question' });
  assert.ok(requests[0].some(m => m.content === 'old question'));
  assert.ok(requests[0].some(m => m.content === 'old answer'));
  assert.equal(requests[0].at(-2).content, 'CONTEXT');
  assert.deepEqual(agent.getTurns()[1].iterations[0].attachmentContextKeys, ['context']);
});

test('legacy string context callbacks are sent every turn while preserving history', async () => {
  const { agent, requests } = makeAgent({ items: () => ['LEGACY ONE', 'LEGACY TWO'] });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(count(requests[0], 'LEGACY ONE'), 1);
  assert.equal(count(requests[1], 'LEGACY ONE'), 2);
  assert.equal(requests[1].at(-2).content, 'LEGACY ONE\n\nLEGACY TWO');
  assert.deepEqual(agent.getTurns()[1].iterations[0].attachmentContextKeys, ['__legacy_attachment_context__']);
});


