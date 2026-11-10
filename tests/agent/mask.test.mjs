import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';

const fixtures = await loadAgentFixtures();
const { Agent, computeMaskedTurnIds } = fixtures;
const count = (messages, text) => messages.filter(m => typeof m.content === 'string' && m.content.includes(text)).length;

test('turn mask advances in groups of four while keeping at least four recent build turns', () => {
  const turns = Array.from({ length: 10 }, (_, index) => ({
    id: `build-${index + 1}`, status: 'success', mode: 'build',
    startTime: Date.now(), endTime: Date.now(), iterations: [{}],
  }));
  const options = { maxTurns: 4, maxAgeMinutes: Infinity };
  const masked = length => [...computeMaskedTurnIds(turns.slice(0, length), options)];
  assert.deepEqual(masked(7), []);
  assert.deepEqual(masked(8), turns.slice(0, 4).map(turn => turn.id));
  assert.deepEqual(masked(9), turns.slice(0, 4).map(turn => turn.id));
  assert.deepEqual(masked(10), turns.slice(0, 4).map(turn => turn.id));
  const twelveTurns = [...turns, ...[11, 12].map(index => ({
    id: `build-${index}`, status: 'success', mode: 'build',
    startTime: Date.now(), endTime: Date.now(), iterations: [{}],
  }))];
  assert.deepEqual([...computeMaskedTurnIds(twelveTurns, options)], twelveTurns.slice(0, 8).map(turn => turn.id));
});

test('ask, plan and cancelled turns do not advance the turn mask boundary', () => {
  const build = index => ({ id: `build-${index}`, status: 'success', mode: 'build', startTime: Date.now(), endTime: Date.now(), iterations: [{}] });
  const other = (id, status, mode) => ({ id, status, mode, startTime: Date.now(), endTime: Date.now(), iterations: [{}] });
  const turns = [build(1), other('ask', 'success', 'ask'), build(2), other('cancelled', 'abort', 'build'), build(3), other('plan', 'success', 'plan'), build(4), build(5), build(6)];
  const options = { maxTurns: 2, maxAgeMinutes: Infinity };
  assert.deepEqual([...computeMaskedTurnIds(turns.slice(0, -1), options)], []);
  assert.deepEqual([...computeMaskedTurnIds(turns, options)], ['build-1', 'build-2', 'build-3', 'build-4']);
  assert.deepEqual([...computeMaskedTurnIds(turns, { maxTurns: 0, maxAgeMinutes: Infinity })], turns.filter(turn => turn.status === 'success' && turn.mode === 'build').map(turn => turn.id));
});

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
    const expected = caseName === 'maskByTurnsCase' ? [true, true, true, true, false, false, false] : [true, true, true, true, true];
    assert.equal(toolMessages.length, expected.length);
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
