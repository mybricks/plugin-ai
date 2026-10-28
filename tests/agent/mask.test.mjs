import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const fixtures = await loadAgentFixtures();
const { Agent } = fixtures;
const count = (messages, text) => messages.filter(m => typeof m.content === 'string' && m.content.includes(text)).length;

test('mask age decision stays fixed across iterations and refreshes for the next turn', async () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    let calls = 0;
    const requests = [];
    const agent = new Agent({
      summary: false, compact: { enabled: false }, handoff: false,
      mask: { maxTurns: Infinity, maxAgeMinutes: 1 },
      getAttachmentContextMessages: () => [{ key: 'project', content: 'PROJECT' }],
      request: async ({ messages, emits }) => {
        requests.push(structuredClone(messages));
        calls++;
        emits.write('ok');
        if (calls === 2) { emits.onFinishReason('length'); now += 61_000; }
        emits.complete();
      },
    });
    await agent.requestAI({ message: 'first' });
    await agent.requestAI({ message: 'second' });
    assert.equal(requests.length, 3);
    for (const messages of [requests[1], requests[2]]) {
      assert.equal(count(messages, 'PROJECT'), 1);
      assert.ok(messages.findIndex(m => m.content === 'PROJECT') < messages.findIndex(m => m.content === 'first'));
    }
    assert.deepEqual(agent.getTurns()[1].iterations.map(iter => iter.attachmentContextKeys), [[], []]);
    assert.ok(!('maskedTurnIds' in agent.getTurns()[1]));

    await agent.requestAI({ message: 'third' });
    assert.equal(count(requests[3], 'PROJECT'), 1);
    assert.ok(requests[3].findIndex(m => m.content === 'second') < requests[3].findIndex(m => m.content === 'PROJECT'));
    assert.ok(requests[3].findIndex(m => m.content === 'PROJECT') < requests[3].findIndex(m => m.content === 'third'));
  } finally { Date.now = realNow; }
});

test('retry recalculates mask using the current time without persisting its decision', async () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    let calls = 0;
    const requests = [];
    const agent = new Agent({
      summary: false, compact: { enabled: false }, handoff: false,
      mask: { maxTurns: Infinity, maxAgeMinutes: 1 }, retry: { maxRetries: 0 },
      getAttachmentContextMessages: () => [{ key: 'project', content: 'PROJECT' }],
      request: async ({ messages, emits }) => {
        requests.push(structuredClone(messages));
        calls++;
        if (calls === 3) { now += 61_000; emits.error(new Error('test failure')); return; }
        emits.write('ok');
        if (calls === 2) emits.onFinishReason('length');
        emits.complete();
      },
    });
    await agent.requestAI({ message: 'first' });
    await assert.rejects(agent.requestAI({ message: 'second' }), /test failure/);
    assert.ok(requests[2].findIndex(m => m.content === 'PROJECT') < requests[2].findIndex(m => m.content === 'first'));
    const turn = agent.getTurns()[1];
    await agent.retry(turn.id);
    const retryMessages = requests[3];
    assert.equal(count(retryMessages, 'PROJECT'), 1);
    assert.ok(retryMessages.findIndex(m => m.content === 'first') < retryMessages.findIndex(m => m.content === 'PROJECT'));
    assert.ok(retryMessages.findIndex(m => m.content === 'PROJECT') < retryMessages.findIndex(m => m.content === 'second'));
    assert.deepEqual(turn.iterations.map(iter => iter.attachmentContextKeys), [[], ['project']]);
    assert.ok(!('maskedTurnIds' in turn));
  } finally { Date.now = realNow; }
});

for (const caseName of ['maskByTurnsCase', 'maskByAgeCase']) {
  test(`playground ${caseName} masks the expected tool results`, async () => {
    const testCase = fixtures[caseName];
    const initialTurns = structuredClone(testCase.initialTurns);
    const history = {
      load: async () => structuredClone(initialTurns), append: async () => {}, update: async () => {},
      clear: async () => {}, loadCompact: async () => null, saveCompact: async () => {},
    };
    const snapshots = [];
    const agent = new Agent({
      key: caseName, history, summary: false, handoff: false, compact: { enabled: false }, mask: testCase.maskOptions,
      request: async (params) => {
        snapshots.push({ params: { messages: structuredClone(params.messages) } });
        await testCase.request(params);
      },
    });
    await agent.requestAI({ message: 'continue' });
    const toolMessages = snapshots[0].params.messages.filter(message => message.role === 'tool');
    const expected = caseName === 'maskByTurnsCase' ? [true, true, true, false, false] : [true, true, true, true, true];
    assert.equal(toolMessages.length, 5);
    assert.deepEqual(toolMessages.map(message => message.content === '[Old tool result content cleared]'), expected);
    for (const assertion of testCase.assertions ?? []) {
      const result = assertion.run({ snapshots, agent, memFS: null });
      assert.ok(result, `${assertion.name}: pending`);
      assert.equal(result.pass, true, result.message);
    }
  });
}

for (const caseName of ['maskToolHistoryCase', 'handoffDisabledCase', 'handoffWithMaskCase']) {
  test(`playground ${caseName} produces its expected messages`, async () => {
    const testCase = fixtures[caseName];
    const initialTurns = structuredClone(testCase.initialTurns);
    const history = {
      load: async () => structuredClone(initialTurns), append: async () => {}, update: async () => {},
      clear: async () => {}, loadCompact: async () => null, saveCompact: async () => {},
    };
    const snapshots = [];
    const agent = new Agent({
      key: caseName, history, summary: false, compact: { enabled: false },
      ...(testCase.maskOptions ? { mask: testCase.maskOptions } : {}),
      ...(testCase.handoffOptions ? { handoff: testCase.handoffOptions } : {}),
      request: async (params) => {
        snapshots.push({ params: { messages: structuredClone(params.messages) } });
        await testCase.request(params);
      },
    });
    await agent.requestAI({ message: 'continue' });
    assert.ok(testCase.assertions?.length);
    for (const assertion of testCase.assertions) {
      const result = assertion.run({ snapshots, agent, memFS: null });
      assert.ok(result, `${assertion.name}: pending`);
      assert.equal(result.pass, true, result.message);
    }
  });
}
