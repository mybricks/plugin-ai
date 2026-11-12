import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAgentFixtures } from './helpers/load-agent.mjs';
const { Agent, createSubAgentTool, collectSubAgentTurns, readLegacySubAgentData, applyChildAgentEvent, getTurnsManager } = await loadAgentFixtures();
const defaults = { key: 'parent', summary: { enabled: false }, compact: { enabled: false } };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const config = { name: 'overview', title: 'Configured title', description: 'test', supportsAsync: true, allowedTools: ['echo'] };
const args = { type: 'overview', name: 'overview', prompt: 'inspect', async: true };
const echo = { name: 'echo', description: 'echo', parameters: { type: 'object', properties: {} }, execute: async () => ({ output: 'tool history' }) };
function storage(persistMode) {
  const rows = new Map();
  const history = {
    persistMode,
    load: async key => structuredClone(rows.get(key) ?? []), loadCompact: async () => null,
    append: async (key, turn) => { rows.set(key, [...(rows.get(key) ?? []), structuredClone(turn)]); },
    update: async (key, id, patch) => {
      const turn = rows.get(key)?.find(turn => turn.id === id);
      assert.ok(turn, 'parent turn must exist before update');
      Object.assign(turn, structuredClone(patch));
    },
  };
  return { history, rows };
}
function parentAgent(history, request, subConfig = config, extra = {}) {
  let parent;
  const tool = createSubAgentTool(() => parent, [subConfig]);
  const { AgentClass = Agent, ...options } = extra;
  parent = new AgentClass({ ...defaults, history, tools: [tool, echo], request, ...options });
  return parent;
}
function observeChildEvents(agent, events) {
  agent.events.on('subagent:created', info => {
    const childEvents = agent.childAgentEvents(info.turnId);
    assert.ok(childEvents, 'child event bus is available when created');
    for (const event of ['turn:start', 'turn:complete', 'turn:error', 'turn:abort']) {
      childEvents.on(event, data => events.push({ ...info, event, data }));
    }
  });
}
function waitForChild(agent) {
  return new Promise((resolve, reject) => {
    const stop = agent.events.on('subagent:created', info => {
      if (!info.async) return;
      const childEvents = agent.childAgentEvents(info.turnId);
      assert.ok(childEvents);
      const finish = async () => {
        stop();
        try {
          // Native terminal events can precede the final history write.
          for (let attempt = 0; attempt < 1000; attempt++) {
            const turn = (await agent.getSubAgentTurns(info.agentKey)).find(item => item.id === info.turnId);
            if (turn?.endTime) return resolve({ agentKey: info.agentKey, turnId: info.turnId, status: turn.status, turn });
            await new Promise(r => setTimeout(r, 1));
          }
          reject(new Error('child history did not settle'));
        } catch (error) { reject(error); }
      };
      for (const event of ['turn:complete', 'turn:error', 'turn:abort']) childEvents.on(event, finish);
    });
  });
}
function call(emits, name, args, id = 'call-1') {
  emits.onToolCalls([{ id, name, args }]);
  emits.onFinishReason('tool_calls'); emits.complete();
}

for (const mode of ['turn', 'iter']) test(`async persists independent child turns in shared history (${mode}) and rebuilds after recreation`, async () => {
  const { history, rows } = storage(mode);
  const gate = deferred(), checkpointed = deferred();
  let parentCalls = 0, childCalls = 0;
  const request = async ({ tools, messages, emits }) => {
    if (tools.some(tool => tool.name === 'call-sub-agent')) {
      if (parentCalls++ === 0) return call(emits, 'call-sub-agent', args);
      emits.write('parent done'); emits.complete(); return;
    }
    if (childCalls++ === 0) return call(emits, 'echo', {});
    checkpointed.resolve(); await gate.promise;
    emits.write('child result'); emits.complete();
  };
  const parent = parentAgent(history, request);
  const completion = waitForChild(parent);
  await parent.requestAI({ message: 'start' });
  await checkpointed.promise;
  const saved = rows.get('parent').find(turn => !turn.parentTurnId);
  const child = rows.get('parent').find(turn => turn.parentTurnId === saved.id);
  const metadata = saved.iterations[0].toolCalls[0].result.metadata;
  assert.equal(saved.iterations[0].turns, undefined);
  assert.equal(child.id, metadata.turnId);
  assert.equal(child.agentKey, metadata.agentKey);
  assert.equal(metadata.parentTurnId, saved.id);
  assert.equal(metadata.parentAgentKey, 'parent');
  assert.equal(metadata.parentToolCallId, 'call-1');
  assert.equal(metadata.subAgentType, 'overview');
  assert.equal(metadata.title, args.name);
  assert.equal(child.title, args.name);
  assert.equal(metadata.startedAt, child.startTime);
  assert.equal(metadata.status, undefined);
  assert.equal(child.iterations[0].toolCalls[0].result.output, 'tool history');
  assert.equal(rows.size, 1, 'no independent child history namespace');
  assert.equal(child.endTime, undefined);
  assert.ok(saved.endTime, 'parent completes before child');
  // A new parent turn must not wait for or overwrite the old background child.
  await parent.requestAI({ message: 'next parent turn' });
  parent.abort(); gate.resolve();
  const result = await completion;
  assert.equal(result.status, 'success');
  assert.equal(result.turn.iterations[1].content, 'child result');
  assert.equal(rows.get('parent').length, 3, 'two parent turns and one child turn');
  const storedChild = rows.get('parent').find(turn => turn.id === child.id);
  assert.equal(storedChild.iterations.length, 2);
  assert.equal(storedChild.startTime, metadata.startedAt);
  const reloaded = parentAgent(history, request);
  await reloaded.ensureHistoryReady();
  assert.equal(reloaded.getTurns().length, 2);
  assert.equal((await reloaded.getSubAgentTurns(child.agentKey))[0].id, child.id);
});

test('async is opt-in and rejected before creating a child', async () => {
  let spawned = false;
  const parent = new Agent({ ...defaults });
  parent.events.on('subagent:created', () => { spawned = true; });
  const tool = createSubAgentTool(() => parent, [{ ...config, supportsAsync: false }]);
  await assert.rejects(tool.execute(args, {}), /does not support async/);
  assert.equal(spawned, false);
});

test('flash sub-agent keeps its role and does not inherit the parent model, even with an image', async () => {
  const { history } = storage('iter');
  let parentCalls = 0;
  let childRequest;
  const parent = parentAgent(history, async request => {
    const { tools, emits } = request;
    if (tools.some(tool => tool.name === 'call-sub-agent')) {
      if (parentCalls++ === 0) return call(emits, 'call-sub-agent', args);
      emits.write('parent done'); emits.complete(); return;
    }
    childRequest = request;
    emits.write('child done'); emits.complete();
  }, { ...config, aiRole: 'flash' });
  const completion = waitForChild(parent);
  await parent.requestAI({
    message: 'start',
    attachments: [{ type: 'image', content: 'data:image/png;base64,AA==' }],
    providerId: 'parent-provider',
    modelId: 'parent-model',
  });
  await completion;
  assert.equal(childRequest.aiRole, 'flash');
  assert.equal(childRequest.providerId, undefined);
  assert.equal(childRequest.modelId, undefined);
});

test('host subscribes to the built-in child without replacing creation or persistence', async () => {
  const { history, rows } = storage('iter');
  let calls = 0;
  const parent = parentAgent(history, async ({ tools, emits }) => {
    if (!tools.some(tool => tool.name === 'call-sub-agent')) {
      emits.write('child result'); emits.complete(); return;
    }
    if (calls++ === 0) return call(emits, 'call-sub-agent', args);
    emits.write('parent done'); emits.complete();
  });
  const events = [];
  observeChildEvents(parent, events);
  const completion = waitForChild(parent);
  await parent.requestAI({ message: 'start' });
  const result = await completion;
  assert.equal(events[0].event, 'turn:start');
  assert.equal(events[0].turnId, result.turnId);
  assert.equal(result.turn.iterations[0].content, 'child result');
  assert.equal(rows.size, 1);
});

test('sync child keeps the parent waiting and returns its completed result', async () => {
  const { history } = storage('iter');
  const gate = deferred();
  const started = deferred();
  let calls = 0;
  let parentFinished = false;
  const parent = parentAgent(history, async ({ tools, emits }) => {
    if (!tools.some(tool => tool.name === 'call-sub-agent')) {
      started.resolve();
      await gate.promise;
      emits.write('child result'); emits.complete(); return;
    }
    if (calls++ === 0) return call(emits, 'call-sub-agent', { ...args, async: false });
    emits.write('parent done'); emits.complete();
  });
  const events = [];
  observeChildEvents(parent, events);
  const task = parent.requestAI({ message: 'start' }).then(() => { parentFinished = true; });
  await started.promise;
  assert.equal(parentFinished, false);
  assert.ok(events.some(event => event.event === 'turn:start' && event.async === false), 'sync events are observable while the child is running');
  gate.resolve();
  await task;
  const turn = parent.getTurns()[0];
  const result = turn.iterations[0].toolCalls[0].result;
  assert.match(result.output, /child result/);
  assert.equal(turn.iterations[0].turns, undefined);
  const child = (await parent.getSubAgentTurns(result.metadata.agentKey))[0];
  assert.equal(child.status, 'success');
  assert.equal(child.title, args.name);
  assert.equal(result.metadata.title, args.name);
  assert.equal(child.callId, 'call-1');
  assert.equal(result.metadata.iterations, undefined);
  assert.equal(result.metadata.status, undefined);
  assert.equal(result.metadata.turnId, child.id);
  assert.equal(result.metadata.parentTurnId, turn.id);
  assert.equal(result.metadata.parentAgentKey, 'parent');
  assert.equal(result.metadata.parentToolCallId, 'call-1');
  assert.equal(result.metadata.startedAt, child.startTime);
  assert.equal((await parent.getSubAgentTurns(child.agentKey))[0].id, child.id);
  assert.equal(events.filter(event => event.event === 'turn:complete').length, 1);
  assert.equal(events.at(-1).async, false);
});

test('cancelling the parent cancels a running sync child and emits its abort event', async () => {
  const { history } = storage('iter');
  const started = deferred();
  let childCancelled = 0;
  const parent = parentAgent(history, async ({ tools, emits }) => {
    if (tools.some(tool => tool.name === 'call-sub-agent')) {
      return call(emits, 'call-sub-agent', { ...args, async: false });
    }
    emits.cancel(() => { childCancelled++; });
    started.resolve();
  });
  const events = [];
  observeChildEvents(parent, events);
  const task = parent.requestAI({ message: 'start' });
  await started.promise;
  parent.abort();
  await task;
  assert.equal(childCancelled, 1);
  assert.ok(events.some(event => event.event === 'turn:abort' && event.async === false));
});

test('legacy snapshots remain readable and flat child records are collected', () => {
  const child = { id: 'child', agentKey: 'a', parentTurnId: 'parent', callId: 'call', startTime: 1, iterations: [] };
  const tool = { result: { metadata: { iterations: [{ iterId: 'legacy' }] } } };
  assert.deepEqual(readLegacySubAgentData(undefined, tool).iterations, [{ iterId: 'legacy' }]);
  assert.deepEqual(collectSubAgentTurns([child], 'a'), [child]);
});

test('sync child events replay into an independent child turn view', () => {
  const children = [];
  const info = { parentTurnId: 'parent', parentAgentKey: 'p', agentKey: 'a', turnId: 'child', callId: 'call', subAgentType: 'research', async: false, status: 'running', createdAt: 123 };
  assert.equal(applyChildAgentEvent(children, info, 'turn:start', { message: 'hello' }), true);
  assert.equal(children[0].userText, 'hello');
  assert.equal(children[0].parentTurnId, 'parent');
});

test('main history pagination skips child turns and preserves cursors', async () => {
  const all = [
    { id: 'p1' }, { id: 'c1', parentTurnId: 'p1', agentKey: 'a' },
    { id: 'c2', parentTurnId: 'p1', agentKey: 'a' }, { id: 'p2' },
    ...Array.from({ length: 25 }, (_, i) => ({ id: `c2-${i}`, parentTurnId: 'p2', agentKey: 'a' })),
    { id: 'p3' },
  ];
  const history = {
    load: async () => structuredClone(all),
    loadTurns: async (_key, { before, limit }) => {
      let end = all.length;
      if (before) end = all.findIndex(turn => turn.id === before);
      const start = Math.max(0, end - limit);
      return { turns: structuredClone(all.slice(start, end)), hasMore: start > 0 };
    },
  };
  const view = getTurnsManager(history, 'parent').main;
  const first = await view.loadTurns('parent', { limit: 2 });
  assert.deepEqual(first.turns.map(turn => turn.id), ['p2', 'p3']);
  assert.equal(first.hasMore, true);
  const next = await view.loadTurns('parent', { before: 'p2', limit: 2 });
  assert.deepEqual(next.turns.map(turn => turn.id), ['p1']);
  assert.equal(next.hasMore, false);
});

test('parent and child views serialize writes through the same underlying key', async () => {
  let rows = [];
  const history = {
    load: async () => structuredClone(rows),
    append: async (_key, turn) => {
      const snapshot = structuredClone(rows);
      await new Promise(resolve => setTimeout(resolve, 5));
      rows = [...snapshot, structuredClone(turn)];
    },
    update: async (_key, id, patch) => {
      const row = rows.find(turn => turn.id === id);
      Object.assign(row, structuredClone(patch));
    },
  };
  const manager = getTurnsManager(history, 'parent');
  const child = { id: 'child', agentKey: 'a', parentTurnId: 'parent-turn', callId: 'call', subAgentType: 'test', startTime: 1, iterations: [], userText: '', userAttachments: [], status: 'success' };
  await Promise.all([manager.main.append('parent', { id: 'parent-turn' }), manager.reserveChild(child)]);
  assert.deepEqual(rows.map(row => row.id), ['parent-turn', 'child']);
  assert.deepEqual((await manager.main.load('parent')).map(row => row.id), ['parent-turn']);
  assert.equal((await manager.children('a'))[0].parentTurnId, 'parent-turn');
});

test('a child history view loads earlier turns for the same agent key', async () => {
  const { history } = storage('iter');
  const manager = getTurnsManager(history, 'parent');
  const base = { agentKey: 'child-agent', parentAgentKey: 'parent', parentTurnId: 'parent-turn', callId: 'call', subAgentType: 'test', startTime: 1, iterations: [], userText: '', userAttachments: [], status: 'success' };
  const first = { ...base, id: 'child-1', endTime: 2 };
  const next = { ...base, id: 'child-2', startTime: 3 };
  await manager.reserveChild(first);
  await manager.reserveChild(next);
  const childHistory = manager.child(next);
  assert.deepEqual((await childHistory.load('child-agent')).map(turn => turn.id), ['child-1']);
  assert.deepEqual((await manager.children('child-agent')).map(turn => turn.id), ['child-1', 'child-2']);
  assert.deepEqual(await manager.main.load('parent'), []);
});

test('version queries remain bound to the parent history and preserve the storage receiver', async () => {
  const { history } = storage('turn');
  history.versionMarker = 'version data';
  history.listVersions = async function (key) {
    assert.equal(key, 'parent');
    assert.equal(this.versionMarker, 'version data');
    return { total: 1, list: [{ id: 'v1', turnId: 'parent-turn' }] };
  };
  history.getVersionFiles = async function (id) {
    assert.equal(this.versionMarker, 'version data');
    return [{ path: 'file', content: id }];
  };
  const agent = parentAgent(history, async () => {});
  const versions = agent.getHistory();
  assert.equal((await versions.listVersions()).list[0].turnId, 'parent-turn');
  assert.equal((await versions.getVersionFiles('v1'))[0].content, 'v1');
});
