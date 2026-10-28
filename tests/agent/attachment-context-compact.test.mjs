import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';
import { createAgentHarness, count } from './helpers/message-harness.mjs';

const { Agent, compactMidTurnErrorRetryCase } = await loadAgentFixtures();
const makeAgent = (options) => createAgentHarness(Agent, options);

test('context remains present when compact changes after turn-level dedup', async () => {
  let agent;
  let n = 0;
  const setup = makeAgent({ hooks: { beforeRequest: () => {
    if (++n === 2) agent.compactRecord = { upToTurnId: agent.getTurns()[0].id, content: 'summary' };
  } } });
  agent = setup.agent;
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(count(setup.requests[1], 'CONTEXT'), 1);
});

test('compact plus deleted turns still mask the correct visible history', async () => {
  let value = 'OLD';
  const { agent, requests } = makeAgent({ mask: { maxTurns: 0 }, items: () => [{ key: 'context', content: value }] });
  await agent.requestAI({ message: 'first' });
  value = 'VISIBLE';
  await agent.requestAI({ message: 'second' });
  await agent.requestAI({ message: 'third' });
  agent.getTurns()[1].deleted = true;
  agent.compactRecord = { upToTurnId: agent.getTurns()[0].id, content: 'summary' };
  await agent.requestAI({ message: 'fourth' });
  assert.equal(count(requests[3], 'VISIBLE'), 1);
  assert.ok(requests[3].findIndex(m => m.content === 'VISIBLE') < requests[3].findIndex(m => m.content === 'fourth'));
});

test('recomputes context on every iteration after a compact boundary changes', async () => {
  const requests = [];
  let agent;
  let hookCalls = 0;
  agent = new Agent({
    summary: false, compact: { enabled: false }, mask: false, handoff: false,
    getAttachmentContextMessages: () => [{ key: 'context', content: 'CONTEXT' }],
    hooks: { beforeRequest: () => {
      if (++hookCalls === 3) agent.compactRecord = { upToTurnId: agent.getTurns()[0].id, content: 'summary' };
    } },
    request: async ({ messages, emits }) => {
      requests.push(structuredClone(messages));
      emits.write('ok');
      if (requests.length === 2) emits.onFinishReason('length');
      emits.complete();
    },
  });
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(requests.length, 3);
  assert.equal(count(requests[1], 'CONTEXT'), 1);
  assert.equal(count(requests[2], 'CONTEXT'), 1);
  assert.ok(requests[2].findIndex(m => m.content === 'CONTEXT') < requests[2].findIndex(m => m.content === 'second'));
});

test('fully compacted history cannot cause mask to remove the current attachment context', async () => {
  let agent;
  let calls = 0;
  const setup = makeAgent({ mask: { maxTurns: 0 }, hooks: { beforeRequest: () => {
    if (++calls === 2) agent.compactRecord = { upToTurnId: agent.getTurns()[0].id, content: 'summary' };
  } } });
  agent = setup.agent;
  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });
  assert.equal(count(setup.requests[1], 'CONTEXT'), 1);
  assert.equal(setup.requests[1].at(-2).content, 'CONTEXT');
});

test('real compact between iterations reuses the turn candidate after the old context disappears', async () => {
  const requests = [];
  const records = [];
  let savedCompact = null;
  let candidateCalls = 0;
  let mainCalls = 0;
  const history = {
    load: async () => structuredClone(records),
    append: async (_key, record) => { records.push(structuredClone(record)); },
    update: async (_key, id, patch) => { Object.assign(records.find(record => record.id === id), structuredClone(patch)); },
    clear: async () => { records.length = 0; savedCompact = null; },
    loadCompact: async () => structuredClone(savedCompact),
    saveCompact: async (_key, compact) => { savedCompact = structuredClone(compact); },
  };
  const agent = new Agent({
    key: 'compact-between-iterations', history,
    summary: false, handoff: false, mask: false,
    compact: { enabled: true, contextWindow: 34000, maxTurns: 100 },
    getStableContextMessages: ({ includeSandboxContext = true } = {}) => [
      { role: 'user', content: 'STABLE RULES' },
      ...(includeSandboxContext ? [{ role: 'user', content: 'DEVELOPMENT GUIDE' }] : []),
    ],
    getAttachmentContextMessages: () => {
      candidateCalls++;
      return [{ key: 'project', content: 'PROJECT SNAPSHOT' }];
    },
    request: async ({ messages, emits, aiRole }) => {
      if (aiRole === 'flash') {
        requests.push({ type: 'compact', messages: structuredClone(messages) });
        emits.write('<compact>history summary</compact>');
      } else {
        mainCalls++;
        requests.push({ type: 'main', messages: structuredClone(messages) });
        emits.write(mainCalls === 2 ? 'partial response' : 'done');
        emits.onUsage({ promptTokens: mainCalls === 2 ? 1500 : 10, completionTokens: 1 });
        if (mainCalls === 2) emits.onFinishReason('length');
      }
      emits.complete();
    },
  });

  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'second' });

  assert.deepEqual(requests.map(request => request.type), ['main', 'main', 'compact', 'main']);
  assert.equal(count(requests[0].messages, 'DEVELOPMENT GUIDE'), 1);
  assert.equal(count(requests[2].messages, 'DEVELOPMENT GUIDE'), 0);
  assert.equal(count(requests[2].messages, 'STABLE RULES'), 1);
  const before = requests[1].messages;
  const after = requests[3].messages;
  assert.equal(count(before, 'PROJECT SNAPSHOT'), 1);
  assert.ok(before.findIndex(m => m.content === 'PROJECT SNAPSHOT') < before.findIndex(m => m.content === 'second'));
  assert.equal(count(after, 'PROJECT SNAPSHOT'), 1);
  assert.ok(after.findIndex(m => m.content === 'PROJECT SNAPSHOT') < after.findIndex(m => m.content === 'second'));
  assert.ok(after.some(m => typeof m.content === 'string' && m.content.includes('history summary')));
  assert.equal(candidateCalls, 2, 'each turn generates candidates once, including across compact');
  assert.equal(savedCompact.upToTurnId, records[0].id);
  assert.equal(records[1].attachmentContext.project.content, 'PROJECT SNAPSHOT');
  assert.equal(records[1].attachmentContextCandidates, undefined);
  assert.ok(records[1].iterations.some(iter => iter.type === 'warmup' && iter.status === 'success'));
  const llmIters = records[1].iterations.filter(iter => iter.type !== 'warmup');
  assert.deepEqual(llmIters.map(iter => iter.attachmentContextKeys), [[], ['project']]);
  assert.equal(llmIters[1].trace.compactRecord.upToTurnId, records[0].id);

  const resumed = makeAgent({ history, key: 'compact-between-iterations', items: () => [{ key: 'project', content: 'PROJECT SNAPSHOT' }] });
  await resumed.agent.requestAI({ message: 'third' });
  const replay = resumed.requests[0];
  const previousUser = replay.findIndex(m => m.content === 'second');
  const project = replay.findIndex(m => m.content === 'PROJECT SNAPSHOT');
  const previousReply = replay.findIndex(m => m.content === 'partial response');
  assert.ok(project < previousUser && previousUser < previousReply);
  assert.equal(count(replay, 'PROJECT SNAPSHOT'), 1);
});

test('playground compact-mid-turn-error-retry completes compact and resumes after the intended error', async () => {
  const testCase = compactMidTurnErrorRetryCase;
  const records = structuredClone(testCase.initialTurns);
  let compactRecord = null;
  const snapshots = [];
  const history = {
    load: async () => structuredClone(records),
    append: async (_key, record) => { records.push(structuredClone(record)); },
    update: async (_key, id, patch) => { Object.assign(records.find(record => record.id === id), structuredClone(patch)); },
    clear: async () => { records.length = 0; },
    loadCompact: async () => structuredClone(compactRecord),
    saveCompact: async (_key, record) => { compactRecord = structuredClone(record); },
  };
  const agent = new Agent({
    key: 'compact-mid-turn-case', history, summary: false, handoff: false, mask: false,
    compact: testCase.compactOptions, retry: { ...testCase.agentOptions.retry, baseDelayMs: 0, maxDelayMs: 0 },
    tools: [{ name: 'write_file', description: 'write file', execute: async () => ({ output: 'ok' }) }],
    request: async params => {
      snapshots.push({ params: { messages: structuredClone(params.messages) } });
      await testCase.request(params);
    },
  });
  await assert.rejects(agent.requestAI({ message: 'run the case' }), /503 Service Unavailable/);
  const turn = agent.getTurns().at(-1);
  assert.equal(turn.status, 'error');
  assert.ok(turn.iterations.some(iter => iter.type === 'warmup' && iter.status === 'success'));
  assert.ok(compactRecord?.content);
  assert.equal(turn.iterations.filter(iter => iter.type !== 'warmup').length, 2);
  await agent.retry(turn.id);
  assert.equal(turn.status, 'success');
  assert.equal(turn.iterations.filter(iter => iter.type !== 'warmup').length, 3);
  assert.match(turn.iterations.at(-1).content, /两个文件均已成功写入/);
  const assertion = testCase.assertions[0].run({ snapshots, agent, memFS: null });
  assert.equal(assertion.pass, true, assertion.message);
});

test('mid-turn compact re-injects the turn-start project snapshot even after a tool deletes files', async () => {
  const requests = [];
  const files = ['a.ts', 'b.ts'];
  let candidateCalls = 0;
  let mainCalls = 0;
  const agent = new Agent({
    summary: false, handoff: false, mask: false,
    compact: { enabled: true, contextWindow: 34000, maxTurns: 100 },
    getAttachmentContextMessages: () => {
      candidateCalls++;
      return [{ key: 'project', content: `PROJECT FILES: ${files.join(', ') || '(empty)'}` }];
    },
    tools: [{
      name: 'delete_files', description: 'delete project files',
      execute: async () => { files.length = 0; return { output: 'Deleted a.ts and b.ts' }; },
    }],
    request: async ({ messages, emits, aiRole }) => {
      requests.push({ aiRole, messages: structuredClone(messages) });
      if (aiRole === 'flash') {
        emits.write('<compact>previous conversation summary</compact>');
      } else if (++mainCalls === 2) {
        emits.onToolCalls([{ id: 'delete-call', name: 'delete_files', args: {} }]);
        emits.onFinishReason('tool_calls');
        emits.onUsage({ promptTokens: 1500, completionTokens: 1 });
      } else {
        emits.write('done');
        emits.onUsage({ promptTokens: 10, completionTokens: 1 });
      }
      emits.complete();
    },
  });

  await agent.requestAI({ message: 'first' });
  await agent.requestAI({ message: 'delete both files' });

  assert.deepEqual(files, []);
  assert.equal(candidateCalls, 2, 'one snapshot per turn, not one per iteration');
  assert.deepEqual(requests.map(request => request.aiRole), ['default', 'default', 'flash', 'default']);
  const beforeCompact = requests[1].messages;
  const afterCompact = requests[3].messages;
  const snapshotText = 'PROJECT FILES: a.ts, b.ts';
  assert.equal(count(beforeCompact, snapshotText), 1);
  assert.ok(beforeCompact.findIndex(m => m.content === snapshotText) < beforeCompact.findIndex(m => m.content === 'delete both files'));
  assert.equal(count(afterCompact, snapshotText), 1);
  assert.equal(count(afterCompact, 'PROJECT FILES: (empty)'), 0);
  const snapshotIndex = afterCompact.findIndex(m => m.content === snapshotText);
  const userIndex = afterCompact.findIndex(m => m.content === 'delete both files');
  const toolIndex = afterCompact.findIndex(m => m.role === 'tool' && m.content === 'Deleted a.ts and b.ts');
  assert.ok(snapshotIndex < userIndex && userIndex < toolIndex);
  const turn = agent.getTurns()[1];
  assert.equal(turn.attachmentContext.project.content, snapshotText);
  assert.deepEqual(turn.iterations.filter(iter => iter.type !== 'warmup').map(iter => iter.attachmentContextKeys), [[], ['project']]);
});

